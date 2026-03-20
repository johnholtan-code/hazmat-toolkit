import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { TrainerAuthError, TrainerForbiddenError, TrainerTargetNotFoundError } from '../_trainerAuth.js';
import { requireTrainerIdentity } from '../_trainerIdentity.js';

const ICS_ROLES = [
  'Incident Commander',
  'Operations Section Chief',
  'Planning Section Chief',
  'Logistics Section Chief',
  'Safety Officer',
  'HazMat Group Supervisor',
  'Division Supervisor',
  'Resource Unit Leader',
  'Air Monitoring Team',
  'Decontamination Group'
] as const;

const PERMISSION_TIERS = ['commander', 'operator', 'observer'] as const;
const OBJECT_TYPES = [
  'IncidentCommand',
  'Staging',
  'AccessRoute',
  'ExitRoute',
  'Division',
  'CollapseZone',
  'HotZone',
  'WarmZone',
  'ColdZone',
  'HazardSource',
  'MonitoringPoint',
  'DeconCorridor',
  'Rehab',
  'Hydrant',
  'HoseLine',
  'RIT',
  'SafetyHazard',
  'EvacuationZone',
  'InitialIsolationZone',
  'ProtectiveActionZone',
  'IconMarker'
] as const;

const GEOMETRY_TYPES = ['point', 'line', 'polygon'] as const;
const SESSION_STATUSES = ['active', 'ended', 'expired'] as const;
const EDIT_LOCK_MS = 30_000;
const PARTICIPANT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_PARTICIPANT_WINDOW_MS = 30_000;

type PermissionTier = (typeof PERMISSION_TIERS)[number];
type GeometryType = (typeof GEOMETRY_TYPES)[number];
type ObjectType = (typeof OBJECT_TYPES)[number];
type SessionStatus = (typeof SESSION_STATUSES)[number];

type CreateSessionBody = {
  incidentName?: string;
  commanderName?: string;
  commanderICSRole?: string;
  operationalPeriodStart?: string;
  operationalPeriodEnd?: string;
};

type JoinSessionBody = {
  joinCode?: string;
  displayName?: string;
  permissionTier?: string;
  icsRole?: string;
};

type MutationBody = {
  mutations?: Array<{
    clientMutationId?: string;
    objectId?: string;
    mutationType?: string;
    objectType?: string;
    geometryType?: string;
    geometry?: unknown;
    fields?: unknown;
    baseVersion?: number;
  }>;
};

type MapMutationInput = NonNullable<MutationBody['mutations']>[number];

type UpdateOperationalPeriodBody = {
  operationalPeriodStart?: string;
  operationalPeriodEnd?: string;
};

type UpdateIncidentCommandBody = {
  commanderName?: string;
};

type LockBody = {
  baseVersion?: number;
};

type MutationHistoryQuery = {
  sinceVersion?: string;
  limit?: string;
};

