import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config.js';
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

const MAP_NOTE_ALLOWED_ROLES = [
  'Incident Commander',
  'Operations Section Chief',
  'Planning Section Chief',
  'Logistics Section Chief',
  'Safety Officer',
  'HazMat Group Supervisor'
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
  'MeasurementLine',
  'RIT',
  'SafetyHazard',
  'EvacuationZone',
  'MapNote',
  'InitialIsolationZone',
  'ProtectiveActionZone',
  'IconMarker'
] as const;

const GEOMETRY_TYPES = ['point', 'line', 'polygon'] as const;
const SESSION_STATUSES = ['active', 'ended', 'expired'] as const;
const LICENSE_STATUSES = ['active', 'inactive'] as const;
const EDIT_LOCK_MS = 30_000;
const PARTICIPANT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_PARTICIPANT_WINDOW_MS = 30_000;

type PermissionTier = (typeof PERMISSION_TIERS)[number];
type GeometryType = (typeof GEOMETRY_TYPES)[number];
type ObjectType = (typeof OBJECT_TYPES)[number];
type SessionStatus = (typeof SESSION_STATUSES)[number];
type LicenseStatus = (typeof LICENSE_STATUSES)[number];

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

type ImportAttachmentBody = {
  objectId?: string;
  fileName?: string;
  dataUrl?: string;
};

type UpdateOperationalPeriodBody = {
  operationalPeriodStart?: string;
  operationalPeriodEnd?: string;
};

type UpdateIncidentCommandBody = {
  commanderName?: string;
};

type UpdateViewerAccessBody = {
  enabled?: boolean;
};

type UpdateSessionOrgAccessBody = {
  organizationId?: string;
};

type CreateStandingOrganizationAccessBody = {
  sourceOrganizationId?: string;
  targetOrganizationId?: string;
};

type CreateOrganizationMemberBody = {
  email?: string;
  displayName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
};

type UpdateOrganizationMemberBody = {
  displayName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
};

type CreateSuperAdminOrganizationBody = {
  organizationName?: string;
  countyName?: string;
  seatLimit?: number | string | null;
  licenseStatus?: string;
  firstAdminName?: string;
  firstAdminEmail?: string;
  stationName?: string;
  stationAddress?: string;
  stationLat?: number | string | null;
  stationLng?: number | string | null;
  defaultMileageRate?: number | string | null;
};

type UpdateSuperAdminOrganizationBody = {
  organizationName?: string;
  countyName?: string | null;
  seatLimit?: number | string | null;
  licenseStatus?: string;
  stationName?: string | null;
  stationAddress?: string | null;
  stationLat?: number | string | null;
  stationLng?: number | string | null;
  defaultMileageRate?: number | string | null;
};

type UpdateAdminOrganizationBody = {
  stationName?: string | null;
  stationAddress?: string | null;
  stationLat?: number | string | null;
  stationLng?: number | string | null;
  defaultMileageRate?: number | string | null;
};

type UpdateSuperAdminUserBody = {
  displayName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  organizationId?: string;
};

type LockBody = {
  baseVersion?: number;
};

type UpdateCommandStructureBody = {
  incidentId?: string;
  roles?: unknown;
};

type SaveIcs207ExportBody = {
  snapshot?: unknown;
};

type MutationHistoryQuery = {
  sinceVersion?: string;
  limit?: string;
};

