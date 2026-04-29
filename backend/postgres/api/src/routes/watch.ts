import type { FastifyPluginAsync } from 'fastify';
import type { PoolClient } from 'pg';
import {
  TrainerForbiddenError,
  TrainerTargetNotFoundError,
  assertTrainerOwnsScenarioName,
  assertTrainerOwnsSession,
  readTrainerRefHeader
} from './_trainerAuth.js';

type WatchParticipantsParams = { sessionId: string };
type WatchTrackingParams = { sessionId: string };
type WatchTrackingQuery = { since?: string; limit?: string | number };
type LegacyScenarioTrackingQuery = { scenarioName?: string };

type WatchParticipantRow = {
  participant_id: string;
  trainee_name: string;
  device_type: string | null;
  joined_at: string;
  last_seen_at: string | null;
  latest_recorded_at: string | null;
  latest_received_at: string | null;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_accuracy_m: number | null;
  latest_active_shape_id: string | null;
  latest_active_shape_sort_order: number | null;
  latest_is_backfilled: boolean | null;
  latest_meta_json: unknown;
};

type WatchTrackingRow = {
  participant_id: string;
  recorded_at: string;
  received_at: string;
  lat: number;
  lon: number;
  accuracy_m: number | null;
  active_shape_id: string | null;
  active_shape_sort_order: number | null;
  is_backfilled: boolean;
  meta_json: unknown;
};

type TrackingMeta = {
  monitorType: string | null;
  monitorProfileId: string | null;
  monitorDeviceName: string | null;
  monitorSensorLayout: string[];
  samplingBand: 'high' | 'normal' | 'low' | 'none';
  secondsInCurrentBand: number | null;
};

type LegacyTrackingRow = {
  id: string;
  scenario_name: string;
  trainee_id: string;
  latitude: number;
  longitude: number;
  detection_device: string | null;
  created_at: string;
  monitor_type: string | null;
  monitor_profile_id: string | null;
  monitor_device_name: string | null;
  monitor_sensor_layout: unknown;
  sampling_band: string | null;
  seconds_in_current_band: number | null;
  sampling_band_label: string;
};

export const watchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: WatchParticipantsParams }>('/v1/sessions/:sessionId/watch/participants', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing X-Trainer-Ref header.' });
    }
    const sessionID = request.params.sessionId?.trim();
    if (!sessionID) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'sessionId is required.' });
    }

    try {
      await assertTrainerOwnsSession(app.pg, sessionID, trainerRef);
      const items = await listWatchParticipants(app.pg, sessionID);
      return reply.send(items);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch watch participants');
      if (error instanceof TrainerTargetNotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof TrainerForbiddenError) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch watch participants.' });
    }
  });

  app.get<{ Params: WatchTrackingParams; Querystring: WatchTrackingQuery }>('/v1/sessions/:sessionId/watch/tracking', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing X-Trainer-Ref header.' });
    }
    const sessionID = request.params.sessionId?.trim();
    if (!sessionID) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'sessionId is required.' });
    }

    const since = parseOptionalDate(request.query?.since);
    if (request.query?.since && !since) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'since must be a valid ISO timestamp.' });
    }
    const limit = clampLimit(request.query?.limit);

    try {
      await assertTrainerOwnsSession(app.pg, sessionID, trainerRef);
      const items = await listWatchTracking(app.pg, sessionID, { since, limit });
      const nextCursor = items.length > 0 ? items[items.length - 1].receivedAt : null;
      return reply.send({ items, nextCursor });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch watch tracking');
      if (error instanceof TrainerTargetNotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof TrainerForbiddenError) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch watch tracking.' });
    }
  });

  // Legacy endpoint kept for compatibility with the current iOS scaffold (scenarioName query)
  app.get<{ Querystring: LegacyScenarioTrackingQuery }>('/v1/watch/tracking', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing X-Trainer-Ref header.' });
    }
    const scenarioName = request.query?.scenarioName?.trim();
    if (!scenarioName) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'scenarioName query parameter is required.' });
    }

    try {
      await assertTrainerOwnsScenarioName(app.pg, scenarioName, trainerRef);
      const rows = await listLegacyTrackingByScenarioName(app.pg, scenarioName);
      return reply.send(rows);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch legacy watch tracking by scenario name');
      if (error instanceof TrainerTargetNotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof TrainerForbiddenError) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch watch tracking.' });
    }
  });
};