type CollabSessionRow = {
  id: string;
  trainer_ref: string;
  incident_name: string;
  commander_name: string;
  commander_ics_role: string;
  join_code: string;
  join_code_expires_at: string;
  session_status: SessionStatus;
  operational_period_start: string;
  operational_period_end: string;
  last_mutation_version: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type CollabParticipantRow = {
  id: string;
  session_id: string;
  trainer_ref: string | null;
  display_name: string;
  permission_tier: PermissionTier;
  ics_role: string;
  joined_at: string;
  last_seen_at: string;
  session_token_hash: string | null;
  token_expires_at: string | null;
};

type CollabObjectRow = {
  id: string;
  session_id: string;
  object_type: ObjectType;
  geometry_type: GeometryType;
  geometry_json: unknown;
  fields_json: unknown;
  created_by_participant_id: string;
  updated_by_participant_id: string;
  version: string;
  is_deleted: boolean;
  active_lock_participant_id: string | null;
  lock_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type CollabMutationRow = {
  id: string;
  session_id: string;
  object_id: string;
  version: string;
  participant_id: string;
  mutation_type: 'create' | 'update' | 'delete';
  base_version: string;
  payload_json: unknown;
  created_at: string;
};

type SessionActor =
  | {
      actorType: 'participant';
      participant: CollabParticipantRow;
      session: CollabSessionRow;
    }
  | {
      actorType: 'commander';
      participant: CollabParticipantRow;
      session: CollabSessionRow;
      trainerRef: string;
    };

export const collabRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/ics-collab/meta', async () => ({
    permissionTiers: PERMISSION_TIERS,
    icsRoles: ICS_ROLES,
    objectTypes: OBJECT_TYPES,
    geometryTypes: GEOMETRY_TYPES,
    editLockSeconds: EDIT_LOCK_MS / 1000,
    runtimeConfig: {
      supabaseUrl: app.config.supabaseUrl,
      supabaseAnonKey: app.config.supabaseAnonKey,
      publicBaseUrl: app.config.icsCollabPublicBaseUrl
    }
  }));

  app.get<{ Params: { joinCode: string } }>('/v1/ics-collab/view/:joinCode', async (request, reply) => {
    try {
      const joinCode = normalizeJoinCode(request.params.joinCode);
      if (!joinCode) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid join code is required.' });
      }
      const session = await fetchSessionByJoinCode(app.pg, joinCode);
      if (!session) {
        throw new NotFoundError('Collaborative session not found for viewer link.');
      }
      const refreshed = await refreshSessionStatusIfExpired(app.pg, session.id);
      const snapshot = await buildSessionSnapshot(app.pg, refreshed.id);
      return reply.send({
        session: mapSession(refreshed, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        snapshot
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative viewer session.');
    }
  });

  app.get<{ Params: { joinCode: string }; Querystring: { sinceVersion?: string } }>('/v1/ics-collab/view/:joinCode/deltas', async (request, reply) => {
    try {
      const joinCode = normalizeJoinCode(request.params.joinCode);
      if (!joinCode) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid join code is required.' });
      }
      const sinceVersion = clampNonNegativeInt(request.query?.sinceVersion ?? '0');
      const session = await fetchSessionByJoinCode(app.pg, joinCode);
      if (!session) {
        throw new NotFoundError('Collaborative session not found for viewer link.');
      }
      const refreshed = await refreshSessionStatusIfExpired(app.pg, session.id);
      const deltas = await listMutationsSince(app.pg, refreshed.id, sinceVersion);
      return reply.send({
        session: mapSession(refreshed, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        sinceVersion,
        currentVersion: Number(refreshed.last_mutation_version),
        deltas: deltas.map(mapMutation)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative viewer deltas.');
    }
  });

  app.get('/v1/ics-collab/sessions', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const result = await app.pg.query<CollabSessionRow>(
        `
          select
            id::text as id,
            trainer_ref,
            incident_name,
            commander_name,
            commander_ics_role,
            join_code,
            join_code_expires_at,
            session_status,
            operational_period_start,
            operational_period_end,
            last_mutation_version::text as last_mutation_version,
            ended_at,
            created_at,
            updated_at
          from collab_map_sessions
          where trainer_ref = $1
          order by created_at desc
        `,
        [trainer.trainerRef]
      );
      return reply.send(result.rows.map((row) => mapSession(row, app.config.icsCollabPublicBaseUrl ?? request.headers.origin)));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to list collaborative sessions.');
    }
  });

  app.get('/v1/ics-collab/sessions/active', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const result = await app.pg.query<{
        id: string;
        incident_name: string;
        join_code: string;
        operational_period_start: string;
        operational_period_end: string;
        session_status: SessionStatus;
        owner_name: string | null;
        owner_trainer_ref: string;
        commander_name: string;
      }>(
        `
          select
            s.id::text as id,
            s.incident_name,
            s.join_code,
            s.operational_period_start,
            s.operational_period_end,
            s.session_status,
            t.display_name as owner_name,
            s.trainer_ref as owner_trainer_ref,
            s.commander_name
          from collab_map_sessions s
          left join trainers t
            on t.trainer_ref = s.trainer_ref
          where s.session_status = 'active'
            and s.operational_period_end > now()
          order by s.created_at desc
        `
      );
      return reply.send(result.rows.map((row) => ({
        id: row.id,
        incidentName: row.incident_name,
        joinCode: row.join_code,
        operationalPeriodStart: row.operational_period_start,
        operationalPeriodEnd: row.operational_period_end,
        status: row.session_status,
        ownerName: row.owner_name ?? 'Owner',
        ownerTrainerRef: row.owner_trainer_ref,
        commanderName: row.commander_name,
        isOwner: row.owner_trainer_ref === trainer.trainerRef
      })));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to list active collaborative sessions.');
    }
  });

  app.post<{ Body: CreateSessionBody }>('/v1/ics-collab/sessions', async (request, reply) => {
    const incidentName = normalizeRequiredText(request.body?.incidentName, 'incidentName');
    const commanderICSRole = 'Incident Commander';
    const operationalPeriodStart = parseRequiredDate(request.body?.operationalPeriodStart, 'operationalPeriodStart');
    const operationalPeriodEnd = parseRequiredDate(request.body?.operationalPeriodEnd, 'operationalPeriodEnd');
    if (!incidentName || !operationalPeriodStart || !operationalPeriodEnd) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'incidentName, operationalPeriodStart, and operationalPeriodEnd are required.' });
    }
    if (operationalPeriodEnd <= operationalPeriodStart) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Operational period end must be after start.' });
    }

    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const client = await app.pg.connect();
      try {
        await client.query('BEGIN');

        const trainerRow = await upsertTrainer(client, trainer.trainerRef, trainer.displayName);
        const joinCode = await generateUniqueCollabJoinCode(client);
        const sessionInsert = await client.query<CollabSessionRow>(
          `
            insert into collab_map_sessions (
              trainer_id,
              trainer_ref,
              incident_name,
              commander_name,
              commander_ics_role,
              join_code,
              join_code_expires_at,
              session_status,
              operational_period_start,
              operational_period_end
            )
            values ($1::uuid, $2, $3, $4, $5, $6, $7::timestamptz, 'active', $8::timestamptz, $9::timestamptz)
            returning
              id::text as id,
              trainer_ref,
              incident_name,
              commander_name,
              commander_ics_role,
              join_code,
              join_code_expires_at,
              session_status,
              operational_period_start,
              operational_period_end,
              last_mutation_version::text as last_mutation_version,
              ended_at,
              created_at,
              updated_at
          `,
          [
            trainerRow?.id ?? null,
            trainer.trainerRef,
            incidentName,
            normalizeOptionalText(request.body?.commanderName) ?? trainer.displayName,
            commanderICSRole,
            joinCode,
            operationalPeriodEnd.toISOString(),
            operationalPeriodStart.toISOString(),
            operationalPeriodEnd.toISOString()
          ]
        );
        const session = sessionInsert.rows[0];

        const commanderParticipantInsert = await client.query<CollabParticipantRow>(
          `
            insert into collab_map_participants (
              session_id,
              trainer_ref,
              display_name,
              permission_tier,
              ics_role
            )
            values ($1::uuid, $2, $3, 'commander', $4)
            on conflict (session_id, trainer_ref)
            do update set
              display_name = excluded.display_name,
              ics_role = excluded.ics_role,
              last_seen_at = now()
            returning
              id::text as id,
              session_id::text as session_id,
              trainer_ref,
              display_name,
              permission_tier,
              ics_role,
              joined_at,
              last_seen_at,
              session_token_hash,
              token_expires_at
          `,
          [session.id, trainer.trainerRef, normalizeOptionalText(request.body?.commanderName) ?? trainer.displayName, commanderICSRole]
        );

        await client.query('COMMIT');
        return reply.code(201).send({
          session: mapSession(session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
          participant: mapParticipant(commanderParticipantInsert.rows[0]),
          qrPayload: JSON.stringify({ type: 'ics_collab_join', joinCode })
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to create collaborative session.');
    }
  });

  app.post<{ Body: JoinSessionBody }>('/v1/ics-collab/sessions/join', async (request, reply) => {
    const joinCode = normalizeJoinCode(request.body?.joinCode);
    const displayName = normalizeRequiredText(request.body?.displayName, 'displayName');
    const requestedPermission = normalizePermissionTier(request.body?.permissionTier) ?? 'operator';
    const icsRole = normalizeICSRole(request.body?.icsRole);
    if (!joinCode || !displayName || !icsRole) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'joinCode, displayName, and icsRole are required.' });
    }
    if (requestedPermission === 'commander') {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Participants cannot join as session owner.' });
    }
    if (icsRole === 'Incident Commander') {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Incident Commander is assigned by the session owner.' });
    }

    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const identity = await requireTrainerIdentity(app, request.headers);
      const session = await fetchSessionByJoinCode(client, joinCode);
      if (!session) {
        throw new NotFoundError('Session not found for join code.');
      }
      const refreshedSession = await refreshSessionStatusIfExpired(client, session.id);
      const effectivePermission: PermissionTier = refreshedSession.session_status === 'active' ? requestedPermission : 'observer';
      const token = createParticipantToken();
      const participantUpsert = await client.query<CollabParticipantRow>(
        `
          insert into collab_map_participants (
            session_id,
            trainer_ref,
            display_name,
            permission_tier,
            ics_role,
            session_token_hash,
            token_expires_at,
            last_seen_at
          )
          values ($1::uuid, $2, $3, $4, $5, $6, $7::timestamptz, now())
          on conflict (session_id, trainer_ref)
          do update set
            display_name = excluded.display_name,
            permission_tier = excluded.permission_tier,
            ics_role = excluded.ics_role,
            session_token_hash = excluded.session_token_hash,
            token_expires_at = excluded.token_expires_at,
            last_seen_at = now()
          returning
            id::text as id,
            session_id::text as session_id,
            trainer_ref,
            display_name,
            permission_tier,
            ics_role,
            joined_at,
            last_seen_at,
            session_token_hash,
            token_expires_at
        `,
        [refreshedSession.id, identity.trainerRef, displayName, effectivePermission, icsRole, token.hash, token.expiresAt]
      );
      const snapshot = await buildSessionSnapshot(client, refreshedSession.id);
      await client.query('COMMIT');
      return reply.send({
        session: mapSession(refreshedSession, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        participant: mapParticipant(participantUpsert.rows[0]),
        token: {
          accessToken: token.raw,
          expiresAt: token.expiresAt
        },
        snapshot
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendRouteError(reply, request, error, 'Failed to join collaborative session.');
    } finally {
      client.release();
    }
  });

  app.get<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/snapshot', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const snapshot = await buildSessionSnapshot(app.pg, actor.session.id);
      return reply.send({
        session: mapSession(actor.session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        actor: mapParticipant(actor.participant),
        snapshot
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative snapshot.');
    }
  });

  app.get<{ Params: { sessionId: string }; Querystring: { sinceVersion?: string } }>('/v1/ics-collab/sessions/:sessionId/deltas', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const sinceVersion = clampNonNegativeInt(request.query?.sinceVersion ?? '0');
      const refreshed = await refreshSessionStatusIfExpired(app.pg, actor.session.id);
      const deltas = await listMutationsSince(app.pg, actor.session.id, sinceVersion);
      return reply.send({
        session: mapSession(refreshed, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        sinceVersion,
        currentVersion: Number(refreshed.last_mutation_version),
        deltas: deltas.map(mapMutation)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative deltas.');
    }
  });

  app.get<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/participants', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const participants = await listParticipants(app.pg, actor.session.id);
      return reply.send(participants.map(mapParticipant));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative participants.');
    }
  });

  app.get<{ Params: { sessionId: string }; Querystring: MutationHistoryQuery }>('/v1/ics-collab/sessions/:sessionId/mutations', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const sinceVersion = Number.parseInt(String(request.query?.sinceVersion ?? '-1'), 10);
      const requestedLimit = Number.parseInt(String(request.query?.limit ?? '5000'), 10);
      const safeLimit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, 10000))
        : 5000;
      const mutations = await listMutationsSince(app.pg, actor.session.id, Number.isFinite(sinceVersion) ? sinceVersion : -1, safeLimit);
      const refreshed = await refreshSessionStatusIfExpired(app.pg, actor.session.id);
      return reply.send({
        session: mapSession(refreshed, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        currentVersion: Number(refreshed.last_mutation_version),
        mutations: mutations.map(mapMutation)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative mutation history.');
    }
  });

  app.patch<{ Params: { sessionId: string }; Body: UpdateOperationalPeriodBody }>('/v1/ics-collab/sessions/:sessionId/operational-period', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      const operationalPeriodStart = parseRequiredDate(request.body?.operationalPeriodStart, 'operationalPeriodStart');
      const operationalPeriodEnd = parseRequiredDate(request.body?.operationalPeriodEnd, 'operationalPeriodEnd');
      if (!operationalPeriodStart || !operationalPeriodEnd || operationalPeriodEnd <= operationalPeriodStart) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid operationalPeriodStart and operationalPeriodEnd are required.' });
      }
      const result = await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set
            operational_period_start = $2::timestamptz,
            operational_period_end = $3::timestamptz,
            session_status = case when session_status = 'ended' then session_status else 'active' end,
            ended_at = case when session_status = 'ended' then ended_at else null end
          where id = $1::uuid
          returning
            id::text as id,
            trainer_ref,
            incident_name,
            commander_name,
            commander_ics_role,
            join_code,
            join_code_expires_at,
            session_status,
            operational_period_start,
            operational_period_end,
            last_mutation_version::text as last_mutation_version,
            ended_at,
            created_at,
            updated_at
        `,
        [actor.session.id, operationalPeriodStart.toISOString(), operationalPeriodEnd.toISOString()]
      );
      return reply.send(mapSession(result.rows[0], app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to update operational period.');
    }
  });

  app.patch<{ Params: { sessionId: string }; Body: UpdateIncidentCommandBody }>('/v1/ics-collab/sessions/:sessionId/incident-command', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      const commanderName = normalizeRequiredText(request.body?.commanderName, 'commanderName');
      if (!commanderName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'commanderName is required.' });
      }
      const result = await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set
            commander_name = $2,
            commander_ics_role = 'Incident Commander'
          where id = $1::uuid
          returning
            id::text as id,
            trainer_ref,
            incident_name,
            commander_name,
            commander_ics_role,
            join_code,
            join_code_expires_at,
            session_status,
            operational_period_start,
            operational_period_end,
            last_mutation_version::text as last_mutation_version,
            ended_at,
            created_at,
            updated_at
        `,
        [actor.session.id, commanderName]
      );
      return reply.send(mapSession(result.rows[0], app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to update Incident Commander assignment.');
    }
  });

  app.post<{ Params: { sessionId: string }; Body: MutationBody }>('/v1/ics-collab/sessions/:sessionId/mutations', async (request, reply) => {
    const mutations = Array.isArray(request.body?.mutations) ? request.body!.mutations! : [];
    if (mutations.length === 0) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'mutations array is required.' });
    }

    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const actor = await resolveSessionActorWithClient(client, app, request.params.sessionId, request.headers.authorization);
      const session = await refreshSessionStatusIfExpired(client, actor.session.id);
      if (session.session_status !== 'active') {
        throw new ConflictError('Session is read-only.');
      }
      if (actor.participant.permission_tier === 'observer') {
        throw new TrainerForbiddenError('Observers cannot modify the map.');
      }

      const applied: Array<Record<string, unknown>> = [];
      for (const mutation of mutations) {
        const result = await applyMutation(client, session, actor, mutation);
        applied.push(result);
      }

      await touchParticipant(client, actor.participant.id);
      await client.query('COMMIT');
      const updatedSession = await fetchSessionByID(app.pg, actor.session.id);
      return reply.send({
        session: mapSession(updatedSession ?? session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        applied
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendRouteError(reply, request, error, 'Failed to apply collaborative mutations.');
    } finally {
      client.release();
    }
  });

  app.post<{ Params: { sessionId: string; objectId: string }; Body: LockBody }>('/v1/ics-collab/sessions/:sessionId/objects/:objectId/lock', async (request, reply) => {
    const baseVersion = Number(request.body?.baseVersion ?? 0);
    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const actor = await resolveSessionActorWithClient(client, app, request.params.sessionId, request.headers.authorization);
      const session = await refreshSessionStatusIfExpired(client, actor.session.id);
      if (session.session_status !== 'active') {
        throw new ConflictError('Session is read-only.');
      }
      if (actor.participant.permission_tier === 'observer') {
        throw new TrainerForbiddenError('Observers cannot lock objects.');
      }
      const object = await getObjectForUpdate(client, actor.session.id, request.params.objectId);
      ensureObjectMutationAllowed(actor, object);
      const currentVersion = Number(object.version);
      if (baseVersion !== currentVersion) {
        throw new ConflictError('Object version is out of date.');
      }
      const lockExpiresAt = new Date(Date.now() + EDIT_LOCK_MS).toISOString();
      if (object.active_lock_participant_id && object.active_lock_participant_id !== actor.participant.id && object.lock_expires_at && new Date(object.lock_expires_at).getTime() > Date.now() && actor.participant.permission_tier !== 'commander') {
        throw new ConflictError('Object is being edited by another participant.');
      }
      const updated = await client.query<CollabObjectRow>(
        `
          update collab_map_objects
          set
            active_lock_participant_id = $3::uuid,
            lock_expires_at = $4::timestamptz
          where id = $1::uuid
            and session_id = $2::uuid
          returning
            id::text as id,
            session_id::text as session_id,
            object_type,
            geometry_type,
            geometry_json,
            fields_json,
            created_by_participant_id::text as created_by_participant_id,
            updated_by_participant_id::text as updated_by_participant_id,
            version::text as version,
            is_deleted,
            active_lock_participant_id::text as active_lock_participant_id,
            lock_expires_at,
            created_at,
            updated_at
        `,
        [object.id, actor.session.id, actor.participant.id, lockExpiresAt]
      );
      await touchParticipant(client, actor.participant.id);
      await client.query('COMMIT');
      return reply.send({ object: mapObject(updated.rows[0]), lockExpiresAt });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendRouteError(reply, request, error, 'Failed to acquire object lock.');
    } finally {
      client.release();
    }
  });

  app.delete<{ Params: { sessionId: string; objectId: string } }>('/v1/ics-collab/sessions/:sessionId/objects/:objectId/lock', async (request, reply) => {
    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const actor = await resolveSessionActorWithClient(client, app, request.params.sessionId, request.headers.authorization);
      const object = await getObjectForUpdate(client, actor.session.id, request.params.objectId);
      if (object.active_lock_participant_id && object.active_lock_participant_id !== actor.participant.id && actor.participant.permission_tier !== 'commander') {
        throw new TrainerForbiddenError('Only the lock holder or session owner can release this lock.');
      }
      const updated = await client.query<CollabObjectRow>(
        `
          update collab_map_objects
          set
            active_lock_participant_id = null,
            lock_expires_at = null
          where id = $1::uuid
            and session_id = $2::uuid
          returning
            id::text as id,
            session_id::text as session_id,
            object_type,
            geometry_type,
            geometry_json,
            fields_json,
            created_by_participant_id::text as created_by_participant_id,
            updated_by_participant_id::text as updated_by_participant_id,
            version::text as version,
            is_deleted,
            active_lock_participant_id::text as active_lock_participant_id,
            lock_expires_at,
            created_at,
            updated_at
        `,
        [object.id, actor.session.id]
      );
      await touchParticipant(client, actor.participant.id);
      await client.query('COMMIT');
      return reply.send({ object: mapObject(updated.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendRouteError(reply, request, error, 'Failed to release object lock.');
    } finally {
      client.release();
    }
  });

  app.post<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/leave', async (request, reply) => {
    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const actor = await resolveSessionActorWithClient(client, app, request.params.sessionId, request.headers.authorization);
      await leaveSession(client, actor.participant);
      await client.query('COMMIT');
      return reply.send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendRouteError(reply, request, error, 'Failed to leave collaborative session.');
    } finally {
      client.release();
    }
  });

  app.post<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/end', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      const result = await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set
            session_status = 'ended',
            ended_at = now()
          where id = $1::uuid
          returning
            id::text as id,
            trainer_ref,
            incident_name,
            commander_name,
            commander_ics_role,
            join_code,
            join_code_expires_at,
            session_status,
            operational_period_start,
            operational_period_end,
            last_mutation_version::text as last_mutation_version,
            ended_at,
            created_at,
            updated_at
        `,
        [actor.session.id]
      );
      return reply.send(mapSession(result.rows[0], app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to end collaborative session.');
    }
  });
};

async function resolveSessionActor(
  app: { pg: { connect: () => Promise<PoolClient> } } & Parameters<FastifyPluginAsync>[0],
  sessionID: string,
  authorization?: string,
  options: { requireCommander?: boolean } = {}
): Promise<SessionActor> {
  const client = await app.pg.connect();
  try {
    return await resolveSessionActorWithClient(client, app, sessionID, authorization, options);
  } finally {
    client.release();
  }
}

async function resolveSessionActorWithClient(
  client: PoolClient,
  app: Parameters<FastifyPluginAsync>[0],
  sessionID: string,
  authorization?: string,
  options: { requireCommander?: boolean } = {}
): Promise<SessionActor> {
  const bearer = extractBearerToken(authorization);
  const session = await fetchSessionByID(client, sessionID);
  if (!session) {
    throw new TrainerTargetNotFoundError('Collaborative session not found.');
  }
  await refreshSessionStatusIfExpired(client, session.id);
  const currentSession = (await fetchSessionByID(client, session.id)) ?? session;

  if (bearer) {
    const participant = await fetchParticipantByToken(client, currentSession.id, bearer);
    if (participant) {
      if (options.requireCommander && participant.permission_tier !== 'commander') {
        throw new TrainerForbiddenError('Commander access is required.');
      }
      return { actorType: 'participant', participant, session: currentSession };
    }
  }

  const trainer = await requireTrainerIdentity(app, {
    authorization,
    'x-trainer-ref': undefined
  });
  if (trainer.trainerRef !== currentSession.trainer_ref) {
    throw new TrainerForbiddenError('Commander does not have access to this collaborative session.');
  }
  let commanderParticipant = await fetchCommanderParticipant(client, currentSession.id, trainer.trainerRef);
  if (!commanderParticipant) {
    commanderParticipant = await upsertCommanderParticipant(
      client,
      currentSession.id,
      trainer.trainerRef,
      trainer.displayName,
      'Incident Commander'
    );
  }
  await touchParticipant(client, commanderParticipant.id);
  if (options.requireCommander && commanderParticipant.permission_tier !== 'commander') {
    throw new TrainerForbiddenError('Commander access is required.');
  }
  return {
    actorType: 'commander',
    participant: commanderParticipant,
    session: currentSession,
    trainerRef: trainer.trainerRef
  };
}

async function applyMutation(
  client: PoolClient,
  session: CollabSessionRow,
  actor: SessionActor,
  mutation: MapMutationInput
) {
  const mutationType = normalizeMutationType(mutation?.mutationType);
  if (!mutationType) {
    throw new ValidationError('Each mutation requires a valid mutationType.');
  }

  if (mutationType === 'create') {
    const objectType = normalizeObjectType(mutation?.objectType);
    const geometryType = normalizeGeometryType(mutation?.geometryType);
    if (!objectType || !geometryType) {
      throw new ValidationError('Create mutations require objectType and geometryType.');
    }
    const nextVersion = await nextSessionVersion(client, session.id);
    const objectID = normalizeUUID(mutation?.objectId) ?? randomUUID();
    const inserted = await client.query<CollabObjectRow>(
      `
        insert into collab_map_objects (
          id,
          session_id,
          object_type,
          geometry_type,
          geometry_json,
          fields_json,
          created_by_participant_id,
          updated_by_participant_id,
          version
        )
        values ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7::uuid, $7::uuid, $8)
        returning
          id::text as id,
          session_id::text as session_id,
          object_type,
          geometry_type,
          geometry_json,
          fields_json,
          created_by_participant_id::text as created_by_participant_id,
          updated_by_participant_id::text as updated_by_participant_id,
          version::text as version,
          is_deleted,
          active_lock_participant_id::text as active_lock_participant_id,
          lock_expires_at,
          created_at,
          updated_at
      `,
      [
        objectID,
        session.id,
        objectType,
        geometryType,
        JSON.stringify(normalizeGeometryPayload(mutation?.geometry, geometryType)),
        JSON.stringify(normalizeFieldsPayload(mutation?.fields)),
        actor.participant.id,
        nextVersion
      ]
    );
    await insertMutationRecord(client, {
      sessionID: session.id,
      objectID,
      participantID: actor.participant.id,
      version: nextVersion,
      mutationType: 'create',
      baseVersion: 0,
      payload: {
        clientMutationId: mutation?.clientMutationId ?? null,
        object: mapObject(inserted.rows[0])
      }
    });
    return {
      mutationType: 'create',
      object: mapObject(inserted.rows[0]),
      version: nextVersion
    };
  }

  const objectID = normalizeUUID(mutation?.objectId);
  if (!objectID) {
    throw new ValidationError('Update and delete mutations require objectId.');
  }
  const object = await getObjectForUpdate(client, session.id, objectID);
  ensureObjectMutationAllowed(actor, object);
  const currentVersion = Number(object.version);
  const baseVersion = Number(mutation?.baseVersion ?? -1);
  if (baseVersion !== currentVersion) {
    throw new ConflictError(`Object ${objectID} is out of date.`);
  }
  if (object.active_lock_participant_id && object.active_lock_participant_id !== actor.participant.id && object.lock_expires_at && new Date(object.lock_expires_at).getTime() > Date.now() && actor.participant.permission_tier !== 'commander') {
    throw new ConflictError(`Object ${objectID} is being edited by another participant.`);
  }

  const nextVersion = await nextSessionVersion(client, session.id);

  if (mutationType === 'delete') {
    const deleted = await client.query<CollabObjectRow>(
      `
        update collab_map_objects
        set
          is_deleted = true,
          updated_by_participant_id = $3::uuid,
          version = $4,
          active_lock_participant_id = null,
          lock_expires_at = null
        where id = $1::uuid
          and session_id = $2::uuid
        returning
          id::text as id,
          session_id::text as session_id,
          object_type,
          geometry_type,
          geometry_json,
          fields_json,
          created_by_participant_id::text as created_by_participant_id,
          updated_by_participant_id::text as updated_by_participant_id,
          version::text as version,
          is_deleted,
          active_lock_participant_id::text as active_lock_participant_id,
          lock_expires_at,
          created_at,
          updated_at
      `,
      [objectID, session.id, actor.participant.id, nextVersion]
    );
    await insertMutationRecord(client, {
      sessionID: session.id,
      objectID,
      participantID: actor.participant.id,
      version: nextVersion,
      mutationType: 'delete',
      baseVersion,
      payload: {
        clientMutationId: mutation?.clientMutationId ?? null
      }
    });
    return {
      mutationType: 'delete',
      object: mapObject(deleted.rows[0]),
      version: nextVersion
    };
  }

  const geometryType = normalizeGeometryType(mutation?.geometryType ?? object.geometry_type);
  if (!geometryType) {
    throw new ValidationError('Update mutation requires a valid geometryType.');
  }
  const updatedGeometry = mutation?.geometry == null ? object.geometry_json : normalizeGeometryPayload(mutation.geometry, geometryType);
  const updatedFields = mutation?.fields == null ? object.fields_json : normalizeFieldsPayload(mutation.fields);
  const updated = await client.query<CollabObjectRow>(
    `
      update collab_map_objects
      set
        geometry_type = $3,
        geometry_json = $4::jsonb,
        fields_json = $5::jsonb,
        updated_by_participant_id = $6::uuid,
        version = $7,
        active_lock_participant_id = null,
        lock_expires_at = null
      where id = $1::uuid
        and session_id = $2::uuid
      returning
        id::text as id,
        session_id::text as session_id,
        object_type,
        geometry_type,
        geometry_json,
        fields_json,
        created_by_participant_id::text as created_by_participant_id,
        updated_by_participant_id::text as updated_by_participant_id,
        version::text as version,
        is_deleted,
        active_lock_participant_id::text as active_lock_participant_id,
        lock_expires_at,
        created_at,
        updated_at
    `,
    [objectID, session.id, geometryType, JSON.stringify(updatedGeometry), JSON.stringify(updatedFields), actor.participant.id, nextVersion]
  );
  await insertMutationRecord(client, {
    sessionID: session.id,
    objectID,
    participantID: actor.participant.id,
    version: nextVersion,
    mutationType: 'update',
    baseVersion,
    payload: {
      clientMutationId: mutation?.clientMutationId ?? null,
      geometryType,
      geometry: updatedGeometry,
      fields: updatedFields
    }
  });
  return {
    mutationType: 'update',
    object: mapObject(updated.rows[0]),
    version: nextVersion
  };
}

async function buildSessionSnapshot(pool: { query: PoolClient['query'] }, sessionID: string) {
  const [participants, objects] = await Promise.all([
    listParticipants(pool, sessionID),
    listActiveObjects(pool, sessionID)
  ]);
  return {
    participants: participants.map(mapParticipant),
    objects: objects.map(mapObject)
  };
}

async function listParticipants(pool: { query: PoolClient['query'] }, sessionID: string) {
  const result = await pool.query<CollabParticipantRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        trainer_ref,
        display_name,
        permission_tier,
        ics_role,
        joined_at,
        last_seen_at,
        session_token_hash,
        token_expires_at
      from collab_map_participants
      where session_id = $1::uuid
        and last_seen_at >= now() - ($2::int * interval '1 millisecond')
      order by joined_at asc, display_name asc
    `,
    [sessionID, ACTIVE_PARTICIPANT_WINDOW_MS]
  );
  return result.rows;
}