type CollabSessionRow = {
  id: string;
  trainer_ref: string;
  organization_id: string | null;
  organization_name: string | null;
  county_name: string | null;
  incident_name: string;
  commander_name: string;
  commander_ics_role: string;
  join_code: string;
  join_code_expires_at: string;
  viewer_access_enabled: boolean;
  session_status: SessionStatus;
  operational_period_start: string;
  operational_period_end: string;
  last_mutation_version: string;
  command_structure_json?: unknown;
  ics207_export_json?: unknown;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommandStructureAssignedUser = {
  userId: string;
  name: string;
};

type CommandStructureRole = {
  roleId: string;
  label: string;
  parent: string | null;
  assignedUser: CommandStructureAssignedUser | null;
  status: 'empty' | 'assigned';
};

type CommandStructureDocument = {
  incidentId: string;
  roles: CommandStructureRole[];
};

type CollabOrganizationRow = {
  id: string;
  organization_name: string;
  license_status: LicenseStatus;
  seat_limit: number | null;
  county_id: string | null;
  county_name: string | null;
  station_name: string | null;
  station_address: string | null;
  station_lat: string | number | null;
  station_lng: string | number | null;
  default_mileage_rate: string | number | null;
  created_at: string;
  updated_at: string;
};

type CollabSuperAdminRow = {
  id: string;
  trainer_ref: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SuperAdminOrganizationRow = CollabOrganizationRow & {
  member_count: number;
  admin_count: number;
  seats_used: number;
  session_count: number;
};

type SuperAdminOverviewRow = {
  organization_count: string;
  active_license_count: string;
  county_count: string;
  user_count: string;
  active_user_count: string;
  shared_session_count: string;
  active_session_count: string;
};

type SuperAdminSessionAccessRow = {
  session_id: string;
  incident_name: string;
  session_status: SessionStatus;
  owner_organization_id: string | null;
  owner_organization_name: string | null;
  shared_organization_id: string;
  shared_organization_name: string;
  shared_county_name: string | null;
  operational_period_end: string;
  updated_at: string;
};

type SuperAdminStandingAccessRow = {
  source_organization_id: string;
  source_organization_name: string;
  source_county_name: string | null;
  target_organization_id: string;
  target_organization_name: string;
  target_county_name: string | null;
  created_by_trainer_ref: string;
  created_at: string;
  updated_at: string;
};

type CollabOrgMembershipRow = {
  id: string;
  organization_id: string;
  trainer_id: string | null;
  trainer_ref: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  is_active: boolean;
  organization_name: string;
  license_status: LicenseStatus;
  seat_limit: number | null;
  county_id: string | null;
  county_name: string | null;
  station_name: string | null;
  station_address: string | null;
  station_lat: string | number | null;
  station_lng: string | number | null;
  default_mileage_rate: string | number | null;
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

type AttachmentStorageConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  bucket: string;
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

  app.get('/v1/ics-collab/org/me', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      const roster = membership.is_admin
        ? await listOrganizationMembers(app.pg, membership.organization_id)
        : [];
      return reply.send({
        membership: mapOrganizationMembership(membership),
        roster: roster.map(mapOrganizationRosterMember)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch department license context.');
    }
  });

  app.get('/v1/ics-collab/super-admin/context', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const superAdmin = await requireSuperAdmin(app.pg, trainer);
      return reply.send({
        profile: mapSuperAdmin(superAdmin)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch super admin context.');
    }
  });

  app.get('/v1/ics-collab/super-admin/overview', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const superAdmin = await requireSuperAdmin(app.pg, trainer);
      const [overview, organizations] = await Promise.all([
        fetchSuperAdminOverview(app.pg),
        listSuperAdminOrganizations(app.pg)
      ]);
      return reply.send({
        profile: mapSuperAdmin(superAdmin),
        counts: mapSuperAdminOverview(overview),
        recentOrganizations: organizations.slice(0, 5).map(mapSuperAdminOrganization)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch super admin overview.');
    }
  });

  app.get('/v1/ics-collab/super-admin/organizations', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const organizations = await listSuperAdminOrganizations(app.pg);
      return reply.send(organizations.map(mapSuperAdminOrganization));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch organizations.');
    }
  });

  app.post<{ Body: CreateSuperAdminOrganizationBody }>('/v1/ics-collab/super-admin/organizations', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const organizationName = normalizeRequiredText(request.body?.organizationName, 'organizationName');
      const countyName = normalizeOptionalText(request.body?.countyName);
      const firstAdminName = normalizeOptionalText(request.body?.firstAdminName);
      const firstAdminEmail = normalizeEmail(request.body?.firstAdminEmail);
      const licenseStatus = normalizeLicenseStatus(request.body?.licenseStatus) ?? 'active';
      const seatLimit = normalizeSeatLimit(request.body?.seatLimit);
      const stationName = normalizeOptionalText(request.body?.stationName);
      const stationAddress = normalizeOptionalText(request.body?.stationAddress);
      const stationLat = normalizeNullableCoordinate(request.body?.stationLat);
      const stationLng = normalizeNullableCoordinate(request.body?.stationLng);
      const defaultMileageRate = normalizeNullableMoney(request.body?.defaultMileageRate);
      if (!organizationName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'organizationName is required.' });
      }
      if ((firstAdminName && !firstAdminEmail) || (!firstAdminName && firstAdminEmail)) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Provide both firstAdminName and firstAdminEmail, or leave both blank.' });
      }
      if (firstAdminEmail) {
        const existingMember = await fetchLicensedCollabMembership(app.pg, firstAdminEmail);
        if (existingMember) {
          return reply.code(409).send({ error: 'MEMBER_EXISTS', message: 'That first-admin email is already assigned to a department.' });
        }
      }
      const countyId = countyName ? await upsertCounty(app.pg, countyName) : null;
      const organization = await createOrganization(app.pg, {
        organizationName,
        countyId,
        licenseStatus,
        seatLimit,
        stationName,
        stationAddress,
        stationLat,
        stationLng,
        defaultMileageRate
      });
      if (!organization) {
        return reply.code(500).send({ error: 'CREATE_FAILED', message: 'Unable to create organization.' });
      }
      let firstAdmin = null;
      if (firstAdminName && firstAdminEmail) {
        firstAdmin = await upsertOrganizationMember(app.pg, {
          organizationId: organization.id,
          trainerRef: firstAdminEmail,
          email: firstAdminEmail,
          displayName: firstAdminName,
          isAdmin: true,
          isActive: true
        });
      }
      const fullOrganization = await fetchSuperAdminOrganizationByID(app.pg, organization.id);
      return reply.code(201).send({
        organization: fullOrganization ? mapSuperAdminOrganization(fullOrganization) : null,
        firstAdmin: firstAdmin ? mapOrganizationRosterMember(firstAdmin) : null
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to create organization.');
    }
  });

  app.patch<{ Params: { organizationId: string }; Body: UpdateSuperAdminOrganizationBody }>('/v1/ics-collab/super-admin/organizations/:organizationId', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const organizationId = normalizeUUID(request.params.organizationId);
      if (!organizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid organizationId is required.' });
      }
      const existing = await fetchOrganizationByID(app.pg, organizationId);
      if (!existing) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Organization not found.' });
      }
      const nextOrganizationName = normalizeOptionalText(request.body?.organizationName) ?? existing.organization_name;
      const requestedCountyName = request.body?.countyName === null ? null : normalizeOptionalText(request.body?.countyName ?? undefined);
      const nextLicenseStatus = normalizeLicenseStatus(request.body?.licenseStatus) ?? existing.license_status;
      const nextSeatLimit = request.body?.seatLimit === undefined
        ? existing.seat_limit
        : normalizeSeatLimit(request.body?.seatLimit);
      const nextStationName = request.body?.stationName === undefined
        ? existing.station_name
        : normalizeOptionalText(request.body?.stationName ?? undefined);
      const nextStationAddress = request.body?.stationAddress === undefined
        ? existing.station_address
        : normalizeOptionalText(request.body?.stationAddress ?? undefined);
      const nextStationLat = request.body?.stationLat === undefined
        ? normalizeNullableCoordinate(existing.station_lat)
        : normalizeNullableCoordinate(request.body?.stationLat);
      const nextStationLng = request.body?.stationLng === undefined
        ? normalizeNullableCoordinate(existing.station_lng)
        : normalizeNullableCoordinate(request.body?.stationLng);
      const nextDefaultMileageRate = request.body?.defaultMileageRate === undefined
        ? normalizeNullableMoney(existing.default_mileage_rate)
        : normalizeNullableMoney(request.body?.defaultMileageRate);
      if (!nextOrganizationName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'organizationName is required.' });
      }
      if (nextSeatLimit != null) {
        const activeCount = await countActiveOrganizationMembers(app.pg, organizationId);
        if (activeCount > nextSeatLimit) {
          return reply.code(409).send({ error: 'SEAT_LIMIT_TOO_LOW', message: 'Seat limit cannot be lower than the current active user count.' });
        }
      }
      const countyId = requestedCountyName == null
        ? null
        : await upsertCounty(app.pg, requestedCountyName);
      const updated = await updateOrganization(app.pg, {
        organizationId,
        organizationName: nextOrganizationName,
        countyId,
        licenseStatus: nextLicenseStatus,
        seatLimit: nextSeatLimit,
        stationName: nextStationName,
        stationAddress: nextStationAddress,
        stationLat: nextStationLat,
        stationLng: nextStationLng,
        defaultMileageRate: nextDefaultMileageRate
      });
      return reply.send({
        organization: updated ? mapSuperAdminOrganization(updated) : null
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to update organization.');
    }
  });

  app.patch<{ Body: UpdateAdminOrganizationBody }>('/v1/ics-collab/admin/organization', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      ensureOrganizationAdmin(membership);
      const existing = await fetchOrganizationByID(app.pg, membership.organization_id);
      if (!existing) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Organization not found.' });
      }
      const updated = await updateOrganization(app.pg, {
        organizationId: membership.organization_id,
        organizationName: existing.organization_name,
        countyId: existing.county_id,
        licenseStatus: existing.license_status,
        seatLimit: existing.seat_limit,
        stationName: request.body?.stationName === undefined ? existing.station_name : normalizeOptionalText(request.body?.stationName ?? undefined),
        stationAddress: request.body?.stationAddress === undefined ? existing.station_address : normalizeOptionalText(request.body?.stationAddress ?? undefined),
        stationLat: request.body?.stationLat === undefined ? normalizeNullableCoordinate(existing.station_lat) : normalizeNullableCoordinate(request.body?.stationLat),
        stationLng: request.body?.stationLng === undefined ? normalizeNullableCoordinate(existing.station_lng) : normalizeNullableCoordinate(request.body?.stationLng),
        defaultMileageRate: request.body?.defaultMileageRate === undefined ? normalizeNullableMoney(existing.default_mileage_rate) : normalizeNullableMoney(request.body?.defaultMileageRate)
      });
      const roster = await listOrganizationMembers(app.pg, membership.organization_id);
      const refreshedMembership = await requireLicensedCollabMembership(app.pg, trainer);
      return reply.send({
        organization: mapOrganizationSummary(refreshedMembership, roster.length, updated),
        roster: roster.map(mapOrganizationRosterMember),
        membership: mapOrganizationMembership(refreshedMembership, updated)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to update department station defaults.');
    }
  });

  app.post<{ Params: { organizationId: string }; Body: CreateOrganizationMemberBody }>('/v1/ics-collab/super-admin/organizations/:organizationId/members', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const organizationId = normalizeUUID(request.params.organizationId);
      const email = normalizeEmail(request.body?.email);
      const displayName = normalizeRequiredText(request.body?.displayName, 'displayName');
      const isAdmin = request.body?.isAdmin === true;
      const isActive = request.body?.isActive !== false;
      if (!organizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid organizationId is required.' });
      }
      if (!email || !displayName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'email and displayName are required.' });
      }
      const organization = await fetchOrganizationByID(app.pg, organizationId);
      if (!organization) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Organization not found.' });
      }
      const existingMember = await fetchLicensedCollabMembership(app.pg, email);
      if (existingMember && existingMember.organization_id !== organizationId) {
        return reply.code(409).send({ error: 'MEMBER_ASSIGNED_ELSEWHERE', message: 'That email is already assigned to another department.' });
      }
      const activeCount = await countActiveOrganizationMembers(app.pg, organizationId);
      const activatingNewSeat = isActive && (!existingMember || !existingMember.is_active);
      if (activatingNewSeat && organization.seat_limit != null && activeCount >= organization.seat_limit) {
        return reply.code(409).send({ error: 'SEAT_LIMIT_REACHED', message: 'Seat limit reached for this department license.' });
      }
      const created = await upsertOrganizationMember(app.pg, {
        organizationId,
        trainerRef: email,
        email,
        displayName,
        isAdmin,
        isActive
      });
      return reply.code(201).send({
        member: mapOrganizationRosterMember(created)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to add user to department.');
    }
  });

  app.get('/v1/ics-collab/super-admin/users', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const users = await listSuperAdminUsers(app.pg);
      return reply.send(users.map(mapSuperAdminUser));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch super admin users.');
    }
  });

  app.patch<{ Params: { memberId: string }; Body: UpdateSuperAdminUserBody }>('/v1/ics-collab/super-admin/users/:memberId', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const memberId = normalizeUUID(request.params.memberId);
      if (!memberId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid memberId is required.' });
      }
      const existing = await fetchOrganizationMemberByID(app.pg, memberId);
      if (!existing) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found.' });
      }
      const nextOrganizationId = normalizeUUID(request.body?.organizationId ?? undefined) ?? existing.organization_id;
      const nextDisplayName = normalizeOptionalText(request.body?.displayName) ?? existing.display_name;
      const nextIsAdmin = typeof request.body?.isAdmin === 'boolean' ? request.body.isAdmin : existing.is_admin;
      const nextIsActive = typeof request.body?.isActive === 'boolean' ? request.body.isActive : existing.is_active;
      if (!nextDisplayName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'displayName is required.' });
      }
      const organization = await fetchOrganizationByID(app.pg, nextOrganizationId);
      if (!organization) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Target organization not found.' });
      }
      const activatingSeat = (!existing.is_active && nextIsActive) || (existing.organization_id !== nextOrganizationId && nextIsActive);
      if (activatingSeat && organization.seat_limit != null) {
        const activeCount = await countActiveOrganizationMembers(app.pg, nextOrganizationId);
        const occupiedSeat = existing.organization_id === nextOrganizationId && existing.is_active ? 1 : 0;
        if (activeCount - occupiedSeat >= organization.seat_limit) {
          return reply.code(409).send({ error: 'SEAT_LIMIT_REACHED', message: 'Seat limit reached for the target department license.' });
        }
      }
      const updated = await updateOrganizationMemberAsSuperAdmin(app.pg, {
        memberId,
        organizationId: nextOrganizationId,
        displayName: nextDisplayName,
        isAdmin: nextIsAdmin,
        isActive: nextIsActive
      });
      return reply.send({
        user: updated ? mapSuperAdminUser(updated) : null
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to update super admin user.');
    }
  });

  app.delete<{ Params: { memberId: string } }>('/v1/ics-collab/super-admin/users/:memberId', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const memberId = normalizeUUID(request.params.memberId);
      if (!memberId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid memberId is required.' });
      }
      const existing = await fetchOrganizationMemberByID(app.pg, memberId);
      if (!existing) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found.' });
      }
      const deletedAuthUser = await deleteSupabaseAuthUserByEmail(resolveSupabaseAdminConfig(app.config), existing.email);
      await deleteOrganizationMember(app.pg, memberId);
      return reply.send({
        deleted: true,
        deletedAuthUser
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to delete super admin user.');
    }
  });

  app.get('/v1/ics-collab/super-admin/access', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const access = await listSuperAdminSessionAccess(app.pg);
      return reply.send(access.map(mapSuperAdminAccess));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch session access.');
    }
  });

  app.get('/v1/ics-collab/super-admin/standing-access', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const access = await listSuperAdminStandingAccess(app.pg);
      return reply.send(access.map(mapSuperAdminStandingAccess));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch standing department access.');
    }
  });

  app.post<{ Body: CreateStandingOrganizationAccessBody }>('/v1/ics-collab/super-admin/standing-access', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const sourceOrganizationId = normalizeUUID(request.body?.sourceOrganizationId);
      const targetOrganizationId = normalizeUUID(request.body?.targetOrganizationId);
      if (!sourceOrganizationId || !targetOrganizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'sourceOrganizationId and targetOrganizationId are required.' });
      }
      if (sourceOrganizationId === targetOrganizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'A department cannot grant standing access to itself.' });
      }
      const [sourceOrganization, targetOrganization] = await Promise.all([
        fetchOrganizationByID(app.pg, sourceOrganizationId),
        fetchOrganizationByID(app.pg, targetOrganizationId)
      ]);
      if (!sourceOrganization || !targetOrganization) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Source or target department not found.' });
      }
      if (sourceOrganization.license_status !== 'active' || targetOrganization.license_status !== 'active') {
        return reply.code(409).send({ error: 'INACTIVE_LICENSE', message: 'Standing access can only be created between active licensed departments.' });
      }
      const created = await createStandingOrganizationAccess(app.pg, {
        sourceOrganizationId,
        targetOrganizationId,
        createdByTrainerRef: trainer.trainerRef
      });
      if (!created) {
        return reply.code(409).send({ error: 'DUPLICATE_STANDING_ACCESS', message: 'Standing department access already exists.' });
      }
      const access = await listSuperAdminStandingAccess(app.pg);
      return reply.code(201).send(access.map(mapSuperAdminStandingAccess));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to create standing department access.');
    }
  });

  app.delete<{ Params: { sourceOrganizationId: string; targetOrganizationId: string } }>('/v1/ics-collab/super-admin/standing-access/:sourceOrganizationId/:targetOrganizationId', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      await requireSuperAdmin(app.pg, trainer);
      const sourceOrganizationId = normalizeUUID(request.params.sourceOrganizationId);
      const targetOrganizationId = normalizeUUID(request.params.targetOrganizationId);
      if (!sourceOrganizationId || !targetOrganizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid sourceOrganizationId and targetOrganizationId are required.' });
      }
      await deleteStandingOrganizationAccess(app.pg, sourceOrganizationId, targetOrganizationId);
      return reply.code(204).send();
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to revoke standing department access.');
    }
  });

  app.get('/v1/ics-collab/admin/organization', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      ensureOrganizationAdmin(membership);
      const roster = await listOrganizationMembers(app.pg, membership.organization_id);
      return reply.send({
        organization: mapOrganizationSummary(membership, roster.length),
        roster: roster.map(mapOrganizationRosterMember)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to fetch department admin workspace.');
    }
  });

  app.post<{ Body: CreateOrganizationMemberBody }>('/v1/ics-collab/admin/organization/members', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      ensureOrganizationAdmin(membership);
      const email = normalizeEmail(request.body?.email);
      const displayName = normalizeRequiredText(request.body?.displayName, 'displayName');
      const isAdmin = request.body?.isAdmin === true;
      const isActive = request.body?.isActive !== false;
      if (!email || !displayName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'email and displayName are required.' });
      }
      const existingMember = await fetchLicensedCollabMembership(app.pg, email);
      if (existingMember && existingMember.organization_id !== membership.organization_id) {
        return reply.code(409).send({ error: 'MEMBER_ASSIGNED_ELSEWHERE', message: 'That email is already assigned to another department.' });
      }
      const organization = await fetchOrganizationByID(app.pg, membership.organization_id);
      if (!organization) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Organization not found.' });
      }
      const activeCount = await countActiveOrganizationMembers(app.pg, membership.organization_id);
      const activatingNewSeat = isActive && (!existingMember || !existingMember.is_active);
      if (activatingNewSeat && organization.seat_limit != null && activeCount >= organization.seat_limit) {
        return reply.code(409).send({ error: 'SEAT_LIMIT_REACHED', message: 'Seat limit reached for this department license.' });
      }
      const created = await upsertOrganizationMember(app.pg, {
        organizationId: membership.organization_id,
        trainerRef: email,
        email,
        displayName,
        isAdmin,
        isActive
      });
      const roster = await listOrganizationMembers(app.pg, membership.organization_id);
      return reply.code(201).send({
        member: mapOrganizationRosterMember(created),
        organization: mapOrganizationSummary(membership, roster.length),
        roster: roster.map(mapOrganizationRosterMember)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to add department user.');
    }
  });

  app.patch<{ Params: { memberId: string }; Body: UpdateOrganizationMemberBody }>('/v1/ics-collab/admin/organization/members/:memberId', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      ensureOrganizationAdmin(membership);
      const memberId = normalizeUUID(request.params.memberId);
      if (!memberId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid memberId is required.' });
      }
      const existing = await fetchOrganizationMemberByID(app.pg, memberId);
      if (!existing || existing.organization_id !== membership.organization_id) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Department member not found.' });
      }
      const nextDisplayName = normalizeOptionalText(request.body?.displayName) ?? existing.display_name;
      const nextIsAdmin = typeof request.body?.isAdmin === 'boolean' ? request.body.isAdmin : existing.is_admin;
      const nextIsActive = typeof request.body?.isActive === 'boolean' ? request.body.isActive : existing.is_active;
      if (!nextDisplayName) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'displayName is required.' });
      }
      const organization = await fetchOrganizationByID(app.pg, membership.organization_id);
      if (!organization) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Organization not found.' });
      }
      if (!existing.is_active && nextIsActive && organization.seat_limit != null) {
        const activeCount = await countActiveOrganizationMembers(app.pg, membership.organization_id);
        if (activeCount >= organization.seat_limit) {
          return reply.code(409).send({ error: 'SEAT_LIMIT_REACHED', message: 'Seat limit reached for this department license.' });
        }
      }
      const updated = await updateOrganizationMember(app.pg, {
        memberId,
        organizationId: membership.organization_id,
        displayName: nextDisplayName,
        isAdmin: nextIsAdmin,
        isActive: nextIsActive
      });
      if (!updated) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Department member not found.' });
      }
      const roster = await listOrganizationMembers(app.pg, membership.organization_id);
      return reply.send({
        member: mapOrganizationRosterMember(updated),
        organization: mapOrganizationSummary(membership, roster.length),
        roster: roster.map(mapOrganizationRosterMember)
      });
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to update department user.');
    }
  });

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
      ensureViewerAccessEnabled(refreshed);
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
      ensureViewerAccessEnabled(refreshed);
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
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
      const result = await app.pg.query<CollabSessionRow & { has_session_share: boolean; has_standing_access: boolean }>(
        `
          select
            s.id::text as id,
            s.trainer_ref,
            s.organization_id::text as organization_id,
            org.organization_name,
            county.county_name,
            s.incident_name,
            s.commander_name,
            s.commander_ics_role,
            s.join_code,
            s.join_code_expires_at,
            s.viewer_access_enabled,
            s.session_status,
            s.operational_period_start,
            s.operational_period_end,
            s.last_mutation_version::text as last_mutation_version,
            s.ended_at,
            s.created_at,
            s.updated_at,
            exists (
              select 1
              from collab_map_session_org_access soa
              where soa.session_id = s.id
                and soa.organization_id = $1::uuid
            ) as has_session_share,
            exists (
              select 1
              from collab_org_standing_access osa
              where (
                  (osa.source_organization_id = s.organization_id and osa.target_organization_id = $1::uuid)
                  or (osa.source_organization_id = $1::uuid and osa.target_organization_id = s.organization_id)
                )
                and (
                  s.session_status = 'active'
                  or s.operational_period_end > now()
                  or s.created_at >= osa.created_at
                )
            ) as has_standing_access
          from collab_map_sessions s
          left join collab_organizations org
            on org.id = s.organization_id
          left join collab_counties county
            on county.id = org.county_id
          where (
            s.organization_id = $1::uuid
            or exists (
              select 1
              from collab_map_session_org_access soa
              where soa.session_id = s.id
                and soa.organization_id = $1::uuid
            )
            or exists (
              select 1
              from collab_org_standing_access osa
              where (
                  (osa.source_organization_id = s.organization_id and osa.target_organization_id = $1::uuid)
                  or (osa.source_organization_id = $1::uuid and osa.target_organization_id = s.organization_id)
                )
                and (
                  s.session_status = 'active'
                  or s.operational_period_end > now()
                  or s.created_at >= osa.created_at
                )
            )
            or (s.organization_id is null and lower(s.trainer_ref) = lower($2))
          )
          order by s.created_at desc
        `,
        [membership.organization_id, trainer.trainerRef]
      );
      return reply.send(result.rows.map((row) => ({
        ...mapSession(row, app.config.icsCollabPublicBaseUrl ?? request.headers.origin),
        isOwner: row.trainer_ref.trim().toLowerCase() === trainer.trainerRef.trim().toLowerCase(),
        accessType: row.organization_id && row.organization_id === membership.organization_id
          ? 'owned'
          : (row.has_session_share ? 'shared' : (row.has_standing_access ? 'standing' : (row.organization_id ? 'shared' : 'legacy')))
      })));
    } catch (error) {
      return sendTrainerError(reply, request, error, 'Failed to list collaborative sessions.');
    }
  });

  app.get('/v1/ics-collab/sessions/active', async (request, reply) => {
    try {
      const trainer = await requireTrainerIdentity(app, request.headers);
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
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
        organization_id: string | null;
        organization_name: string | null;
        has_session_share: boolean;
        has_standing_access: boolean;
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
            s.commander_name,
            s.organization_id::text as organization_id,
            org.organization_name,
            exists (
              select 1
              from collab_map_session_org_access soa
              where soa.session_id = s.id
                and soa.organization_id = $1::uuid
            ) as has_session_share,
            exists (
              select 1
              from collab_org_standing_access osa
              where (
                  (osa.source_organization_id = s.organization_id and osa.target_organization_id = $1::uuid)
                  or (osa.source_organization_id = $1::uuid and osa.target_organization_id = s.organization_id)
                )
            ) as has_standing_access
          from collab_map_sessions s
          left join trainers t
            on t.trainer_ref = s.trainer_ref
          left join collab_organizations org
            on org.id = s.organization_id
          where s.session_status = 'active'
            and s.operational_period_end > now()
            and (
              s.organization_id = $1::uuid
              or exists (
                select 1
                from collab_map_session_org_access soa
                where soa.session_id = s.id
                  and soa.organization_id = $1::uuid
              )
              or exists (
                select 1
                from collab_org_standing_access osa
                where (
                    (osa.source_organization_id = s.organization_id and osa.target_organization_id = $1::uuid)
                    or (osa.source_organization_id = $1::uuid and osa.target_organization_id = s.organization_id)
                  )
              )
              or (s.organization_id is null and lower(s.trainer_ref) = lower($2))
            )
          order by s.created_at desc
        `,
        [membership.organization_id, trainer.trainerRef]
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
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        accessType: row.organization_id && row.organization_id === membership.organization_id
          ? 'owned'
          : (row.has_session_share ? 'shared' : (row.has_standing_access ? 'standing' : (row.organization_id ? 'shared' : 'legacy'))),
        isOwner: row.owner_trainer_ref.trim().toLowerCase() === trainer.trainerRef.trim().toLowerCase()
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
      const membership = await requireLicensedCollabMembership(app.pg, trainer);
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
              organization_id,
              incident_name,
              commander_name,
              commander_ics_role,
              join_code,
              join_code_expires_at,
              viewer_access_enabled,
              session_status,
              operational_period_start,
              operational_period_end
            )
            values ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8::timestamptz, true, 'active', $9::timestamptz, $10::timestamptz)
            returning
              id::text as id,
              trainer_ref,
              organization_id::text as organization_id,
              null::text as organization_name,
              null::text as county_name,
              incident_name,
              commander_name,
              commander_ics_role,
              join_code,
              join_code_expires_at,
              viewer_access_enabled,
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
            membership.organization_id,
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
        session.organization_name = membership.organization_name;
        session.county_name = membership.county_name;

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
      const membership = await requireLicensedCollabMembership(client, identity);
      const session = await fetchSessionByJoinCode(client, joinCode);
      if (!session) {
        throw new NotFoundError('Session not found for join code.');
      }
      await ensureOrganizationSessionAccess(client, session, membership.organization_id, identity.trainerRef);
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
      await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set
            operational_period_start = $2::timestamptz,
            operational_period_end = $3::timestamptz,
            session_status = case when session_status = 'ended' then session_status else 'active' end,
            ended_at = case when session_status = 'ended' then ended_at else null end
          where id = $1::uuid
        `,
        [actor.session.id, operationalPeriodStart.toISOString(), operationalPeriodEnd.toISOString()]
      );
      const refreshed = await fetchSessionByID(app.pg, actor.session.id);
      return reply.send(mapSession(refreshed ?? actor.session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
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
      await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set
            commander_name = $2,
            commander_ics_role = 'Incident Commander'
          where id = $1::uuid
        `,
        [actor.session.id, commanderName]
      );
      const refreshed = await fetchSessionByID(app.pg, actor.session.id);
      return reply.send(mapSession(refreshed ?? actor.session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to update Incident Commander assignment.');
    }
  });

  app.get<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/command-structure', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const session = await fetchSessionByID(app.pg, actor.session.id);
      const source = session ?? actor.session;
      return reply.send({
        hasSavedCommandStructure: Boolean(source.command_structure_json),
        commandStructure: sanitizeCommandStructureDocument(source.command_structure_json, source.id),
        ics207Export: sanitizeIcs207ExportSnapshot(source.ics207_export_json)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch command structure.');
    }
  });

  app.put<{ Params: { sessionId: string }; Body: UpdateCommandStructureBody }>('/v1/ics-collab/sessions/:sessionId/command-structure', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const commandStructure = sanitizeCommandStructureDocument(request.body, actor.session.id);
      const result = await app.pg.query<{ command_structure_json: unknown }>(
        `
          update collab_map_sessions
          set command_structure_json = $2::jsonb
          where id = $1::uuid
          returning command_structure_json
        `,
        [actor.session.id, JSON.stringify(commandStructure)]
      );
      return reply.send({
        hasSavedCommandStructure: true,
        commandStructure: sanitizeCommandStructureDocument(result.rows[0]?.command_structure_json, actor.session.id)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to save command structure.');
    }
  });

  app.post<{ Params: { sessionId: string }; Body: SaveIcs207ExportBody }>('/v1/ics-collab/sessions/:sessionId/ics207-export', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const snapshot = sanitizeIcs207ExportSnapshot(request.body?.snapshot);
      if (!snapshot) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'snapshot object is required.' });
      }
      const result = await app.pg.query<{ ics207_export_json: unknown }>(
        `
          update collab_map_sessions
          set ics207_export_json = $2::jsonb
          where id = $1::uuid
          returning ics207_export_json
        `,
        [actor.session.id, JSON.stringify(snapshot)]
      );
      return reply.send({
        snapshot: sanitizeIcs207ExportSnapshot(result.rows[0]?.ics207_export_json)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to save ICS 207 export snapshot.');
    }
  });

  app.patch<{ Params: { sessionId: string }; Body: UpdateViewerAccessBody }>('/v1/ics-collab/sessions/:sessionId/viewer-access', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      if (typeof request.body?.enabled !== 'boolean') {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'enabled boolean is required.' });
      }
      const result = await app.pg.query<CollabSessionRow>(
        `
          update collab_map_sessions
          set viewer_access_enabled = $2
          where id = $1::uuid
        `,
        [actor.session.id, request.body.enabled]
      );
      const refreshed = await fetchSessionByID(app.pg, actor.session.id);
      return reply.send(mapSession(refreshed ?? actor.session, app.config.icsCollabPublicBaseUrl ?? request.headers.origin));
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to update viewer access.');
    }
  });

  app.get<{ Params: { sessionId: string } }>('/v1/ics-collab/sessions/:sessionId/access', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      ensureOwningCommander(actor);
      const sharedOrganizations = await listSessionSharedOrganizations(app.pg, actor.session.id);
      return reply.send({
        ownerOrganizationId: actor.session.organization_id,
        ownerOrganizationName: actor.session.organization_name,
        sharedOrganizations: sharedOrganizations.map(mapSharedOrganization)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to fetch collaborative session access.');
    }
  });

  app.post<{ Params: { sessionId: string }; Body: UpdateSessionOrgAccessBody }>('/v1/ics-collab/sessions/:sessionId/access/organizations', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      ensureOwningCommander(actor);
      const organizationId = normalizeUUID(request.body?.organizationId);
      if (!organizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'organizationId is required.' });
      }
      if (organizationId === actor.session.organization_id) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Session owner organization already has access.' });
      }
      const organization = await fetchOrganizationByID(app.pg, organizationId);
      if (!organization || organization.license_status !== 'active') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Active organization not found.' });
      }
      await app.pg.query(
        `
          insert into collab_map_session_org_access (session_id, organization_id)
          values ($1::uuid, $2::uuid)
          on conflict (session_id, organization_id) do nothing
        `,
        [actor.session.id, organizationId]
      );
      const sharedOrganizations = await listSessionSharedOrganizations(app.pg, actor.session.id);
      return reply.send({
        ownerOrganizationId: actor.session.organization_id,
        ownerOrganizationName: actor.session.organization_name,
        sharedOrganizations: sharedOrganizations.map(mapSharedOrganization)
      });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to grant collaborative session access.');
    }
  });

  app.delete<{ Params: { sessionId: string; organizationId: string } }>('/v1/ics-collab/sessions/:sessionId/access/organizations/:organizationId', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization, { requireCommander: true });
      ensureOwningCommander(actor);
      const organizationId = normalizeUUID(request.params.organizationId);
      if (!organizationId) {
        return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Valid organizationId is required.' });
      }
      await app.pg.query(
        `
          delete from collab_map_session_org_access
          where session_id = $1::uuid
            and organization_id = $2::uuid
        `,
        [actor.session.id, organizationId]
      );
      return reply.code(204).send();
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to revoke collaborative session access.');
    }
  });

  app.post<{ Params: { sessionId: string }; Body: ImportAttachmentBody }>('/v1/ics-collab/sessions/:sessionId/attachments/import', async (request, reply) => {
    try {
      const actor = await resolveSessionActor(app, request.params.sessionId, request.headers.authorization);
      const session = await refreshSessionStatusIfExpired(app.pg, actor.session.id);
      if (session.session_status !== 'active') {
        throw new ConflictError('Session is read-only.');
      }
      if (actor.participant.permission_tier === 'observer') {
        throw new TrainerForbiddenError('Observers cannot upload attachments.');
      }
      const imported = await importAttachmentToStorage(app.config, session.id, request.body);
      return reply.send({ file: imported });
    } catch (error) {
      return sendRouteError(reply, request, error, 'Failed to import collaborative attachment.');
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
        const result = await applyMutation(client, app.config, session, actor, mutation);
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
            viewer_access_enabled,
            session_status,
            operational_period_start,
            operational_period_end,
            last_mutation_version::text as last_mutation_version,
            ended_at,
            s.created_at,
            s.updated_at
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
  if (trainer.trainerRef.trim().toLowerCase() !== currentSession.trainer_ref.trim().toLowerCase()) {
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
  appConfig: AppConfig,
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
    if (objectType === 'MapNote' && !canManageMapNotes(actor)) {
      throw new TrainerForbiddenError('Only command staff can place map notes.');
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
    const deletedPaths = listAttachmentPaths(object.fields_json);
    if (deletedPaths.length) {
      await deleteAttachmentFiles(resolveAttachmentStorageConfig(appConfig), deletedPaths);
    }
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
  const previousAttachmentPaths = listAttachmentPaths(object.fields_json);
  const nextAttachmentPaths = listAttachmentPaths(updatedFields);
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
  const removedPaths = previousAttachmentPaths.filter((path) => !nextAttachmentPaths.includes(path));
  if (removedPaths.length) {
    await deleteAttachmentFiles(resolveAttachmentStorageConfig(appConfig), removedPaths);
  }
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
        s.id::text as id,
        s.trainer_ref,
        s.organization_id::text as organization_id,
        org.organization_name,
        county.county_name,
        s.incident_name,
        s.commander_name,
        s.commander_ics_role,
        s.join_code,
        s.join_code_expires_at,
        s.viewer_access_enabled,
        s.session_status,
        s.operational_period_start,
        s.operational_period_end,
        s.last_mutation_version::text as last_mutation_version,
        s.command_structure_json,
        s.ics207_export_json,
        s.ended_at,
        s.created_at,
        s.updated_at
      from collab_map_sessions s
      left join collab_organizations org
        on org.id = s.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where s.id = $1::uuid
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
        s.id::text as id,
        s.trainer_ref,
        s.organization_id::text as organization_id,
        org.organization_name,
        county.county_name,
        s.incident_name,
        s.commander_name,
        s.commander_ics_role,
        s.join_code,
        s.join_code_expires_at,
        s.viewer_access_enabled,
        s.session_status,
        s.operational_period_start,
        s.operational_period_end,
        s.last_mutation_version::text as last_mutation_version,
        s.command_structure_json,
        s.ics207_export_json,
        s.ended_at,
        s.created_at,
        s.updated_at
      from collab_map_sessions s
      left join collab_organizations org
        on org.id = s.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where s.join_code = $1
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
  if (object.object_type === 'MapNote' && !canManageMapNotes(actor)) {
    throw new TrainerForbiddenError('Only command staff can edit map notes.');
  }
  if (actor.participant.permission_tier === 'commander') {
    return;
  }
  if (object.created_by_participant_id !== actor.participant.id) {
    throw new TrainerForbiddenError('Participants can only edit their own objects.');
  }
}

function canManageMapNotes(actor: SessionActor) {
  if (actor.participant.permission_tier === 'commander') {
    return true;
  }
  return MAP_NOTE_ALLOWED_ROLES.includes(actor.participant.ics_role as (typeof MAP_NOTE_ALLOWED_ROLES)[number]);
}

function ensureOwningCommander(actor: SessionActor) {
  if (
    actor.actorType !== 'commander'
    || actor.trainerRef.trim().toLowerCase() !== actor.session.trainer_ref.trim().toLowerCase()
  ) {
    throw new TrainerForbiddenError('Only the owning session commander can manage department access.');
  }
}

function ensureOrganizationAdmin(membership: CollabOrgMembershipRow) {
  if (!membership.is_admin) {
    throw new TrainerForbiddenError('Department admin access is required.');
  }
}

async function requireSuperAdmin(
  pool: { query: PoolClient['query'] },
  trainer: { trainerRef: string; displayName: string }
) {
  const superAdmin = await fetchSuperAdmin(pool, trainer.trainerRef);
  if (!superAdmin || !superAdmin.is_active) {
    throw new TrainerForbiddenError('Super admin access is required.');
  }
  return superAdmin;
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

async function requireLicensedCollabMembership(
  pool: { query: PoolClient['query'] },
  trainer: { trainerRef: string; displayName: string }
) {
  const membership = await fetchLicensedCollabMembership(pool, trainer.trainerRef);
  if (!membership || !membership.is_active) {
    throw new TrainerForbiddenError('Your account is not assigned to an active department license.');
  }
  if (membership.license_status !== 'active') {
    throw new TrainerForbiddenError('Your department license is inactive.');
  }
  return membership;
}

async function fetchLicensedCollabMembership(
  pool: { query: PoolClient['query'] },
  trainerRef: string
) {
  const normalized = trainerRef.trim().toLowerCase();
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      select
        m.id::text as id,
        m.organization_id::text as organization_id,
        m.trainer_id::text as trainer_id,
        m.trainer_ref,
        m.email,
        m.display_name,
        m.is_admin,
        m.is_active,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate
      from collab_org_members m
      join collab_organizations org
        on org.id = m.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where lower(m.trainer_ref) = $1
      limit 1
    `,
    [normalized]
  );
  return result.rows[0] ?? null;
}

async function fetchSuperAdmin(
  pool: { query: PoolClient['query'] },
  trainerRef: string
) {
  const normalized = trainerRef.trim().toLowerCase();
  const result = await pool.query<CollabSuperAdminRow>(
    `
      select
        id::text as id,
        trainer_ref,
        email,
        display_name,
        is_active,
        created_at,
        updated_at
      from collab_super_admins
      where lower(trainer_ref) = $1
         or lower(email) = $1
      limit 1
    `,
    [normalized]
  );
  return result.rows[0] ?? null;
}

async function ensureOrganizationSessionAccess(
  pool: { query: PoolClient['query'] },
  session: CollabSessionRow,
  organizationId: string,
  trainerRef: string
) {
  if (!session.organization_id) {
    if (session.trainer_ref === trainerRef) return;
    throw new TrainerForbiddenError('This collaborative session is not available to your department.');
  }
  if (session.organization_id === organizationId) return;
  const shared = await pool.query<{ exists: boolean }>(
    `
      select true as exists
      from collab_map_session_org_access
      where session_id = $1::uuid
        and organization_id = $2::uuid
      limit 1
    `,
    [session.id, organizationId]
  );
  if (shared.rows.length > 0) {
    return;
  }
  const standing = await pool.query<{ exists: boolean }>(
    `
      select true as exists
      from collab_org_standing_access
      where (
          (source_organization_id = $1::uuid and target_organization_id = $2::uuid)
          or (source_organization_id = $2::uuid and target_organization_id = $1::uuid)
        )
        and (
          $3::text = 'active'
          or $4::timestamptz > now()
          or $5::timestamptz >= created_at
        )
      limit 1
    `,
    [session.organization_id, organizationId, session.session_status, session.operational_period_end, session.created_at]
  );
  if (standing.rows.length === 0) {
    throw new TrainerForbiddenError('Your department does not have access to this collaborative session.');
  }
}

async function listOrganizationMembers(pool: { query: PoolClient['query'] }, organizationId: string) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      select
        m.id::text as id,
        m.organization_id::text as organization_id,
        m.trainer_id::text as trainer_id,
        m.trainer_ref,
        m.email,
        m.display_name,
        m.is_admin,
        m.is_active,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate
      from collab_org_members m
      join collab_organizations org
        on org.id = m.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where m.organization_id = $1::uuid
      order by lower(m.display_name), lower(m.email)
    `,
    [organizationId]
  );
  return result.rows;
}

async function countActiveOrganizationMembers(pool: { query: PoolClient['query'] }, organizationId: string) {
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from collab_org_members
      where organization_id = $1::uuid
        and is_active = true
    `,
    [organizationId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function listSuperAdminOrganizations(pool: { query: PoolClient['query'] }) {
  const result = await pool.query<SuperAdminOrganizationRow>(
    `
      select
        org.id::text as id,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate,
        org.created_at,
        org.updated_at,
        count(distinct m.id)::int as member_count,
        count(distinct case when m.is_admin then m.id end)::int as admin_count,
        count(distinct case when m.is_active then m.id end)::int as seats_used,
        count(distinct s.id)::int as session_count
      from collab_organizations org
      left join collab_counties county
        on county.id = org.county_id
      left join collab_org_members m
        on m.organization_id = org.id
      left join collab_map_sessions s
        on s.organization_id = org.id
      group by org.id, county.county_name
      order by lower(org.organization_name)
    `
  );
  return result.rows;
}

async function fetchSuperAdminOrganizationByID(pool: { query: PoolClient['query'] }, organizationId: string) {
  const result = await pool.query<SuperAdminOrganizationRow>(
    `
      select
        org.id::text as id,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate,
        org.created_at,
        org.updated_at,
        count(distinct m.id)::int as member_count,
        count(distinct case when m.is_admin then m.id end)::int as admin_count,
        count(distinct case when m.is_active then m.id end)::int as seats_used,
        count(distinct s.id)::int as session_count
      from collab_organizations org
      left join collab_counties county
        on county.id = org.county_id
      left join collab_org_members m
        on m.organization_id = org.id
      left join collab_map_sessions s
        on s.organization_id = org.id
      where org.id = $1::uuid
      group by org.id, county.county_name
      limit 1
    `,
    [organizationId]
  );
  return result.rows[0] ?? null;
}

async function fetchOrganizationMemberByID(pool: { query: PoolClient['query'] }, memberId: string) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      select
        m.id::text as id,
        m.organization_id::text as organization_id,
        m.trainer_id::text as trainer_id,
        m.trainer_ref,
        m.email,
        m.display_name,
        m.is_admin,
        m.is_active,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate
      from collab_org_members m
      join collab_organizations org
        on org.id = m.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where m.id = $1::uuid
      limit 1
    `,
    [memberId]
  );
  return result.rows[0] ?? null;
}

async function upsertOrganizationMember(
  pool: { query: PoolClient['query'] },
  params: {
    organizationId: string;
    trainerRef: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    isActive: boolean;
  }
) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      insert into collab_org_members (
        organization_id,
        trainer_ref,
        email,
        display_name,
        is_admin,
        is_active
      )
      values ($1::uuid, $2, $3, $4, $5, $6)
      on conflict (trainer_ref)
      do update set
        organization_id = excluded.organization_id,
        email = excluded.email,
        display_name = excluded.display_name,
        is_admin = excluded.is_admin,
        is_active = excluded.is_active
      returning
        id::text as id,
        organization_id::text as organization_id,
        trainer_id::text as trainer_id,
        trainer_ref,
        email,
        display_name,
        is_admin,
        is_active,
        null::text as organization_name,
        'active'::text as license_status,
        null::int as seat_limit,
        null::text as county_id,
        null::text as county_name,
        null::text as station_name,
        null::text as station_address,
        null::numeric as station_lat,
        null::numeric as station_lng,
        null::numeric as default_mileage_rate
    `,
    [params.organizationId, params.trainerRef, params.email, params.displayName, params.isAdmin, params.isActive]
  );
  const member = result.rows[0];
  return (await fetchOrganizationMemberByID(pool, member.id)) ?? member;
}

async function updateOrganizationMember(
  pool: { query: PoolClient['query'] },
  params: {
    memberId: string;
    organizationId: string;
    displayName: string;
    isAdmin: boolean;
    isActive: boolean;
  }
) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      update collab_org_members
      set
        display_name = $3,
        is_admin = $4,
        is_active = $5
      where id = $1::uuid
        and organization_id = $2::uuid
      returning
        id::text as id,
        organization_id::text as organization_id,
        trainer_id::text as trainer_id,
        trainer_ref,
        email,
        display_name,
        is_admin,
        is_active,
        null::text as organization_name,
        'active'::text as license_status,
        null::int as seat_limit,
        null::text as county_id,
        null::text as county_name,
        null::text as station_name,
        null::text as station_address,
        null::numeric as station_lat,
        null::numeric as station_lng,
        null::numeric as default_mileage_rate
    `,
    [params.memberId, params.organizationId, params.displayName, params.isAdmin, params.isActive]
  );
  const member = result.rows[0];
  return member ? ((await fetchOrganizationMemberByID(pool, member.id)) ?? member) : null;
}

async function updateOrganizationMemberAsSuperAdmin(
  pool: { query: PoolClient['query'] },
  params: {
    memberId: string;
    organizationId: string;
    displayName: string;
    isAdmin: boolean;
    isActive: boolean;
  }
) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      update collab_org_members
      set
        organization_id = $2::uuid,
        display_name = $3,
        is_admin = $4,
        is_active = $5
      where id = $1::uuid
      returning
        id::text as id,
        organization_id::text as organization_id,
        trainer_id::text as trainer_id,
        trainer_ref,
        email,
        display_name,
        is_admin,
        is_active,
        null::text as organization_name,
        'active'::text as license_status,
        null::int as seat_limit,
        null::text as county_id,
        null::text as county_name,
        null::text as station_name,
        null::text as station_address,
        null::numeric as station_lat,
        null::numeric as station_lng,
        null::numeric as default_mileage_rate
    `,
    [params.memberId, params.organizationId, params.displayName, params.isAdmin, params.isActive]
  );
  const member = result.rows[0];
  return member ? ((await fetchOrganizationMemberByID(pool, member.id)) ?? member) : null;
}

