import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { TrainerAuthError, readTrainerRefHeader } from './_trainerAuth.js';

type SupabaseUserResponse = {
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

type TrainerRow = {
  trainer_id: string;
  trainer_ref: string;
  email: string | null;
  display_name: string;
  is_active: boolean;
};

type MembershipRow = {
  organization_id: string;
  organization_name: string;
  role: TrainerRole;
  is_active: boolean;
};

type AuthTokenClaims = {
  typ: 'trainer';
  sub: string;
  trainerRef: string;
  orgId: string | null;
  role: TrainerRole;
  exp: number;
};

export type TrainerRole = 'super_admin' | 'org_admin' | 'trainer' | 'observer' | 'student';

export type TrainerIdentity = {
  trainerId: string;
  trainerRef: string;
  email: string;
  displayName: string;
  organizationId: string | null;
  organizationName: string | null;
  role: TrainerRole;
  authSource: 'token' | 'supabase' | 'header';
};

export type TrainerAuthEnvelope = {
  accessToken: string;
  expiresAt: string;
  trainer: {
    id: string;
    trainerRef: string;
    email: string;
    displayName: string;
  };
  currentOrganization: {
    id: string | null;
    organizationName: string | null;
    role: TrainerRole;
  };
  organizations: Array<{
    id: string;
    organizationName: string;
    role: TrainerRole;
    isActive: boolean;
  }>;
  entitlements: Array<{
    entitlementKey: string;
    source: string;
    status: string;
    expiresAt: string | null;
  }>;
};

export async function requireTrainerIdentity(
  app: FastifyInstance,
  headers: { authorization?: string; ['x-trainer-ref']?: string | string[] | undefined }
): Promise<TrainerIdentity> {
  const bearer = extractBearerToken(headers.authorization);
  if (bearer) {
    const localIdentity = await resolveLocalTokenIdentity(app, bearer);
    if (localIdentity) return { ...localIdentity, authSource: 'token' };

    if (app.config.supabaseUrl && app.config.supabaseAnonKey) {
      const supabaseIdentity = await fetchSupabaseTrainerIdentity(app, bearer);
      if (supabaseIdentity) {
        const hydrated = await ensureTrainerContext(app, {
          trainerRef: supabaseIdentity.trainerRef,
          email: supabaseIdentity.email,
          displayName: supabaseIdentity.displayName
        });
        return { ...hydrated, authSource: 'supabase' };
      }
      throw new TrainerAuthError('Invalid or expired trainer sign-in.');
    }
  }

  const trainerRef = normalizeEmailLike(readTrainerRefHeader(headers));
  if (!trainerRef) {
    throw new TrainerAuthError('Trainer authentication is required.');
  }

  const hydrated = await ensureTrainerContext(app, {
    trainerRef,
    email: trainerRef,
    displayName: trainerRef
  });
  return { ...hydrated, authSource: 'header' };
}

export async function issueTrainerAuthEnvelope(
  app: FastifyInstance,
  trainerId: string
): Promise<TrainerAuthEnvelope> {
  const identity = await loadTrainerIdentityById(app, trainerId);
  if (!identity) {
    throw new TrainerAuthError('Trainer account not found.');
  }

  const accessToken = signTrainerAccessToken(app, {
    typ: 'trainer',
    sub: identity.trainerId,
    trainerRef: identity.trainerRef,
    orgId: identity.organizationId,
    role: identity.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
  });

  const organizations = await listOrganizationsForTrainer(app, identity.trainerId);
  const entitlements = await listEntitlementsForTrainer(app, identity.trainerId, identity.organizationId);

  return {
    accessToken,
    expiresAt: new Date(Date.now() + (60 * 60 * 24 * 7 * 1000)).toISOString(),
    trainer: {
      id: identity.trainerId,
      trainerRef: identity.trainerRef,
      email: identity.email,
      displayName: identity.displayName
    },
    currentOrganization: {
      id: identity.organizationId,
      organizationName: identity.organizationName,
      role: identity.role
    },
    organizations,
    entitlements
  };
}

export async function requireOrgAdmin(
  app: FastifyInstance,
  headers: { authorization?: string; ['x-trainer-ref']?: string | string[] | undefined },
  organizationId: string
): Promise<TrainerIdentity> {
  const identity = await requireTrainerIdentity(app, headers);
  if (identity.role !== 'super_admin' && !(identity.organizationId === organizationId && identity.role === 'org_admin')) {
    throw new TrainerAuthError('Organization admin access is required.');
  }
  return identity;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, digest] = storedHash.split(':', 2);
  if (!salt || !digest) return false;
  const derived = scryptSync(password, salt, 64);
  const existing = Buffer.from(digest, 'hex');
  return existing.length === derived.length && timingSafeEqual(existing, derived);
}

