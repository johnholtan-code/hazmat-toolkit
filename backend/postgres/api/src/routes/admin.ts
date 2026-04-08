import type { FastifyPluginAsync } from 'fastify';
import { hashPassword, normalizeEmailLike, requireOrgAdmin } from './_trainerIdentity.js';

type MemberBody = {
  email?: string;
  displayName?: string;
  role?: 'org_admin' | 'trainer' | 'observer' | 'student';
  isActive?: boolean;
  password?: string;
};

type ResetPasswordBody = {
  email?: string;
  password?: string;
};

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { organizationId: string } }>('/v1/admin/organizations/:organizationId/members', async (request, reply) => {
    try {
      await requireOrgAdmin(app, request.headers, request.params.organizationId);
      const result = await app.pg.query<{
        trainer_id: string;
        trainer_ref: string;
        email: string | null;
        display_name: string;
        role: string;
        is_active: boolean;
      }>(
        `
          select
            t.id::text as trainer_id,
            coalesce(t.trainer_ref, lower(t.email)) as trainer_ref,
            lower(t.email) as email,
            t.display_name,
            m.role::text as role,
            m.is_active
          from organization_memberships m
          join trainers t on t.id = m.trainer_id
          where m.organization_id = $1::uuid
          order by m.created_at asc
        `,
        [request.params.organizationId]
      );
      return reply.send(result.rows.map((row) => ({
        trainerId: row.trainer_id,
        trainerRef: row.trainer_ref,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        isActive: row.is_active
      })));
    } catch (error) {
      request.log.error({ err: error }, 'list org members failed');
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Organization admin access is required.' });
    }
  });

  app.post<{ Params: { organizationId: string }; Body: MemberBody }>('/v1/admin/organizations/:organizationId/members', async (request, reply) => {
    const email = normalizeEmailLike(request.body?.email);
    const displayName = request.body?.displayName?.trim() || email || '';
    const role = request.body?.role ?? 'trainer';
    const isActive = request.body?.isActive ?? true;
    const password = request.body?.password?.trim();

    if (!email || !displayName) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'email and displayName are required.' });
    }

    try {
      const actor = await requireOrgAdmin(app, request.headers, request.params.organizationId);
      const client = await app.pg.connect();
      try {
        await client.query('begin');

        const trainer = await client.query<{ id: string }>(
          `
            insert into trainers (trainer_ref, email, display_name, password_hash, is_active)
            values ($1, $2, $3, $4, $5)
            on conflict (trainer_ref)
            do update set
              email = excluded.email,
              display_name = excluded.display_name,
              is_active = excluded.is_active,
              password_hash = coalesce(excluded.password_hash, trainers.password_hash),
              updated_at = now()
            returning id::text as id
          `,
          [email, email, displayName, password ? hashPassword(password) : null, isActive]
        );

        await client.query(
          `
            insert into organization_memberships (organization_id, trainer_id, role, is_active)
            values ($1::uuid, $2::uuid, $3::trainer_role, $4::boolean)
            on conflict (organization_id, trainer_id)
            do update set role = excluded.role, is_active = excluded.is_active, updated_at = now()
          `,
          [request.params.organizationId, trainer.rows[0].id, role, isActive]
        );

        await client.query(
          `
            insert into trainer_entitlements (trainer_id, organization_id, entitlement_key, source, status)
            values ($1::uuid, $2::uuid, 'trainer_authoring', 'organization', case when $3::boolean then 'active' else 'inactive' end)
            on conflict do nothing
          `,
          [trainer.rows[0].id, request.params.organizationId, isActive]
        );

        await client.query(
          `
            insert into audit_logs (organization_id, actor_trainer_id, actor_ref, action, entity_type, entity_id, payload_json)
            values ($1::uuid, $2::uuid, $3, 'organization.member.upsert', 'trainer', $4::text, jsonb_build_object('email', $5, 'role', $6, 'isActive', $7))
          `,
          [request.params.organizationId, actor.trainerId, actor.trainerRef, trainer.rows[0].id, email, role, isActive]
        );

        await client.query('commit');
        return reply.code(201).send({ trainerId: trainer.rows[0].id, email, displayName, role, isActive });
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      request.log.error({ err: error }, 'upsert org member failed');
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Organization admin access is required.' });
    }
  });

  app.post<{ Params: { organizationId: string }; Body: ResetPasswordBody }>(
    '/v1/admin/organizations/:organizationId/members/reset-password',
    async (request, reply) => {
      const email = normalizeEmailLike(request.body?.email);
      const password = request.body?.password?.trim() ?? '';

      if (!email || password.length < 8) {
        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: 'email and password (8+ chars) are required.'
        });
      }

      try {
        const actor = await requireOrgAdmin(app, request.headers, request.params.organizationId);
        const client = await app.pg.connect();

        try {
          await client.query('begin');

          const trainer = await client.query<{ id: string }>(
            `
              select t.id::text as id
              from organization_memberships m
              join trainers t on t.id = m.trainer_id
              where m.organization_id = $1::uuid
                and lower(t.email) = $2
              limit 1
            `,
            [request.params.organizationId, email]
          );

          const trainerId = trainer.rows[0]?.id;
          if (!trainerId) {
            await client.query('rollback');
            return reply.code(404).send({
              error: 'NOT_FOUND',
              message: 'No trainer with that email was found in this organization.'
            });
          }

          await client.query(
            `
              update trainers
              set password_hash = $2,
                  updated_at = now()
              where id = $1::uuid
            `,
            [trainerId, hashPassword(password)]
          );

          await client.query(
            `
              insert into audit_logs (organization_id, actor_trainer_id, actor_ref, action, entity_type, entity_id, payload_json)
              values ($1::uuid, $2::uuid, $3, 'organization.member.reset_password', 'trainer', $4::text, jsonb_build_object('email', $5))
            `,
            [request.params.organizationId, actor.trainerId, actor.trainerRef, trainerId, email]
          );

          await client.query('commit');
          return reply.send({
            message: 'Password reset completed.',
            email
          });
        } catch (error) {
          await client.query('rollback');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        request.log.error({ err: error }, 'reset org member password failed');
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Organization admin access is required.' });
      }
    }
  );
};