async function deleteOrganizationMember(pool: { query: PoolClient['query'] }, memberId: string) {
  await pool.query(
    `
      delete from collab_org_members
      where id = $1::uuid
    `,
    [memberId]
  );
}

async function fetchOrganizationByID(pool: { query: PoolClient['query'] }, organizationId: string) {
  const result = await pool.query<CollabOrganizationRow>(
    `
      select
        org.id::text as id,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate,
        org.created_at,
        org.updated_at
      from collab_organizations org
      left join collab_counties county
        on county.id = org.county_id
      where org.id = $1::uuid
      limit 1
    `,
    [organizationId]
  );
  return result.rows[0] ?? null;
}

async function createOrganization(
  pool: { query: PoolClient['query'] },
  params: {
    organizationName: string;
    countyId: string | null;
    licenseStatus: LicenseStatus;
    seatLimit: number | null;
    stationName: string | null;
    stationAddress: string | null;
    stationLat: number | null;
    stationLng: number | null;
    defaultMileageRate: number | null;
  }
) {
  const result = await pool.query<{ id: string }>(
    `
      insert into collab_organizations (
        county_id,
        organization_name,
        license_status,
        seat_limit,
        station_name,
        station_address,
        station_lat,
        station_lng,
        default_mileage_rate
      )
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id::text as id
    `,
    [
      params.countyId,
      params.organizationName,
      params.licenseStatus,
      params.seatLimit,
      params.stationName,
      params.stationAddress,
      params.stationLat,
      params.stationLng,
      params.defaultMileageRate
    ]
  );
  const organizationId = result.rows[0]?.id;
  return organizationId ? await fetchOrganizationByID(pool, organizationId) : null;
}

