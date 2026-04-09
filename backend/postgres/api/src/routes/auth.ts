import type { FastifyPluginAsync } from 'fastify';
import { hashPassword, issueTrainerAuthEnvelope, normalizeEmailLike, requireTrainerIdentity, verifyPassword } from './_trainerIdentity.js';

type SignUpBody = {
  email?: string;
  password?: string;
  displayName?: string;
  organizationName?: string;
};

type SignInBody = {
  email?: string;
  password?: string;
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: SignUpBody }>('/v1/auth/sign-up', async (request, reply) => {
    const email = normalizeEmailLike(request.body?.email);
    const password = request.body?.password?.trim() ?? '';
    const displayName = request.body?.displayName?.trim() || email || '';
    const organizationName = request.body?.organizationName?.trim() || `${displayName} Personal`;

    if (!email || password.length < 8 || !displayName) {
      return reply.code(400).send({
        error: 'BAD_REQUEST',
        message: 'email, password (8+ chars), and displayName are required.'
      });
    }

    const existing = await app.pg.query<{ id: string }>(
      'select id::text as id from trainers where lower(email) = $1 limit 1',
      [email]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return reply.code(409).send({ error: 'CONFLICT', message: 'A trainer account with that email already exists.' });
    }

    const client = await app.pg.connect();
    try {
      await client.query('begin');

      const trainer = await client.query<{ id: string }>(
        `
          insert into trainers (trainer_ref, email, display_name, password_hash, is_active)
          values ($1, $2, $3, $4, true)
          returning id::text as id
        `,
        [email, email, displayName, hashPassword(password)]
      );

      const organization = await client.query<{ id: string }>(
        `
          insert into organizations (slug, organization_name, billing_email, license_status, seat_limit, app_distribution)
          values ($1, $2, $3, 'active', 10, 'public_app_store')
          returning id::text as id
        `,
        [createOrganizationSlug(email), organizationName, email]
      );

      await client.query(
        `
          insert into organization_memberships (organization_id, trainer_id, role, is_active)
          values ($1::uuid, $2::uuid, 'org_admin', true)
        `,
        [organization.rows[0].id, trainer.rows[0].id]
      );

      await client.query(
        `
          insert into trainer_entitlements (trainer_id, organization_id, entitlement_key, source, status)
          values ($1::uuid, $2::uuid, 'trainer_authoring', 'self_serve', 'active')
        `,
        [trainer.rows[0].id, organization.rows[0].id]
      );

      await client.query(
        `
          insert into audit_logs (organization_id, actor_trainer_id, actor_ref, action, entity_type, entity_id, payload_json)
          values ($1::uuid, $2::uuid, $3, 'trainer.sign_up', 'trainer', $2::text, jsonb_build_object('email', $3))
        `,
        [organization.rows[0].id, trainer.rows[0].id, email]
      );

      await client.query('commit');
      return reply.code(201).send(await issueTrainerAuthEnvelope(app, trainer.rows[0].id));
    } catch (error) {
      await client.query('rollback');
      request.log.error({ err: error }, 'signUp failed');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create trainer account.' });
    } finally {
      client.release();
    }
  });

  app.post<{ Body: SignInBody }>('/v1/auth/sign-in', async (request, reply) => {
    const email = normalizeEmailLike(request.body?.email);
    const password = request.body?.password?.trim() ?? '';
    if (!email || !password) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'email and password are required.' });
    }

    const trainer = await app.pg.query<{
      id: string;
      password_hash: string | null;
      is_active: boolean;
    }>(
      `
        select id::text as id, password_hash, is_active
        from trainers
        where lower(email) = $1
        limit 1
      `,
      [email]
    );

    const row = trainer.rows[0];
    if (!row || !row.password_hash || !row.is_active || !verifyPassword(password, row.password_hash)) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid email or password.' });
    }

    await app.pg.query(
      'update trainers set last_login_at = now() where id = $1::uuid',
      [row.id]
    );
    return reply.send(await issueTrainerAuthEnvelope(app, row.id));
  });

  app.get('/v1/auth/me', async (request, reply) => {
    try {
      const identity = await requireTrainerIdentity(app, request.headers);
      return reply.send(await issueTrainerAuthEnvelope(app, identity.trainerId));
    } catch (error) {
      request.log.error({ err: error }, 'auth me failed');
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Trainer authentication is required.' });
    }
  });
};

function createOrganizationSlug(email: string): string {
  const prefix = (email.split('@')[0] || 'org')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'org';
  return `${prefix}-${Date.now().toString(36)}`;
}