async function listWatchParticipants(pool: { query: PoolClient['query'] }, sessionID: string) {
  const result = await pool.query<WatchParticipantRow>(
    `
      select
        sp.id::text as participant_id,
        sp.trainee_name,
        sp.device_type::text as device_type,
        sp.joined_at,
        sp.last_seen_at,
        tp.recorded_at as latest_recorded_at,
        tp.received_at as latest_received_at,
        case when tp.position is null then null else ST_Y(tp.position::geometry) end as latest_lat,
        case when tp.position is null then null else ST_X(tp.position::geometry) end as latest_lon,
        tp.accuracy_m as latest_accuracy_m,
        tp.active_shape_id::text as latest_active_shape_id,
        tp.active_shape_sort_order as latest_active_shape_sort_order,
        tp.is_backfilled as latest_is_backfilled,
        tp.meta_json as latest_meta_json
      from session_participants sp
      left join lateral (
        select t.*
        from tracking_points t
        where t.participant_id = sp.id
        order by t.recorded_at desc, t.id desc
        limit 1
      ) tp on true
      where sp.session_id = $1::uuid
      order by sp.joined_at asc, sp.trainee_name asc
    `,
    [sessionID]
  );

  return result.rows.map((row: WatchParticipantRow) => {
    const meta = readTrackingMeta(row.latest_meta_json);
    return {
      participantId: row.participant_id,
      traineeName: row.trainee_name,
      deviceType: row.device_type,
      joinedAt: row.joined_at,
      lastSeenAt: row.last_seen_at,
      latestPoint:
        row.latest_recorded_at && row.latest_lat != null && row.latest_lon != null
          ? {
              participantId: row.participant_id,
              recordedAt: row.latest_recorded_at,
              receivedAt: row.latest_received_at,
              lat: row.latest_lat,
              lon: row.latest_lon,
              accuracyM: row.latest_accuracy_m,
              activeShapeId: row.latest_active_shape_id,
              activeShapeSortOrder: row.latest_active_shape_sort_order,
              isBackfilled: Boolean(row.latest_is_backfilled),
              monitorType: meta.monitorType,
              monitorProfileId: meta.monitorProfileId,
              monitorDeviceName: meta.monitorDeviceName,
              monitorSensorLayout: meta.monitorSensorLayout,
              samplingBand: meta.samplingBand,
              samplingBandLabel: toSamplingBandLabel(meta.samplingBand),
              secondsInCurrentBand: meta.secondsInCurrentBand
            }
          : null
    };
  });
}

async function listWatchTracking(
  pool: { query: PoolClient['query'] },
  sessionID: string,
  options: { since: Date | null; limit: number }
) {
  const params: unknown[] = [sessionID];
  let sinceClause = '';
  if (options.since) {
    params.push(options.since.toISOString());
    sinceClause = ` and t.received_at > $${params.length}::timestamptz`;
  }
  params.push(options.limit);
  const limitParam = `$${params.length}`;

  const result = await pool.query<WatchTrackingRow>(
    `
      select
        t.participant_id::text as participant_id,
        t.recorded_at,
        t.received_at,
        ST_Y(t.position::geometry) as lat,
        ST_X(t.position::geometry) as lon,
        t.accuracy_m,
        t.active_shape_id::text as active_shape_id,
        t.active_shape_sort_order,
        t.is_backfilled,
        t.meta_json
      from tracking_points t
      where t.session_id = $1::uuid
      ${sinceClause}
      order by t.received_at asc, t.id asc
      limit ${limitParam}::int
    `,
    params
  );

  return result.rows.map((row: WatchTrackingRow) => {
    const meta = readTrackingMeta(row.meta_json);
    return {
      participantId: row.participant_id,
      recordedAt: row.recorded_at,
      receivedAt: row.received_at,
      lat: row.lat,
      lon: row.lon,
      accuracyM: row.accuracy_m,
      activeShapeId: row.active_shape_id,
      activeShapeSortOrder: row.active_shape_sort_order,
      isBackfilled: row.is_backfilled,
      monitorType: meta.monitorType,
      monitorProfileId: meta.monitorProfileId,
      monitorDeviceName: meta.monitorDeviceName,
      monitorSensorLayout: meta.monitorSensorLayout,
      samplingBand: meta.samplingBand,
      samplingBandLabel: toSamplingBandLabel(meta.samplingBand),
      secondsInCurrentBand: meta.secondsInCurrentBand
    };
  });
}