async function updateOrganization(
  pool: { query: PoolClient['query'] },
  params: {
    organizationId: string;
    organizationName: string;
    countyId: string | null;
    licenseStatus: LicenseStatus;
    seatLimit: number | null;
    stationName: string | null;
    stationAddress: string | null;
    stationLat: number | null;
    stationLng: number | null;
    defaultMileageRate: number | null;
  }
) {
  await pool.query(
    `
      update collab_organizations
      set
        county_id = $2::uuid,
        organization_name = $3,
        license_status = $4,
        seat_limit = $5,
        station_name = $6,
        station_address = $7,
        station_lat = $8,
        station_lng = $9,
        default_mileage_rate = $10
      where id = $1::uuid
    `,
    [
      params.organizationId,
      params.countyId,
      params.organizationName,
      params.licenseStatus,
      params.seatLimit,
      params.stationName,
      params.stationAddress,
      params.stationLat,
      params.stationLng,
      params.defaultMileageRate
    ]
  );
  return await fetchSuperAdminOrganizationByID(pool, params.organizationId);
}

async function upsertCounty(pool: { query: PoolClient['query'] }, countyName: string) {
  const result = await pool.query<{ id: string }>(
    `
      insert into collab_counties (county_name)
      values ($1)
      on conflict (county_name)
      do update set county_name = excluded.county_name
      returning id::text as id
    `,
    [countyName]
  );
  return result.rows[0]?.id ?? null;
}