export function normalizeEmailLike(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export async function ensureTrainerContext(
  app: FastifyInstance,
  params: { trainerRef: string; email: string; displayName: string }
): Promise<Omit<TrainerIdentity, 'authSource'>> {
  const client = await app.pg.connect();
  try {
    await client.query('begin');
    const trainer = await upsertTrainer(client, params);
    const membership = await ensureDefaultMembership(client, trainer.trainer_id, trainer.display_name, trainer.email ?? params.email);
    await client.query('commit');
    return {
      trainerId: trainer.trainer_id,
      trainerRef: trainer.trainer_ref,
      email: trainer.email ?? params.email,
      displayName: trainer.display_name,
      organizationId: membership.organization_id,
      organizationName: membership.organization_name,
      role: membership.role
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function resolveLocalTokenIdentity(app: FastifyInstance, token: string): Promise<Omit<TrainerIdentity, 'authSource'> | null> {
  const claims = verifyTrainerAccessToken(app, token);
  if (!claims) return null;
  const identity = await loadTrainerIdentityById(app, claims.sub, claims.orgId);
  if (!identity) return null;
  if (identity.role !== claims.role && claims.role !== 'super_admin') {
    return null;
  }
  return identity;
}

async function loadTrainerIdentityById(
  app: FastifyInstance,
  trainerId: string,
  preferredOrganizationId?: string | null
): Promise<Omit<TrainerIdentity, 'authSource'> | null> {
  const trainerResult = await app.pg.query<TrainerRow>(
    `
      select
        t.id::text as trainer_id,
        coalesce(t.trainer_ref, lower(t.email)) as trainer_ref,
        lower(t.email) as email,
        t.display_name,
        t.is_active
      from trainers t
      where t.id = $1::uuid
      limit 1
    `,
    [trainerId]
  );

  const trainer = trainerResult.rows[0];
  if (!trainer || !trainer.is_active) return null;

  const membership = await selectPreferredMembership(app, trainerId, preferredOrganizationId ?? null);

  return {
    trainerId: trainer.trainer_id,
    trainerRef: trainer.trainer_ref,
    email: trainer.email ?? trainer.trainer_ref,
    displayName: trainer.display_name,
    organizationId: membership?.organization_id ?? null,
    organizationName: membership?.organization_name ?? null,
    role: membership?.role ?? 'trainer'
  };
}

async function listOrganizationsForTrainer(app: FastifyInstance, trainerId: string) {
  const result = await app.pg.query<MembershipRow>(
    `
      select
        o.id::text as organization_id,
        o.organization_name,
        m.role::text as role,
        m.is_active
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where m.trainer_id = $1::uuid
      order by m.created_at asc
    `,
    [trainerId]
  );

  return result.rows.map((row) => ({
    id: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    isActive: row.is_active
  }));
}

async function listEntitlementsForTrainer(app: FastifyInstance, trainerId: string, organizationId: string | null) {
  const result = await app.pg.query<{
    entitlement_key: string;
    source: string;
    status: string;
    expires_at: string | null;
  }>(
    `
      select
        entitlement_key,
        source,
        status,
        expires_at
      from trainer_entitlements
      where trainer_id = $1::uuid
        and ($2::uuid is null or organization_id = $2::uuid or organization_id is null)
      order by created_at asc
    `,
    [trainerId, organizationId]
  );

  return result.rows.map((row) => ({
    entitlementKey: row.entitlement_key,
    source: row.source,
    status: row.status,
    expiresAt: row.expires_at
  }));
}

async function upsertTrainer(
  client: PoolClient,
  params: { trainerRef: string; email: string; displayName: string }
): Promise<TrainerRow> {
  const result = await client.query<TrainerRow>(
    `
      insert into trainers (trainer_ref, email, display_name, is_active)
      values ($1, $2, $3, true)
      on conflict (trainer_ref)
      do update set
        email = excluded.email,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now()
      returning
        id::text as trainer_id,
        trainer_ref,
        lower(email) as email,
        display_name,
        is_active
    `,
    [params.trainerRef, params.email, params.displayName]
  );
  return result.rows[0];
}

async function ensureDefaultMembership(
  client: PoolClient,
  trainerId: string,
  displayName: string,
  email: string
): Promise<MembershipRow> {
  const existing = await client.query<MembershipRow>(
    `
      select
        o.id::text as organization_id,
        o.organization_name,
        m.role::text as role,
        m.is_active
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where m.trainer_id = $1::uuid
        and m.is_active = true
      order by m.created_at asc
      limit 1
    `,
    [trainerId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const orgName = `${displayName} Personal`;
  const slug = createOrganizationSlug(email);

  const createdOrg = await client.query<{ id: string; organization_name: string }>(
    `
      insert into organizations (slug, organization_name, billing_email, license_status, seat_limit, app_distribution)
      values ($1, $2, $3, 'active', 1, 'public_app_store')
      returning id::text as id, organization_name
    `,
    [slug, orgName, email]
  );

  await client.query(
    `
      insert into organization_memberships (organization_id, trainer_id, role, is_active)
      values ($1::uuid, $2::uuid, 'org_admin', true)
      on conflict (organization_id, trainer_id)
      do update set role = excluded.role, is_active = true, updated_at = now()
    `,
    [createdOrg.rows[0].id, trainerId]
  );

  await client.query(
    `
      insert into trainer_entitlements (trainer_id, organization_id, entitlement_key, source, status)
      values ($1::uuid, $2::uuid, 'trainer_authoring', 'self_serve', 'active')
      on conflict do nothing
    `,
    [trainerId, createdOrg.rows[0].id]
  );

  return {
    organization_id: createdOrg.rows[0].id,
    organization_name: createdOrg.rows[0].organization_name,
    role: 'org_admin',
    is_active: true
  };
}

async function selectPreferredMembership(
  app: FastifyInstance,
  trainerId: string,
  preferredOrganizationId: string | null
): Promise<MembershipRow | null> {
  const result = await app.pg.query<MembershipRow>(
    `
      select
        o.id::text as organization_id,
        o.organization_name,
        m.role::text as role,
        m.is_active
      from organization_memberships m
      join organizations o on o.id = m.organization_id
      where m.trainer_id = $1::uuid
        and m.is_active = true
        and ($2::uuid is null or o.id = $2::uuid)
      order by
        case m.role
          when 'super_admin' then 0
          when 'org_admin' then 1
          when 'trainer' then 2
          when 'observer' then 3
          else 4
        end,
        m.created_at asc
      limit 1
    `,
    [trainerId, preferredOrganizationId]
  );
  return result.rows[0] ?? null;
}

function signTrainerAccessToken(app: FastifyInstance, claims: AuthTokenClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', app.config.authTokenSecret).update(payload).digest('base64url');
  return `trainer.${payload}.${signature}`;
}

function verifyTrainerAccessToken(app: FastifyInstance, token: string): AuthTokenClaims | null {
  const [prefix, payload, signature] = token.split('.', 3);
  if (prefix !== 'trainer' || !payload || !signature) return null;
  const expected = createHmac('sha256', app.config.authTokenSecret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthTokenClaims;
    if (claims.typ !== 'trainer') return null;
    if (!claims.sub || !claims.trainerRef || !claims.role || !claims.exp) return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === 'bearer' ? token.trim() : null;
}

function createOrganizationSlug(email: string): string {
  const seed = email.split('@')[0] || 'trainer';
  const normalized = seed.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'trainer';
  return `${normalized}-${randomBytes(3).toString('hex')}`;
}

async function fetchSupabaseTrainerIdentity(
  app: FastifyInstance,
  accessToken: string
): Promise<{ trainerRef: string; email: string; displayName: string } | null> {
  const supabaseUrl = app.config.supabaseUrl;
  const anonKey = app.config.supabaseAnonKey;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(new URL('/auth/v1/user', supabaseUrl), {
    method: 'GET',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json'
    }
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Supabase auth lookup failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as SupabaseUserResponse;
  const email = normalizeEmailLike(body.email);
  if (!email) {
    throw new TrainerAuthError('Authenticated trainer account is missing an email address.');
  }

  const displayName =
    body.user_metadata?.full_name?.trim() ||
    body.user_metadata?.display_name?.trim() ||
    body.user_metadata?.name?.trim() ||
    email;

  return {
    trainerRef: email,
    email,
    displayName
  };
}
