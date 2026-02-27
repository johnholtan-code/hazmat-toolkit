import type { FastifyPluginAsync } from 'fastify';
import type { PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import {
  TrainerForbiddenError,
  TrainerTargetNotFoundError,
  assertTrainerOwnsSession,
  readTrainerRefHeader
} from './_trainerAuth.js';

type CreateSessionBody = {
  scenarioId: string;
  sessionName?: string | null;
  joinCodeTTLMinutes?: number;
};

type JoinBody = {
  joinCode: string;
  traineeName: string;
  deviceType: 'air_monitor' | 'radiation_detection' | 'ph_paper';
};

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: CreateSessionBody }>('/v1/sessions', async (request, reply) => {
    const scenarioID = request.body?.scenarioId?.trim();
    if (!scenarioID) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'scenarioId is required.' });
    }

    const ttlMinutes = clampTTLMinutes(request.body?.joinCodeTTLMinutes ?? app.config.joinCodeTtlMinutes);
    const sessionName = request.body?.sessionName?.trim() || null;

    try {
      const result = await createSessionWithSnapshot(app.pg, {
        scenarioID,
        sessionName,
        ttlMinutes
      });

      return reply.code(201).send({
        session: {
          id: result.session.id,
          scenarioId: result.session.scenarioID,
          status: toPublicSessionStatus(result.session.status),
          joinCode: result.session.joinCode,
          joinCodeExpiresAt: result.session.joinCodeExpiresAt,
          startsAt: result.session.startsAt,
          endedAt: result.session.endedAt,
          isLive: toPublicSessionStatus(result.session.status) === 'active'
        },
        joinCode: {
          joinCode: result.session.joinCode,
          joinCodeExpiresAt: result.session.joinCodeExpiresAt
        },
        qrPayload: JSON.stringify({ type: 'hazmat_session_join', joinCode: result.session.joinCode })
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create session');
      if (isNotFoundError(error)) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create session.' });
    }
  });

  app.post<{ Params: { sessionId: string } }>('/v1/sessions/:sessionId/rotate-join-code', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing X-Trainer-Ref header.' });
    }

    try {
      await assertTrainerOwnsSession(app.pg, request.params.sessionId, trainerRef);
      const rotated = await rotateJoinCode(app.pg, request.params.sessionId, app.config.joinCodeTtlMinutes);
      return reply.send(rotated);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to rotate join code');
      if (error instanceof TrainerTargetNotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof TrainerForbiddenError) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
      }
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof ConflictError) {
        return reply.code(409).send({ error: 'CONFLICT', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to rotate join code.' });
    }
  });

  app.post<{ Params: { sessionId: string } }>('/v1/sessions/:sessionId/end', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing X-Trainer-Ref header.' });
    }
    try {
      await assertTrainerOwnsSession(app.pg, request.params.sessionId, trainerRef);
      const session = await closeSession(app.pg, request.params.sessionId);
      return reply.send({
        ...session,
        status: toPublicSessionStatus(session.status),
        isLive: false
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to end session');
      if (error instanceof TrainerTargetNotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof TrainerForbiddenError) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
      }
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof ConflictError) {
        return reply.code(409).send({ error: 'CONFLICT', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to end session.' });
    }
  });

  app.post<{ Body: JoinBody }>('/v1/sessions/join', async (request, reply) => {
    const { joinCode, traineeName, deviceType } = (request.body ?? {}) as Partial<JoinBody>;
    if (!joinCode || !traineeName || !deviceType) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'joinCode, traineeName, and deviceType are required.' });
    }

    if (!isSupportedDeviceType(deviceType)) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Unsupported deviceType.' });
    }

    try {
      const joined = await joinSessionByCode(app.pg, {
        joinCode: joinCode.trim().toUpperCase(),
        traineeName: traineeName.trim(),
        deviceType
      });

      return reply.send({
        session: {
          id: joined.session.id,
          status: toPublicSessionStatus(joined.session.status),
          startsAt: joined.session.startsAt
        },
        participant: {
          id: joined.participant.id,
          traineeName: joined.participant.traineeName,
          deviceType: joined.participant.deviceType
        },
        token: {
          accessToken: joined.token.accessToken,
          expiresAt: joined.token.expiresAt
        },
        snapshot: joined.snapshot
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to join session');

      if (error instanceof JoinCodeExpiredError) {
        return reply.code(410).send({ error: 'JOIN_CODE_EXPIRED', message: error.message });
      }
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      if (error instanceof ConflictError) {
        return reply.code(409).send({ error: 'CONFLICT', message: error.message });
      }

      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to join session.' });
    }
  });

  app.get('/v1/sessions/me', async (request, reply) => {
    const bearer = extractBearerToken(request.headers.authorization);
    if (!bearer) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing bearer token.' });
    }

    try {
      const sessionInfo = await getParticipantSessionInfoForToken(app.pg, bearer);
      const status = toPublicSessionStatus(sessionInfo.status);
      return reply.send({
        ...sessionInfo,
        status,
        isLive: status === 'active'
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch current session metadata');
      if (error instanceof UnauthorizedError) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch current session metadata.' });
    }
  });
  app.get('/v1/sessions/me/snapshot', async (request, reply) => {
    const bearer = extractBearerToken(request.headers.authorization);
    if (!bearer) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing bearer token.' });
    }

    try {
      const snapshot = await getSnapshotForSessionToken(app.pg, bearer);
      return reply.send(snapshot);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch session snapshot');
      if (error instanceof UnauthorizedError) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: error.message });
      }
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
      }
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch session snapshot.' });
    }
  });
};

function generateJoinCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function clampTTLMinutes(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(240, Math.max(1, Math.trunc(value)));
}

type CreateSessionParams = {
  scenarioID: string;
  sessionName: string | null;
  ttlMinutes: number;
};

type DBScenarioRow = {
  id: string;
  scenario_name: string;
  trainer_name: string;
  scenario_date: string | null;
  latitude: number | null;
  longitude: number | null;
  detection_device: 'air_monitor' | 'radiation_detection' | 'ph_paper';
  version: number;
  created_at: string;
  updated_at: string;
  trainer_id: string | null;
  trainer_ref: string | null;
};

type DBShapeRow = {
  id: string;
  scenario_id: string;
  description: string;
  kind: 'polygon' | 'circle' | 'point';
  sort_order: number;
  display_color_hex: string | null;
  shape_geojson: string;
  radius_m: number | null;
  oxygen: string | null;
  lel: string | null;
  carbon_monoxide: string | null;
  hydrogen_sulfide: string | null;
  pid: string | null;
  chemical_readings: unknown;
  dose_rate: string | null;
  background: string | null;
  shielding: string | null;
  rad_latitude: string | null;
  rad_longitude: string | null;
  rad_dose_unit: string | null;
  rad_exposure_unit: string | null;
  ph: number | null;
};

type DBSessionRow = {
  id: string;
  scenario_id: string;
  status: string;
  join_code: string;
  join_code_expires_at: string;
  starts_at: string | null;
  ended_at: string | null;
  is_live: boolean;
};

class NotFoundError extends Error {}
class ConflictError extends Error {}
class JoinCodeExpiredError extends Error {}
class UnauthorizedError extends Error {}

function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

function isSupportedDeviceType(value: string): value is 'air_monitor' | 'radiation_detection' | 'ph_paper' {
  return value === 'air_monitor' || value === 'radiation_detection' || value === 'ph_paper';
}

type PublicSessionStatus = 'active' | 'closed';

function toPublicSessionStatus(status: string): PublicSessionStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'ended' || normalized === 'cancelled' || normalized === 'closed') {
    return 'closed';
  }
  return 'active';
}

async function createSessionWithSnapshot(pool: { connect(): Promise<PoolClient> }, params: CreateSessionParams) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const scenario = await fetchScenario(client, params.scenarioID);
    if (!scenario) {
      throw new NotFoundError(`Scenario not found: ${params.scenarioID}`);
    }

    const shapes = await fetchScenarioShapes(client, params.scenarioID);
    const session = await insertSessionWithUniqueJoinCode(client, {
      scenario,
      sessionName: params.sessionName,
      ttlMinutes: params.ttlMinutes
    });

    const snapshot = buildSessionSnapshot(session.id, scenario, shapes);
    const snapshotJSONString = JSON.stringify(snapshot);
    const snapshotSHA256 = createHash('sha256').update(snapshotJSONString).digest('hex');

    await client.query(
      `
        insert into session_snapshots (
          session_id,
          scenario_id,
          scenario_version,
          snapshot_json,
          snapshot_sha256
        )
        values ($1, $2, $3, $4::jsonb, $5)
      `,
      [session.id, scenario.id, scenario.version, snapshotJSONString, snapshotSHA256]
    );

    await client.query('COMMIT');
    return { session, snapshot };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fetchScenario(client: PoolClient, scenarioID: string): Promise<DBScenarioRow | null> {
  const result = await client.query<DBScenarioRow>(
    `
      select
        s.id::text as id,
        s.scenario_name,
        coalesce(t.display_name, s.trainer_ref, 'Trainer') as trainer_name,
        s.scenario_date,
        case when s.center_geog is null then null else ST_Y(s.center_geog::geometry) end as latitude,
        case when s.center_geog is null then null else ST_X(s.center_geog::geometry) end as longitude,
        s.detection_device::text as detection_device,
        s.version,
        s.created_at,
        s.updated_at,
        s.trainer_id::text as trainer_id,
        s.trainer_ref
      from scenarios s
      left join trainers t on t.id = s.trainer_id
      where s.id = $1::uuid
      limit 1
    `,
    [scenarioID]
  );
  return result.rows[0] ?? null;
}