async function listSessionSharedOrganizations(pool: { query: PoolClient['query'] }, sessionId: string) {
  const result = await pool.query<CollabOrganizationRow>(
    `
      select
        org.id::text as id,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate,
        org.created_at,
        org.updated_at
      from collab_map_session_org_access soa
      join collab_organizations org
        on org.id = soa.organization_id
      left join collab_counties county
        on county.id = org.county_id
      where soa.session_id = $1::uuid
      order by lower(org.organization_name)
    `,
    [sessionId]
  );
  return result.rows;
}

async function listSuperAdminUsers(pool: { query: PoolClient['query'] }) {
  const result = await pool.query<CollabOrgMembershipRow>(
    `
      select
        m.id::text as id,
        m.organization_id::text as organization_id,
        m.trainer_id::text as trainer_id,
        m.trainer_ref,
        m.email,
        m.display_name,
        m.is_admin,
        m.is_active,
        org.organization_name,
        org.license_status,
        org.seat_limit,
        org.county_id::text as county_id,
        county.county_name,
        org.station_name,
        org.station_address,
        org.station_lat,
        org.station_lng,
        org.default_mileage_rate
      from collab_org_members m
      join collab_organizations org
        on org.id = m.organization_id
      left join collab_counties county
        on county.id = org.county_id
      order by lower(org.organization_name), lower(m.display_name), lower(m.email)
    `
  );
  return result.rows;
}