async function listActiveObjects(pool: { query: PoolClient['query'] }, sessionID: string) {
  const result = await pool.query<CollabObjectRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        object_type,
        geometry_type,
        geometry_json,
        fields_json,
        created_by_participant_id::text as created_by_participant_id,
        updated_by_participant_id::text as updated_by_participant_id,
        version::text as version,
        is_deleted,
        active_lock_participant_id::text as active_lock_participant_id,
        lock_expires_at,
        created_at,
        updated_at
      from collab_map_objects
      where session_id = $1::uuid
        and is_deleted = false
      order by created_at asc
    `,
    [sessionID]
  );
  return result.rows;
}

async function listMutationsSince(pool: { query: PoolClient['query'] }, sessionID: string, sinceVersion: number, limit = 1000) {
  const result = await pool.query<CollabMutationRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        object_id::text as object_id,
        version::text as version,
        participant_id::text as participant_id,
        mutation_type,
        base_version::text as base_version,
        payload_json,
        created_at
      from collab_map_mutations
      where session_id = $1::uuid
        and version > $2
      order by version asc
      limit $3
    `,
    [sessionID, sinceVersion, limit]
  );
  return result.rows;
}

async function fetchSessionByID(pool: { query: PoolClient['query'] }, sessionID: string) {
  const result = await pool.query<CollabSessionRow>(
    `
      select
        id::text as id,
        trainer_ref,
        incident_name,
        commander_name,
        commander_ics_role,
        join_code,
        join_code_expires_at,
        session_status,
        operational_period_start,
        operational_period_end,
        last_mutation_version::text as last_mutation_version,
        ended_at,
        created_at,
        updated_at
      from collab_map_sessions
      where id = $1::uuid
      limit 1
    `,
    [sessionID]
  );
  return result.rows[0] ?? null;
}