async function fetchScenarioShapes(client: PoolClient, scenarioID: string): Promise<DBShapeRow[]> {
  const result = await client.query<DBShapeRow>(
    `
      select
        ss.id::text as id,
        ss.scenario_id::text as scenario_id,
        ss.description,
        ss.kind::text as kind,
        ss.sort_order,
        ss.display_color_hex,
        ST_AsGeoJSON(ss.geom)::text as shape_geojson,
        ss.radius_m,
        ss.oxygen::text as oxygen,
        ss.lel::text as lel,
        ss.carbon_monoxide::text as carbon_monoxide,
        ss.hydrogen_sulfide::text as hydrogen_sulfide,
        ss.pid::text as pid,
        coalesce(ss.properties_json -> 'chemicalReadings', '[]'::jsonb) as chemical_readings,
        ss.dose_rate,
        ss.background,
        ss.shielding,
        ss.rad_latitude::text as rad_latitude,
        ss.rad_longitude::text as rad_longitude,
        ss.rad_dose_unit,
        ss.rad_exposure_unit,
        ss.ph::float8 as ph
      from scenario_shapes ss
      where ss.scenario_id = $1::uuid
      order by ss.sort_order asc, ss.created_at asc
    `,
    [scenarioID]
  );
  return result.rows;
}