async function fetchSuperAdminOverview(pool: { query: PoolClient['query'] }) {
  const result = await pool.query<SuperAdminOverviewRow>(
    `
      select
        (select count(*)::text from collab_organizations) as organization_count,
        (select count(*)::text from collab_organizations where license_status = 'active') as active_license_count,
        (select count(*)::text from collab_counties) as county_count,
        (select count(*)::text from collab_org_members) as user_count,
        (select count(*)::text from collab_org_members where is_active = true) as active_user_count,
        (select count(distinct session_id)::text from collab_map_session_org_access) as shared_session_count,
        (select count(*)::text from collab_map_sessions where session_status = 'active') as active_session_count
    `
  );
  return result.rows[0] ?? null;
}

async function listSuperAdminSessionAccess(pool: { query: PoolClient['query'] }) {
  const result = await pool.query<SuperAdminSessionAccessRow>(
    `
      select
        s.id::text as session_id,
        s.incident_name,
        s.session_status,
        owner.id::text as owner_organization_id,
        owner.organization_name as owner_organization_name,
        shared.id::text as shared_organization_id,
        shared.organization_name as shared_organization_name,
        shared_county.county_name as shared_county_name,
        s.operational_period_end,
        s.updated_at
      from collab_map_session_org_access soa
      join collab_map_sessions s
        on s.id = soa.session_id
      left join collab_organizations owner
        on owner.id = s.organization_id
      join collab_organizations shared
        on shared.id = soa.organization_id
      left join collab_counties shared_county
        on shared_county.id = shared.county_id
      order by s.updated_at desc, lower(s.incident_name), lower(shared.organization_name)
    `
  );
  return result.rows;
}