async function listLegacyTrackingByScenarioName(pool: { query: PoolClient['query'] }, scenarioName: string) {
  const result = await pool.query<LegacyTrackingRow>(
    `
      select
        t.client_point_id::text as id,
        s.scenario_name,
        sp.trainee_name as trainee_id,
        ST_Y(t.position::geometry) as latitude,
        ST_X(t.position::geometry) as longitude,
        sp.device_type::text as detection_device,
        t.recorded_at as created_at,
        t.meta_json->>'monitorType' as monitor_type,
        t.meta_json->>'monitorProfileId' as monitor_profile_id,
        t.meta_json->>'monitorDeviceName' as monitor_device_name,
        t.meta_json->'monitorSensorLayout' as monitor_sensor_layout,
        nullif(t.meta_json->>'samplingBand', '') as sampling_band,
        case
          when (t.meta_json->>'secondsInCurrentBand') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            then (t.meta_json->>'secondsInCurrentBand')::double precision
          else null
        end as seconds_in_current_band,
        case lower(coalesce(t.meta_json->>'samplingBand', ''))
          when 'high' then 'HIGH'
          when 'normal' then 'NORMAL'
          when 'low' then 'LOW'
          else 'N/A'
        end as sampling_band_label
      from tracking_points t
      join scenario_sessions ss on ss.id = t.session_id
      join scenarios s on s.id = ss.scenario_id
      join session_participants sp on sp.id = t.participant_id
      where s.scenario_name = $1
      order by t.recorded_at asc, t.id asc
      limit 2000
    `,
    [scenarioName]
  );

  return result.rows.map((row: LegacyTrackingRow) => ({
    id: row.id,
    scenarioName: row.scenario_name,
    traineeID: row.trainee_id,
    latitude: row.latitude,
    longitude: row.longitude,
    detectionDevice: row.detection_device,
    createdAt: row.created_at,
    monitorType: row.monitor_type,
    monitorProfileId: row.monitor_profile_id,
    monitorDeviceName: row.monitor_device_name,
    monitorSensorLayout: Array.isArray(row.monitor_sensor_layout)
      ? row.monitor_sensor_layout.filter((entry): entry is string => typeof entry === 'string')
      : [],
    samplingBand: row.sampling_band,
    samplingBandLabel: row.sampling_band_label,
    secondsInCurrentBand: row.seconds_in_current_band
  }));
}

function parseOptionalDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function clampLimit(value?: string | number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(5000, Math.trunc(parsed)));
}

function readTrackingMeta(value: unknown): TrackingMeta {
  const source = isRecord(value) ? value : {};

  const samplingBandRaw = typeof source.samplingBand === 'string' ? source.samplingBand.trim().toLowerCase() : '';
  const samplingBand: TrackingMeta['samplingBand'] =
    samplingBandRaw === 'high' || samplingBandRaw === 'normal' || samplingBandRaw === 'low' || samplingBandRaw === 'none'
      ? samplingBandRaw
      : 'none';

  return {
    monitorType: toNullableString(source.monitorType),
    monitorProfileId: toNullableString(source.monitorProfileId),
    monitorDeviceName: toNullableString(source.monitorDeviceName),
    monitorSensorLayout: Array.isArray(source.monitorSensorLayout)
      ? source.monitorSensorLayout.filter((entry): entry is string => typeof entry === 'string')
      : [],
    samplingBand,
    secondsInCurrentBand: toNullableNumber(source.secondsInCurrentBand)
  };
}

function toSamplingBandLabel(value: TrackingMeta['samplingBand']): 'HIGH' | 'NORMAL' | 'LOW' | 'N/A' {
  if (value === 'high') return 'HIGH';
  if (value === 'normal') return 'NORMAL';
  if (value === 'low') return 'LOW';
  return 'N/A';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}