async function insertSessionWithUniqueJoinCode(
  client: PoolClient,
  params: { scenario: DBScenarioRow; sessionName: string | null; ttlMinutes: number }
): Promise<{
  id: string;
  scenarioID: string;
  status: string;
  joinCode: string;
  joinCodeExpiresAt: string;
  startsAt: string | null;
  endedAt: string | null;
  isLive: boolean;
}> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const expiresAt = new Date(Date.now() + params.ttlMinutes * 60_000);

    try {
      const inserted = await client.query<DBSessionRow>(
        `
          insert into scenario_sessions (
            scenario_id,
            trainer_id,
            trainer_ref,
            session_name,
            status,
            join_code,
            join_code_expires_at,
            is_live
          )
          values (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            'scheduled',
            $5,
            $6,
            false
          )
          returning
            id::text as id,
            scenario_id::text as scenario_id,
            status::text as status,
            join_code,
            join_code_expires_at,
            starts_at,
            ended_at,
            is_live
        `,
        [
          params.scenario.id,
          params.scenario.trainer_id,
          params.scenario.trainer_ref,
          params.sessionName,
          joinCode,
          expiresAt.toISOString()
        ]
      );

      const row = inserted.rows[0];
      return {
        id: row.id,
        scenarioID: row.scenario_id,
        status: row.status,
        joinCode: row.join_code,
        joinCodeExpiresAt: row.join_code_expires_at,
        startsAt: row.starts_at,
        endedAt: row.ended_at,
        isLive: row.is_live
      };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Unable to generate unique join code.');
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

function buildSessionSnapshot(sessionID: string, scenario: DBScenarioRow, shapes: DBShapeRow[]) {
  return {
    sessionId: sessionID,
    scenario: {
      id: scenario.id,
      scenarioName: scenario.scenario_name,
      trainerName: scenario.trainer_name,
      scenarioDate: scenario.scenario_date ?? new Date().toISOString(),
      latitude: scenario.latitude,
      longitude: scenario.longitude,
      detectionDevice: scenario.detection_device,
      version: scenario.version,
      createdAt: scenario.created_at,
      updatedAt: scenario.updated_at
    },
    shapes: shapes.map((shape) => ({
      id: shape.id,
      scenarioId: shape.scenario_id,
      description: shape.description,
      kind: shape.kind,
      sortOrder: shape.sort_order,
      displayColorHex: shape.display_color_hex,
      shapeGeoJSON: shape.shape_geojson,
      radiusM: shape.radius_m,
      oxygen: shape.oxygen,
      lel: shape.lel,
      carbonMonoxide: shape.carbon_monoxide,
      hydrogenSulfide: shape.hydrogen_sulfide,
      pid: shape.pid,
      chemicalReadings: Array.isArray(shape.chemical_readings) ? shape.chemical_readings : [],
      doseRate: shape.dose_rate,
      background: shape.background,
      shielding: shape.shielding,
      radLatitude: shape.rad_latitude,
      radLongitude: shape.rad_longitude,
      radDoseUnit: shape.rad_dose_unit,
      radExposureUnit: shape.rad_exposure_unit,
      pH: shape.ph
    })),
    rules: {
      overlapPriority: 'LOWER_SORT_ORDER_WINS'
    }
  };
}

type DBJoinLookupRow = {
  session_id: string;
  status: string;
  starts_at: string | null;
  join_code_expires_at: string;
  snapshot_json: unknown;
};

type DBParticipantInsertRow = {
  id: string;
  trainee_name: string;
  device_type: 'air_monitor' | 'radiation_detection' | 'ph_paper';
  token_expires_at: string;
};

async function joinSessionByCode(
  pool: { connect(): Promise<PoolClient> },
  params: { joinCode: string; traineeName: string; deviceType: 'air_monitor' | 'radiation_detection' | 'ph_paper' }
) {
  const normalizedTraineeName = params.traineeName.trim();
  if (!normalizedTraineeName) {
    throw new ConflictError('traineeName cannot be empty.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lookup = await client.query<DBJoinLookupRow>(
      `
        select
          ss.id::text as session_id,
          ss.status::text as status,
          ss.starts_at,
          ss.join_code_expires_at,
          snap.snapshot_json
        from scenario_sessions ss
        join session_snapshots snap on snap.session_id = ss.id
        where ss.join_code = $1
          and ss.status in ('scheduled', 'live')
        limit 1
      `,
      [params.joinCode]
    );

    const session = lookup.rows[0];
    if (!session) {
      throw new NotFoundError('Session not found for join code.');
    }

    if (new Date(session.join_code_expires_at).getTime() <= Date.now()) {
      throw new JoinCodeExpiredError('Join code has expired.');
    }

    const rawToken = `sess_${randomUUID()}${randomUUID().replace(/-/g, '')}`;
    const tokenHash = hashSessionToken(rawToken);
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const upserted = await client.query<DBParticipantInsertRow>(
      `
        insert into session_participants (
          session_id,
          trainee_name,
          device_type,
          session_token_hash,
          token_expires_at,
          last_seen_at
        )
        values ($1::uuid, $2, $3::device_type, $4, $5::timestamptz, now())
        on conflict (session_id, trainee_name)
        do update set
          device_type = excluded.device_type,
          session_token_hash = excluded.session_token_hash,
          token_expires_at = excluded.token_expires_at,
          last_seen_at = now()
        returning
          id::text as id,
          trainee_name,
          device_type::text as device_type,
          token_expires_at
      `,
      [session.session_id, normalizedTraineeName, params.deviceType, tokenHash, tokenExpiresAt]
    );
    const participantRow = upserted.rows[0];

    await client.query('COMMIT');

    return {
      session: {
        id: session.session_id,
        status: session.status,
        startsAt: session.starts_at
      },
      participant: {
        id: participantRow.id,
        traineeName: participantRow.trainee_name,
        deviceType: participantRow.device_type
      },
      token: {
        accessToken: rawToken,
        expiresAt: participantRow.token_expires_at
      },
      snapshot: session.snapshot_json
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

type DBLifecycleRow = {
  id: string;
  scenario_id: string;
  status: string;
  join_code: string;
  join_code_expires_at: string;
  starts_at: string | null;
  ended_at: string | null;
  is_live: boolean;
};

async function closeSession(pool: { query: PoolClient['query'] }, sessionID: string) {
  if (!sessionID?.trim()) {
    throw new NotFoundError('Session ID is required.');
  }

  const result = await pool.query<DBLifecycleRow>(
    `
      update scenario_sessions
      set
        status = 'ended',
        is_live = false,
        ended_at = coalesce(ended_at, now())
      where id = $1::uuid
        and status in ('scheduled', 'live', 'ended')
      returning
        id::text as id,
        scenario_id::text as scenario_id,
        status::text as status,
        join_code,
        join_code_expires_at,
        starts_at,
        ended_at,
        is_live
    `,
    [sessionID.trim()]
  );

  const row = result.rows[0];
  if (!row) {
    const exists = await pool.query<{ exists: boolean }>(
      `select true as exists from scenario_sessions where id = $1::uuid limit 1`,
      [sessionID.trim()]
    );
    if (exists.rowCount === 0) {
      throw new NotFoundError('Session not found.');
    }
    throw new ConflictError('Session cannot be closed from its current status.');
  }

  return {
    id: row.id,
    scenarioId: row.scenario_id,
    status: row.status,
    joinCode: row.join_code,
    joinCodeExpiresAt: row.join_code_expires_at,
    startsAt: row.starts_at,
    endedAt: row.ended_at,
    isLive: row.is_live
  };
}

type DBRotateJoinCodeRow = {
  join_code: string;
  join_code_expires_at: string;
};

async function rotateJoinCode(
  pool: { query: PoolClient['query'] },
  sessionID: string,
  ttlMinutes: number
): Promise<{ joinCode: string; joinCodeExpiresAt: string }> {
  const normalizedTTL = clampTTLMinutes(ttlMinutes);
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const expiresAt = new Date(Date.now() + normalizedTTL * 60_000).toISOString();

    try {
      const result = await pool.query<DBRotateJoinCodeRow>(
        `
          update scenario_sessions
          set
            join_code = $2,
            join_code_expires_at = $3::timestamptz,
            join_code_last_rotated_at = now()
          where id = $1::uuid
            and status in ('scheduled', 'live')
          returning
            join_code,
            join_code_expires_at
        `,
        [sessionID.trim(), joinCode, expiresAt]
      );

      if (result.rowCount === 0) {
        const exists = await pool.query<{ exists: boolean }>(
          `select true as exists from scenario_sessions where id = $1::uuid limit 1`,
          [sessionID.trim()]
        );
        if (exists.rowCount === 0) {
          throw new NotFoundError('Session not found.');
        }
        throw new ConflictError('Join code can only be rotated for scheduled or live sessions.');
      }

      const row = result.rows[0];
      return {
        joinCode: row.join_code,
        joinCodeExpiresAt: row.join_code_expires_at
      };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Unable to rotate join code.');
}

type DBSnapshotAuthRow = {
  session_id: string;
  snapshot_json: unknown;
};

async function getSnapshotForSessionToken(pool: { query: PoolClient['query'] }, token: string) {
  const tokenHash = hashSessionToken(token);
  const result = await pool.query<DBSnapshotAuthRow>(
    `
      select
        sp.session_id::text as session_id,
        snap.snapshot_json
      from session_participants sp
      join scenario_sessions ss on ss.id = sp.session_id
      join session_snapshots snap on snap.session_id = sp.session_id
      where sp.session_token_hash = $1
        and sp.token_expires_at > now()
        and ss.status in ('scheduled', 'live')
      limit 1
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new UnauthorizedError('Invalid or expired session token.');
  }

  return result.rows[0].snapshot_json;
}

type DBParticipantSessionInfoRow = {
  session_id: string;
  participant_id: string;
  status: string;
  token_expires_at: string;
  starts_at: string | null;
  ended_at: string | null;
  is_live: boolean;
};

async function getParticipantSessionInfoForToken(pool: { query: PoolClient['query'] }, token: string) {
  const tokenHash = hashSessionToken(token);
  const result = await pool.query<DBParticipantSessionInfoRow>(
    `
      select
        sp.session_id::text as session_id,
        sp.id::text as participant_id,
        ss.status::text as status,
        sp.token_expires_at,
        ss.starts_at,
        ss.ended_at,
        ss.is_live
      from session_participants sp
      join scenario_sessions ss on ss.id = sp.session_id
      where sp.session_token_hash = $1
        and sp.token_expires_at > now()
      limit 1
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    throw new UnauthorizedError('Invalid or expired session token.');
  }

  const row = result.rows[0];
  return {
    sessionId: row.session_id,
    participantId: row.participant_id,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    startsAt: row.starts_at,
    endedAt: row.ended_at,
    isLive: row.is_live
  };
}