async function fetchSessionByJoinCode(pool: { query: PoolClient['query'] }, joinCode: string) {
  const result = await pool.query<CollabSessionRow>(
    `
      select
        id::text as id,
        trainer_ref,
        incident_name,
        commander_name,
        commander_ics_role,
        join_code,
        join_code_expires_at,
        session_status,
        operational_period_start,
        operational_period_end,
        last_mutation_version::text as last_mutation_version,
        ended_at,
        created_at,
        updated_at
      from collab_map_sessions
      where join_code = $1
      limit 1
    `,
    [joinCode]
  );
  return result.rows[0] ?? null;
}

async function fetchParticipantByToken(pool: { query: PoolClient['query'] }, sessionID: string, token: string) {
  const tokenHash = hashToken(token);
  const result = await pool.query<CollabParticipantRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        trainer_ref,
        display_name,
        permission_tier,
        ics_role,
        joined_at,
        last_seen_at,
        session_token_hash,
        token_expires_at
      from collab_map_participants
      where session_id = $1::uuid
        and session_token_hash = $2
        and token_expires_at > now()
      limit 1
    `,
    [sessionID, tokenHash]
  );
  const row = result.rows[0] ?? null;
  if (row) {
    await touchParticipant(pool, row.id);
  }
  return row;
}

async function fetchCommanderParticipant(pool: { query: PoolClient['query'] }, sessionID: string, trainerRef: string) {
  const result = await pool.query<CollabParticipantRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        trainer_ref,
        display_name,
        permission_tier,
        ics_role,
        joined_at,
        last_seen_at,
        session_token_hash,
        token_expires_at
      from collab_map_participants
      where session_id = $1::uuid
        and trainer_ref = $2
        and permission_tier = 'commander'
      limit 1
    `,
    [sessionID, trainerRef]
  );
  return result.rows[0] ?? null;
}