async function listSuperAdminStandingAccess(pool: { query: PoolClient['query'] }) {
  const result = await pool.query<SuperAdminStandingAccessRow>(
    `
      select
        source.id::text as source_organization_id,
        source.organization_name as source_organization_name,
        source_county.county_name as source_county_name,
        target.id::text as target_organization_id,
        target.organization_name as target_organization_name,
        target_county.county_name as target_county_name,
        osa.created_by_trainer_ref,
        osa.created_at,
        osa.updated_at
      from collab_org_standing_access osa
      join collab_organizations source
        on source.id = osa.source_organization_id
      left join collab_counties source_county
        on source_county.id = source.county_id
      join collab_organizations target
        on target.id = osa.target_organization_id
      left join collab_counties target_county
        on target_county.id = target.county_id
      order by lower(source.organization_name), lower(target.organization_name), osa.created_at desc
    `
  );
  return result.rows;
}

async function createStandingOrganizationAccess(
  pool: { query: PoolClient['query'] },
  params: { sourceOrganizationId: string; targetOrganizationId: string; createdByTrainerRef: string }
) {
  const result = await pool.query<{ source_organization_id: string }>(
    `
      with existing as (
        select 1
        from collab_org_standing_access
        where (
            (source_organization_id = $1::uuid and target_organization_id = $2::uuid)
            or (source_organization_id = $2::uuid and target_organization_id = $1::uuid)
          )
        limit 1
      )
      insert into collab_org_standing_access (
        source_organization_id,
        target_organization_id,
        created_by_trainer_ref
      )
      select $1::uuid, $2::uuid, $3
      where not exists (select 1 from existing)
      returning source_organization_id::text as source_organization_id
    `,
    [params.sourceOrganizationId, params.targetOrganizationId, params.createdByTrainerRef]
  );
  return result.rows[0] ?? null;
}

async function deleteStandingOrganizationAccess(
  pool: { query: PoolClient['query'] },
  sourceOrganizationId: string,
  targetOrganizationId: string
) {
  await pool.query(
    `
      delete from collab_org_standing_access
      where (
          (source_organization_id = $1::uuid and target_organization_id = $2::uuid)
          or (source_organization_id = $2::uuid and target_organization_id = $1::uuid)
        )
    `,
    [sourceOrganizationId, targetOrganizationId]
  );
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
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    countyName: row.county_name,
    incidentName: row.incident_name,
    commanderName: row.commander_name,
    commanderICSRole: row.commander_ics_role,
    joinCode: row.join_code,
    joinCodeExpiresAt: row.join_code_expires_at,
    viewerAccessEnabled: row.viewer_access_enabled !== false,
    status: row.session_status,
    operationalPeriodStart: row.operational_period_start,
    operationalPeriodEnd: row.operational_period_end,
    currentVersion: Number(row.last_mutation_version),
    commandStructure: sanitizeCommandStructureDocument(row.command_structure_json, row.id),
    ics207Export: sanitizeIcs207ExportSnapshot(row.ics207_export_json),
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    joinUrl
  };
}

function ensureViewerAccessEnabled(session: CollabSessionRow) {
  if (session.viewer_access_enabled === false) {
    throw new ViewerAccessDisabledError('Viewer access has been turned off for this session.');
  }
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

function mapOrganizationMembership(row: CollabOrgMembershipRow, organizationOverride?: CollabOrganizationRow | null) {
  const org = organizationOverride ?? row;
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    countyId: row.county_id,
    countyName: row.county_name,
    trainerRef: row.trainer_ref,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    licenseStatus: row.license_status,
    seatLimit: row.seat_limit,
    stationName: org.station_name,
    stationAddress: org.station_address,
    stationLat: normalizeNullableCoordinate(org.station_lat),
    stationLng: normalizeNullableCoordinate(org.station_lng),
    defaultMileageRate: normalizeNullableMoney(org.default_mileage_rate)
  };
}

function mapOrganizationRosterMember(row: CollabOrgMembershipRow) {
  return {
    id: row.id,
    trainerRef: row.trainer_ref,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isActive: row.is_active
  };
}

function mapSharedOrganization(row: CollabOrganizationRow) {
  return {
    id: row.id,
    organizationName: row.organization_name,
    countyId: row.county_id,
    countyName: row.county_name,
    licenseStatus: row.license_status,
    seatLimit: row.seat_limit,
    stationName: row.station_name,
    stationAddress: row.station_address,
    stationLat: normalizeNullableCoordinate(row.station_lat),
    stationLng: normalizeNullableCoordinate(row.station_lng),
    defaultMileageRate: normalizeNullableMoney(row.default_mileage_rate)
  };
}

function mapOrganizationSummary(row: CollabOrgMembershipRow, seatsUsed: number, organizationOverride?: CollabOrganizationRow | null) {
  const org = organizationOverride ?? row;
  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    countyId: row.county_id,
    countyName: row.county_name,
    licenseStatus: row.license_status,
    seatLimit: row.seat_limit,
    seatsUsed,
    stationName: org.station_name,
    stationAddress: org.station_address,
    stationLat: normalizeNullableCoordinate(org.station_lat),
    stationLng: normalizeNullableCoordinate(org.station_lng),
    defaultMileageRate: normalizeNullableMoney(org.default_mileage_rate)
  };
}

function mapSuperAdmin(row: CollabSuperAdminRow) {
  return {
    id: row.id,
    trainerRef: row.trainer_ref,
    email: row.email,
    displayName: row.display_name,
    isActive: row.is_active
  };
}

function mapSuperAdminOverview(row: SuperAdminOverviewRow | null) {
  return {
    organizations: Number(row?.organization_count ?? 0),
    activeLicenses: Number(row?.active_license_count ?? 0),
    counties: Number(row?.county_count ?? 0),
    users: Number(row?.user_count ?? 0),
    activeUsers: Number(row?.active_user_count ?? 0),
    sharedSessions: Number(row?.shared_session_count ?? 0),
    activeSessions: Number(row?.active_session_count ?? 0)
  };
}

