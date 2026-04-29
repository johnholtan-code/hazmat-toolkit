import type { FastifyPluginAsync } from 'fastify';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

type TrackingBatchBody = {
  batchId: string;
  points: Array<{
    clientPointId: string;
    recordedAt: string;
    lat: number;
    lon: number;
    accuracyM?: number;
    speedMps?: number;
    headingDeg?: number;
    monitorType?: string;
    monitorProfileId?: string;
    monitorDeviceName?: string;
    monitorSensorLayout?: string[];
    samplingBand?: 'high' | 'normal' | 'low' | 'none';
    secondsInCurrentBand?: number;
    activeShapeId?: string;
    activeShapeSortOrder?: number;
  }>;
};

export const trackingRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: TrackingBatchBody }>('/v1/tracking/batches', async (request, reply) => {
    const bearer = extractBearerToken(request.headers.authorization);
    if (!bearer) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing bearer token.' });
    }

    const points = request.body?.points ?? [];
    if (points.length === 0) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'At least one tracking point is required.' });
    }

    try {
      const result = await ingestTrackingBatch(app.pg, {
        token: bearer,
        batchId: request.body.batchId,
        points
      });
      return reply.send(result);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to ingest tracking batch');
      if (error instanceof TrackingAuthError) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: error.message });
      }
      if (error instanceof TrackingValidationError) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to ingest tracking batch.' });
    }
  });
};

class TrackingAuthError extends Error {}
class TrackingValidationError extends Error {}

type ParticipantAuthRow = {
  participant_id: string;
  session_id: string;
  token_expires_at: string;
};

async function ingestTrackingBatch(
  pool: { connect(): Promise<PoolClient> },
  params: { token: string; batchId: string; points: TrackingBatchBody['points'] }
) {
  validateTrackingPoints(params.points);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const auth = await authenticateParticipant(client, params.token);
    if (!auth) {
      throw new TrackingAuthError('Invalid or expired session token.');
    }

    let accepted = 0;
    let duplicates = 0;
    const now = Date.now();

    for (let i = 0; i < params.points.length; i += 1) {
      const point = params.points[i];
      const isBackfilled = now - new Date(point.recordedAt).getTime() > 30_000;
      const metaJson = buildTrackingMeta(point);

      const inserted = await client.query<{ inserted: number }>(
        `
          insert into tracking_points (
            session_id,
            participant_id,
            client_point_id,
            recorded_at,
            position,
            accuracy_m,
            speed_mps,
            heading_deg,
            meta_json,
            active_shape_id,
            active_shape_sort_order,
            is_backfilled,
            batch_id,
            sequence_in_batch
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::timestamptz,
            ST_SetSRID(ST_MakePoint($5::float8, $6::float8), 4326)::geography,
            $7::float8,
            $8::float8,
            $9::float8,
            $10::jsonb,
            $11::uuid,
            $12::int,
            $13::boolean,
            $14::uuid,
            $15::int
          )
          on conflict (participant_id, client_point_id) do nothing
          returning 1 as inserted
        `,
        [
          auth.session_id,
          auth.participant_id,
          point.clientPointId,
          point.recordedAt,
          point.lon,
          point.lat,
          point.accuracyM ?? null,
          point.speedMps ?? null,
          point.headingDeg ?? null,
          JSON.stringify(metaJson),
          point.activeShapeId ?? null,
          point.activeShapeSortOrder ?? null,
          isBackfilled,
          params.batchId,
          i + 1
        ]
      );

      if (inserted.rowCount && inserted.rowCount > 0) {
        accepted += 1;
      } else {
        duplicates += 1;
      }
    }

    await client.query(
      `
        update session_participants
        set last_seen_at = now()
        where id = $1::uuid
      `,
      [auth.participant_id]
    );

    await client.query('COMMIT');

    return {
      accepted,
      duplicates,
      serverTime: new Date().toISOString()
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function authenticateParticipant(client: PoolClient, token: string): Promise<ParticipantAuthRow | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await client.query<ParticipantAuthRow>(
    `
      select
        sp.id::text as participant_id,
        sp.session_id::text as session_id,
        sp.token_expires_at
      from session_participants sp
      join scenario_sessions ss on ss.id = sp.session_id
      where sp.session_token_hash = $1
        and sp.token_expires_at > now()
        and ss.status in ('scheduled', 'live')
      limit 1
    `,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

function validateTrackingPoints(points: TrackingBatchBody['points']) {
  for (const point of points) {
    if (!point.clientPointId || !point.recordedAt) {
      throw new TrackingValidationError('Each point requires clientPointId and recordedAt.');
    }
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
      throw new TrackingValidationError('Each point requires numeric lat/lon.');
    }
    if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
      throw new TrackingValidationError('Point lat/lon is out of range.');
    }
    const recorded = new Date(point.recordedAt);
    if (Number.isNaN(recorded.getTime())) {
      throw new TrackingValidationError('recordedAt must be a valid ISO timestamp.');
    }
    if (
      point.samplingBand !== undefined &&
      !['high', 'normal', 'low', 'none'].includes(point.samplingBand)
    ) {
      throw new TrackingValidationError('samplingBand must be one of: high, normal, low, none.');
    }
    if (point.secondsInCurrentBand !== undefined && !Number.isFinite(point.secondsInCurrentBand)) {
      throw new TrackingValidationError('secondsInCurrentBand must be numeric when provided.');
    }
  }
}

function buildTrackingMeta(point: TrackingBatchBody['points'][number]) {
  return {
    monitorType: point.monitorType ?? null,
    monitorProfileId: point.monitorProfileId ?? null,
    monitorDeviceName: point.monitorDeviceName ?? null,
    monitorSensorLayout: point.monitorSensorLayout ?? [],
    samplingBand: point.samplingBand ?? 'none',
    secondsInCurrentBand: point.secondsInCurrentBand ?? 0,
    headingDeg: point.headingDeg ?? 0,
    accuracyM: point.accuracyM ?? 0,
    speedMps: point.speedMps ?? 0
  };
}