async function upsertCommanderParticipant(
  pool: { query: PoolClient['query'] },
  sessionID: string,
  trainerRef: string,
  displayName: string,
  icsRole: string
) {
  const result = await pool.query<CollabParticipantRow>(
    `
      insert into collab_map_participants (
        session_id,
        trainer_ref,
        display_name,
        permission_tier,
        ics_role,
        last_seen_at
      )
      values ($1::uuid, $2, $3, 'commander', $4, now())
      on conflict (session_id, trainer_ref)
      do update set
        display_name = excluded.display_name,
        permission_tier = 'commander',
        ics_role = excluded.ics_role,
        last_seen_at = now()
      returning
        id::text as id,
        session_id::text as session_id,
        trainer_ref,
        display_name,
        permission_tier,
        ics_role,
        joined_at,
        last_seen_at,
        session_token_hash,
        token_expires_at
    `,
    [sessionID, trainerRef, displayName, icsRole]
  );
  return result.rows[0] ?? null;
}

async function getObjectForUpdate(pool: { query: PoolClient['query'] }, sessionID: string, objectID: string) {
  const result = await pool.query<CollabObjectRow>(
    `
      select
        id::text as id,
        session_id::text as session_id,
        object_type,
        geometry_type,
        geometry_json,
        fields_json,
        created_by_participant_id::text as created_by_participant_id,
        updated_by_participant_id::text as updated_by_participant_id,
        version::text as version,
        is_deleted,
        active_lock_participant_id::text as active_lock_participant_id,
        lock_expires_at,
        created_at,
        updated_at
      from collab_map_objects
      where id = $1::uuid
        and session_id = $2::uuid
      limit 1
      for update
    `,
    [objectID, sessionID]
  );
  const row = result.rows[0] ?? null;
  if (!row) {
    throw new NotFoundError('Map object not found.');
  }
  return row;
}