function mapSuperAdminOrganization(row: SuperAdminOrganizationRow) {
  return {
    id: row.id,
    organizationName: row.organization_name,
    countyId: row.county_id,
    countyName: row.county_name,
    licenseStatus: row.license_status,
    seatLimit: row.seat_limit,
    stationName: row.station_name,
    stationAddress: row.station_address,
    stationLat: normalizeNullableCoordinate(row.station_lat),
    stationLng: normalizeNullableCoordinate(row.station_lng),
    defaultMileageRate: normalizeNullableMoney(row.default_mileage_rate),
    memberCount: Number(row.member_count ?? 0),
    adminCount: Number(row.admin_count ?? 0),
    seatsUsed: Number(row.seats_used ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSuperAdminUser(row: CollabOrgMembershipRow) {
  return {
    id: row.id,
    trainerRef: row.trainer_ref,
    email: row.email,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    countyName: row.county_name,
    licenseStatus: row.license_status,
    stationName: row.station_name,
    stationAddress: row.station_address,
    stationLat: normalizeNullableCoordinate(row.station_lat),
    stationLng: normalizeNullableCoordinate(row.station_lng),
    defaultMileageRate: normalizeNullableMoney(row.default_mileage_rate)
  };
}

function mapSuperAdminAccess(row: SuperAdminSessionAccessRow) {
  return {
    sessionId: row.session_id,
    incidentName: row.incident_name,
    sessionStatus: row.session_status,
    ownerOrganizationId: row.owner_organization_id,
    ownerOrganizationName: row.owner_organization_name,
    sharedOrganizationId: row.shared_organization_id,
    sharedOrganizationName: row.shared_organization_name,
    sharedCountyName: row.shared_county_name,
    operationalPeriodEnd: row.operational_period_end,
    updatedAt: row.updated_at
  };
}

function mapSuperAdminStandingAccess(row: SuperAdminStandingAccessRow) {
  return {
    sourceOrganizationId: row.source_organization_id,
    sourceOrganizationName: row.source_organization_name,
    sourceCountyName: row.source_county_name,
    targetOrganizationId: row.target_organization_id,
    targetOrganizationName: row.target_organization_name,
    targetCountyName: row.target_county_name,
    createdByTrainerRef: row.created_by_trainer_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

function normalizeEmail(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeLicenseStatus(value: string | undefined): LicenseStatus | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized === 'active' || normalized === 'inactive' ? normalized : null;
}

function normalizeSeatLimit(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeNullableCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000) / 1_000_000 : null;
}

function normalizeNullableMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
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

function sanitizeCommandStructureAssignedUser(value: unknown): CommandStructureAssignedUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = normalizeOptionalText((value as { name?: string }).name);
  if (!name) return null;
  return {
    userId: normalizeOptionalText((value as { userId?: string }).userId) ?? '',
    name
  };
}

function sanitizeCommandStructureDocument(value: unknown, sessionID = ''): CommandStructureDocument {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as { incidentId?: unknown; roles?: unknown[] }
    : null;
  const roles = Array.isArray(raw?.roles) ? raw.roles : [];
  return {
    incidentId: String(raw?.incidentId || sessionID || ''),
    roles: roles
      .filter((role) => role && typeof role === 'object' && !Array.isArray(role))
      .map((role) => {
        const normalized = role as { roleId?: unknown; label?: unknown; parent?: unknown; assignedUser?: unknown };
        const assignedUser = sanitizeCommandStructureAssignedUser(normalized.assignedUser);
        return {
          roleId: String(normalized.roleId || ''),
          label: String(normalized.label || ''),
          parent: normalizeOptionalText(String(normalized.parent || '')),
          assignedUser,
          status: assignedUser ? 'assigned' : 'empty'
        } satisfies CommandStructureRole;
      })
      .filter((role) => role.roleId && role.label)
  };
}

function sanitizeIcs207ExportSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
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

function resolveSupabaseAdminConfig(config: AppConfig) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ConflictError('Supabase admin is not configured on the server.');
  }
  return {
    supabaseUrl: config.supabaseUrl.replace(/\/$/, ''),
    supabaseServiceRoleKey: config.supabaseServiceRoleKey
  };
}

async function findSupabaseAuthUserByEmail(
  config: { supabaseUrl: string; supabaseServiceRoleKey: string },
  email: string
): Promise<{ id: string; email: string } | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey
      }
    });
    const payload = await response.json().catch(() => null) as { users?: Array<{ id?: string; email?: string }>; msg?: string; message?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.msg || payload?.message || 'Failed to query Supabase users.');
    }
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const match = users.find((user) => normalizeEmail(user?.email) === normalizedEmail);
    if (match?.id) {
      return {
        id: match.id,
        email: match.email || normalizedEmail
      };
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function deleteSupabaseAuthUserByEmail(
  config: { supabaseUrl: string; supabaseServiceRoleKey: string },
  email: string
) {
  const authUser = await findSupabaseAuthUserByEmail(config, email);
  if (!authUser?.id) return false;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey
    }
  });
  const payload = await response.json().catch(() => null) as { msg?: string; message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || 'Failed to delete Supabase auth user.');
  }
  return true;
}

function resolveAttachmentStorageConfig(config: AppConfig): AttachmentStorageConfig {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ConflictError('Attachment storage is not configured on the server.');
  }
  return {
    supabaseUrl: config.supabaseUrl.replace(/\/$/, ''),
    supabaseServiceRoleKey: config.supabaseServiceRoleKey,
    bucket: config.icsCollabAttachmentsBucket
  };
}

async function importAttachmentToStorage(config: AppConfig, sessionID: string, body: ImportAttachmentBody | undefined) {
  const storageConfig = resolveAttachmentStorageConfig(config);
  const objectID = normalizeUUID(body?.objectId);
  if (!objectID) {
    throw new ValidationError('objectId is required for attachment upload.');
  }
  const fileName = normalizeOptionalText(body?.fileName) ?? 'attachment.jpg';
  const parsed = parseImageDataUrl(body?.dataUrl);
  const extension = inferImageExtension(parsed.contentType, fileName);
  const safeName = sanitizeAttachmentFileStem(fileName);
  const storagePath = `${sessionID}/${objectID}/${randomUUID()}-${safeName}.${extension}`;
  await uploadAttachmentFile(storageConfig, storagePath, parsed.data, parsed.contentType);
  return {
    id: randomUUID(),
    name: fileName,
    path: storagePath,
    publicUrl: buildSupabasePublicObjectUrl(storageConfig, storagePath),
    contentType: parsed.contentType,
    sizeBytes: parsed.data.byteLength,
    createdAt: new Date().toISOString()
  };
}

function parseImageDataUrl(value: string | undefined) {
  const raw = normalizeOptionalText(value);
  const match = raw?.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new ValidationError('Attachment upload requires a valid image dataUrl.');
  }
  const contentType = match[1].toLowerCase();
  const data = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!data.byteLength) {
    throw new ValidationError('Attachment upload is empty.');
  }
  return { contentType, data };
}

function inferImageExtension(contentType: string, fileName: string) {
  const explicit = (fileName.split('.').pop() || '').trim().toLowerCase();
  if (explicit && /^[a-z0-9]+$/.test(explicit) && explicit.length <= 10) {
    return explicit === 'jpeg' ? 'jpg' : explicit;
  }
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

function sanitizeAttachmentFileStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, '').trim().toLowerCase();
  const normalized = stem.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'attachment';
}

async function uploadAttachmentFile(
  config: AttachmentStorageConfig,
  storagePath: string,
  data: Buffer,
  contentType: string
) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeSupabasePath(storagePath)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'false'
    },
    body: new Uint8Array(data)
  });
  if (!response.ok) {
    const detail = await safeReadStorageError(response);
    if (response.status === 413) {
      throw new ValidationError('Attachment image is too large for storage upload.');
    }
    throw new Error(detail || `Storage upload failed (${response.status}).`);
  }
}

async function deleteAttachmentFiles(config: AttachmentStorageConfig, paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter((path) => typeof path === 'string' && path.trim().length > 0)));
  if (!uniquePaths.length) return;
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/remove`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bucketId: config.bucket, paths: uniquePaths })
  });
  if (!response.ok) {
    const detail = await safeReadStorageError(response);
    throw new Error(detail || `Storage delete failed (${response.status}).`);
  }
}

function listAttachmentPaths(fields: unknown) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return [];
  const candidates = (fields as { attachmentFiles?: unknown }).attachmentFiles;
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((entry) => (entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as { path?: unknown }).path : null))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function buildSupabasePublicObjectUrl(config: AttachmentStorageConfig, storagePath: string) {
  return `${config.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodeSupabasePath(storagePath)}`;
}

function encodeSupabasePath(storagePath: string) {
  return storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function safeReadStorageError(response: Response) {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload?.message || payload?.error || '';
  } catch {
    try {
      return (await response.text()).trim();
    } catch {
      return '';
    }
  }
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
  if (error instanceof ViewerAccessDisabledError) {
    return reply.code(403).send({ error: 'VIEWER_ACCESS_DISABLED', message: error.message });
  }
  return reply.code(500).send({ error: 'INTERNAL_ERROR', message: fallbackMessage });
}

class ValidationError extends Error {}
class ConflictError extends Error {}
class NotFoundError extends Error {}
class ViewerAccessDisabledError extends Error {}