function ensureObjectMutationAllowed(actor: SessionActor, object: CollabObjectRow) {
  if (actor.participant.permission_tier === 'commander') {
    return;
  }
  if (object.created_by_participant_id !== actor.participant.id) {
    throw new TrainerForbiddenError('Participants can only edit their own objects.');
  }
}

async function nextSessionVersion(pool: { query: PoolClient['query'] }, sessionID: string) {
  const result = await pool.query<{ last_mutation_version: string }>(
    `
      update collab_map_sessions
      set last_mutation_version = last_mutation_version + 1
      where id = $1::uuid
      returning last_mutation_version::text as last_mutation_version
    `,
    [sessionID]
  );
  return Number(result.rows[0].last_mutation_version);
}

async function insertMutationRecord(
  pool: { query: PoolClient['query'] },
  params: {
    sessionID: string;
    objectID: string;
    participantID: string;
    version: number;
    mutationType: 'create' | 'update' | 'delete';
    baseVersion: number;
    payload: unknown;
  }
) {
  await pool.query(
    `
      insert into collab_map_mutations (
        session_id,
        object_id,
        version,
        participant_id,
        mutation_type,
        base_version,
        payload_json
      )
      values ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7::jsonb)
    `,
    [params.sessionID, params.objectID, params.version, params.participantID, params.mutationType, params.baseVersion, JSON.stringify(params.payload ?? {})]
  );
}

async function touchParticipant(pool: { query: PoolClient['query'] }, participantID: string) {
  await pool.query(
    `
      update collab_map_participants
      set last_seen_at = now()
      where id = $1::uuid
    `,
    [participantID]
  );
}

async function leaveSession(pool: { query: PoolClient['query'] }, participant: CollabParticipantRow) {
  await pool.query(
    `
      update collab_map_objects
      set
        active_lock_participant_id = null,
        lock_expires_at = null
      where session_id = $1::uuid
        and active_lock_participant_id = $2::uuid
    `,
    [participant.session_id, participant.id]
  );

  await pool.query(
    `
      update collab_map_participants
      set
        session_token_hash = case when trainer_ref is null then null else session_token_hash end,
        token_expires_at = case when trainer_ref is null then null else token_expires_at end,
        last_seen_at = now() - interval '1 day'
      where id = $1::uuid
    `,
    [participant.id]
  );
}

async function refreshSessionStatusIfExpired(pool: { query: PoolClient['query'] }, sessionID: string) {
  await pool.query(
    `
      update collab_map_sessions
      set
        session_status = 'expired',
        ended_at = coalesce(ended_at, now())
      where id = $1::uuid
        and session_status = 'active'
        and operational_period_end <= now()
    `,
    [sessionID]
  );
  const session = await fetchSessionByID(pool, sessionID);
  if (!session) {
    throw new TrainerTargetNotFoundError('Collaborative session not found.');
  }
  return session;
}

async function upsertTrainer(
  client: PoolClient,
  trainerRef: string,
  trainerName: string
) {
  const result = await client.query<{ id: string }>(
    `
      insert into trainers (trainer_ref, display_name)
      values ($1, $2)
      on conflict (trainer_ref)
      do update set display_name = excluded.display_name
      returning id::text as id
    `,
    [trainerRef, trainerName]
  );
  return result.rows[0] ?? null;
}

async function generateUniqueCollabJoinCode(pool: { query: PoolClient['query'] }) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = generateJoinCode(6);
    try {
      const exists = await pool.query<{ exists: boolean }>(
        `
          select true as exists
          from collab_map_sessions
          where join_code = $1
            and session_status = 'active'
          limit 1
        `,
        [joinCode]
      );
      if (exists.rowCount === 0) {
        return joinCode;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Unable to generate join code.');
}

function createParticipantToken() {
  const raw = `ics_${randomUUID()}${randomUUID().replace(/-/g, '')}`;
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + PARTICIPANT_TOKEN_TTL_MS).toISOString()
  };
}

function generateJoinCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function mapSession(row: CollabSessionRow, publicBaseUrl?: string) {
  let joinUrl: string | null = null;
  if (publicBaseUrl) {
    try {
      const url = new URL(publicBaseUrl);
      url.searchParams.set('join', row.join_code);
      joinUrl = url.toString();
    } catch (_error) {
      joinUrl = `${publicBaseUrl.replace(/\/$/, '')}/?join=${encodeURIComponent(row.join_code)}`;
    }
  }
  return {
    id: row.id,
    trainerRef: row.trainer_ref,
    incidentName: row.incident_name,
    commanderName: row.commander_name,
    commanderICSRole: row.commander_ics_role,
    joinCode: row.join_code,
    joinCodeExpiresAt: row.join_code_expires_at,
    status: row.session_status,
    operationalPeriodStart: row.operational_period_start,
    operationalPeriodEnd: row.operational_period_end,
    currentVersion: Number(row.last_mutation_version),
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    joinUrl
  };
}

function mapParticipant(row: CollabParticipantRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    permissionTier: row.permission_tier,
    icsRole: row.ics_role,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    trainerRef: row.trainer_ref
  };
}

function mapObject(row: CollabObjectRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    objectType: row.object_type,
    geometryType: row.geometry_type,
    geometry: row.geometry_json,
    fields: row.fields_json,
    createdByParticipantId: row.created_by_participant_id,
    updatedByParticipantId: row.updated_by_participant_id,
    version: Number(row.version),
    isDeleted: row.is_deleted,
    activeLockParticipantId: row.active_lock_participant_id,
    lockExpiresAt: row.lock_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMutation(row: CollabMutationRow) {
  return {
    id: Number(row.id),
    sessionId: row.session_id,
    objectId: row.object_id,
    version: Number(row.version),
    participantId: row.participant_id,
    mutationType: row.mutation_type,
    baseVersion: Number(row.base_version),
    payload: row.payload_json,
    createdAt: row.created_at
  };
}

function normalizeRequiredText(value: string | undefined, _field: string) {
  const normalized = normalizeOptionalText(value);
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeJoinCode(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizePermissionTier(value: string | undefined): PermissionTier | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return PERMISSION_TIERS.includes(normalized as PermissionTier) ? (normalized as PermissionTier) : null;
}

function normalizeICSRole(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized && ICS_ROLES.includes(normalized as (typeof ICS_ROLES)[number]) ? normalized : null;
}

function normalizeObjectType(value: string | undefined): ObjectType | null {
  const normalized = normalizeOptionalText(value);
  return normalized && OBJECT_TYPES.includes(normalized as ObjectType) ? (normalized as ObjectType) : null;
}

function normalizeGeometryType(value: string | undefined): GeometryType | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized && GEOMETRY_TYPES.includes(normalized as GeometryType) ? (normalized as GeometryType) : null;
}

function normalizeMutationType(value: string | undefined): 'create' | 'update' | 'delete' | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'create' || normalized === 'update' || normalized === 'delete' ? normalized : null;
}

function normalizeGeometryPayload(payload: unknown, geometryType: GeometryType) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('geometry payload is required.');
  }
  if (geometryType === 'point') {
    const lat = Number((payload as { lat?: unknown }).lat);
    const lng = Number((payload as { lng?: unknown }).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ValidationError('Point geometry requires lat and lng.');
    }
    return { lat, lng };
  }
  if (geometryType === 'line') {
    const points = (payload as { points?: unknown }).points;
    if (!Array.isArray(points) || points.length < 2) {
      throw new ValidationError('Line geometry requires at least 2 points.');
    }
    return { points: normalizePointArray(points, 2) };
  }
  const rings = (payload as { points?: unknown }).points;
  if (!Array.isArray(rings) || rings.length < 3) {
    throw new ValidationError('Polygon geometry requires at least 3 points.');
  }
  return { points: normalizePointArray(rings, 3) };
}

function normalizePointArray(points: unknown[], minimum: number) {
  const normalized = points.map((point) => {
    if (!point || typeof point !== 'object') {
      throw new ValidationError('Invalid point geometry.');
    }
    const lat = Number((point as { lat?: unknown }).lat);
    const lng = Number((point as { lng?: unknown }).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ValidationError('Invalid point geometry.');
    }
    return { lat, lng };
  });
  if (normalized.length < minimum) {
    throw new ValidationError(`Geometry requires at least ${minimum} points.`);
  }
  return normalized;
}

function normalizeFieldsPayload(payload: unknown) {
  if (payload == null) return {};
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('fields must be an object.');
  }
  return payload;
}

function parseRequiredDate(value: string | undefined, _field: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === 'bearer' ? token.trim() : null;
}

function normalizeUUID(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized ?? null;
}

function clampNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sendTrainerError(reply: FastifyReply, request: FastifyRequest, error: unknown, fallbackMessage: string) {
  request.log.error({ err: error }, fallbackMessage);
  if (error instanceof TrainerAuthError) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: error.message });
  }
  if (error instanceof TrainerForbiddenError) {
    return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
  }
  if (error instanceof TrainerTargetNotFoundError) {
    return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
  }
  return reply.code(500).send({ error: 'INTERNAL_ERROR', message: fallbackMessage });
}

function sendRouteError(reply: FastifyReply, request: FastifyRequest, error: unknown, fallbackMessage: string) {
  request.log.error({ err: error }, fallbackMessage);
  if (error instanceof TrainerAuthError) {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: error.message });
  }
  if (error instanceof TrainerForbiddenError) {
    return reply.code(403).send({ error: 'FORBIDDEN', message: error.message });
  }
  if (error instanceof TrainerTargetNotFoundError || error instanceof NotFoundError) {
    return reply.code(404).send({ error: 'NOT_FOUND', message: error.message });
  }
  if (error instanceof ValidationError) {
    return reply.code(400).send({ error: 'BAD_REQUEST', message: error.message });
  }
  if (error instanceof ConflictError) {
    return reply.code(409).send({ error: 'CONFLICT', message: error.message });
  }
  return reply.code(500).send({ error: 'INTERNAL_ERROR', message: fallbackMessage });
}

class ValidationError extends Error {}
class ConflictError extends Error {}
class NotFoundError extends Error {}
