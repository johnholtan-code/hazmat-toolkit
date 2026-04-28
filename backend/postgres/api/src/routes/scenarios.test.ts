import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShapeBody, type ShapeBody } from './scenarios.js';
import Fastify from 'fastify';
import { scenariosRoutes } from './scenarios.js';

test('normalizeShapeBody maps snake_case sampling fields into the properties used by SQL params', () => {
  const payload = {
    description: 'HotZone',
    kind: 'polygon',
    sort_order: 1,
    shape_geo_json: '{"type":"Polygon","coordinates":[]}',
    lel_high_sampling_mode: 'high',
    lel_high_feather_percent: 50,
    lel_low_sampling_mode: 'low',
    lel_low_feather_percent: 25
  } as ShapeBody & {
    lel_high_sampling_mode: string;
    lel_high_feather_percent: number;
    lel_low_sampling_mode: string;
    lel_low_feather_percent: number;
  };

  const normalized = normalizeShapeBody(payload);

  assert.equal(normalized.lelHighSamplingMode, 'high');
  assert.equal(normalized.lelHighFeatherPercent, 50);
  assert.equal(normalized.lelLowSamplingMode, 'low');
  assert.equal(normalized.lelLowFeatherPercent, 25);
});

test('normalizeShapeBody maps oxidizer payload aliases into canonical fields', () => {
  const payload = {
    description: 'HotZone',
    kind: 'polygon',
    sort_order: 1,
    shape_geo_json: '{"type":"Polygon","coordinates":[]}',
    oxidizer_enabled: true,
    oxidizer_target_type: 'freeChlorine',
    oxidizer_concentration_PPM: 7.5,
    oxidizer_sample_pH: 6.9,
    oxidizer_reaction_result: 'lowPositive',
    oxidizer_reaction_pattern: 'blueVioletRing',
    oxidizer_reaction_duration_seconds: 5,
    oxidizer_fact_text_override: 'Trainer override'
  } as ShapeBody & {
    oxidizer_enabled: boolean;
    oxidizer_target_type: string;
    oxidizer_concentration_PPM: number;
    oxidizer_sample_pH: number;
    oxidizer_reaction_result: string;
    oxidizer_reaction_pattern: string;
    oxidizer_reaction_duration_seconds: number;
    oxidizer_fact_text_override: string;
  };

  const normalized = normalizeShapeBody(payload);

  assert.equal(normalized.oxidizerEnabled, true);
  assert.equal(normalized.oxidizerTargetType, 'freeChlorine');
  assert.equal(normalized.oxidizerConcentrationPpm, 7.5);
  assert.equal(normalized.oxidizerSamplePh, 6.9);
  assert.equal(normalized.oxidizerReactionResult, 'lowPositive');
  assert.equal(normalized.oxidizerReactionPattern, 'blueVioletRing');
  assert.equal(normalized.oxidizerReactionDurationSeconds, 5);
  assert.equal(normalized.oxidizerFactTextOverride, 'Trainer override');
});

test('POST then GET shapes round-trips wet chemistry oxidizer fields', async () => {
  const scenarioId = '11111111-1111-1111-1111-111111111111';
  const shapeId = '22222222-2222-2222-2222-222222222222';
  const trainerId = '33333333-3333-3333-3333-333333333333';
  const organizationId = '44444444-4444-4444-4444-444444444444';

  let persistedShape: Record<string, unknown> | null = null;
  const fakePg = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.toLowerCase().includes('begin') || sql.toLowerCase().includes('commit') || sql.toLowerCase().includes('rollback')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('insert into trainers')) {
          return {
            rows: [
              {
                trainer_id: trainerId,
                trainer_ref: 'trainer@example.com',
                email: 'trainer@example.com',
                display_name: 'trainer@example.com',
                is_active: true
              }
            ],
            rowCount: 1
          };
        }
        if (sql.includes('from organization_memberships m')) {
          return {
            rows: [
              {
                organization_id: organizationId,
                organization_name: 'Trainer Personal',
                role: 'org_admin',
                is_active: true
              }
            ],
            rowCount: 1
          };
        }
        throw new Error(`Unexpected connect() query: ${sql}`);
      },
      release: () => {}
    }),
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('from scenarios') && sql.includes('where id = $1::uuid') && sql.includes('visibility')) {
        return {
          rows: [
            {
              created_by_trainer_id: trainerId,
              assigned_trainer_id: null,
              organization_id: organizationId,
              trainer_ref: 'trainer@example.com',
              visibility: 'private'
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('insert into scenario_shapes')) {
        const propertiesJson = JSON.parse(String(params?.[41] ?? '{}')) as Record<string, unknown>;
        persistedShape = {
          id: shapeId,
          scenario_id: scenarioId,
          description: String(params?.[2] ?? ''),
          kind: String(params?.[3] ?? 'polygon'),
          sort_order: Number(params?.[4] ?? 0),
          display_color_hex: params?.[5] ?? null,
          shape_geo_json: String(params?.[6] ?? ''),
          radius_m: params?.[7] ?? null,
          oxygen: null,
          lel: null,
          carbon_monoxide: null,
          hydrogen_sulfide: null,
          pid: null,
          oxygen_high_sampling_mode: null,
          oxygen_high_feather_percent: null,
          oxygen_low_sampling_mode: null,
          oxygen_low_feather_percent: null,
          lel_high_sampling_mode: null,
          lel_high_feather_percent: null,
          lel_low_sampling_mode: null,
          lel_low_feather_percent: null,
          carbon_monoxide_high_sampling_mode: null,
          carbon_monoxide_high_feather_percent: null,
          carbon_monoxide_low_sampling_mode: null,
          carbon_monoxide_low_feather_percent: null,
          hydrogen_sulfide_high_sampling_mode: null,
          hydrogen_sulfide_high_feather_percent: null,
          hydrogen_sulfide_low_sampling_mode: null,
          hydrogen_sulfide_low_feather_percent: null,
          pid_high_sampling_mode: null,
          pid_high_feather_percent: null,
          pid_low_sampling_mode: null,
          pid_low_feather_percent: null,
          chemical_readings: [],
          properties_json: propertiesJson,
          dose_rate: null,
          background: null,
          shielding: null,
          rad_latitude: null,
          rad_longitude: null,
          rad_dose_unit: null,
          rad_exposure_unit: null,
          ph: null
        };
        return { rows: [persistedShape], rowCount: 1 };
      }
      if (sql.includes('from scenario_shapes ss') && sql.includes('where ss.scenario_id = $1::uuid')) {
        return { rows: persistedShape ? [persistedShape] : [], rowCount: persistedShape ? 1 : 0 };
      }
      if (sql.includes('from scenarios s') && sql.includes('where s.id = $1::uuid')) {
        return {
          rows: [
            {
              id: scenarioId,
              scenario_name: 'Chem Drill',
              trainer_name: 'Trainer',
              scenario_date: '2026-04-28T00:00:00.000Z',
              latitude: null,
              longitude: null,
              detection_device: 'wet_chemistry_paper',
              version: 1,
              created_at: '2026-04-28T00:00:00.000Z',
              updated_at: '2026-04-28T00:00:00.000Z'
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('from scenario_sessions ss')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('update session_snapshots')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    }
  };

  const app = Fastify();
  (app as unknown as { decorate: (name: string, value: unknown) => void }).decorate('config', {
    authTokenSecret: 'test-secret',
    supabaseUrl: null,
    supabaseAnonKey: null
  });
  (app as unknown as { decorate: (name: string, value: unknown) => void }).decorate('pg', fakePg);
  app.register(scenariosRoutes);
  await app.ready();

  const payload = {
    description: 'Potassium Iodide Starch Paper',
    kind: 'polygon',
    sort_order: 1,
    shape_geo_json: '{"type":"Polygon","coordinates":[]}',
    oxidizer_target_type: 'iodine',
    oxidizer_concentration_ppm: 5.0,
    oxidizer_sample_ph: 5.0,
    oxidizer_reaction_result: 'highPositive',
    oxidizer_reaction_pattern: 'blueVioletRing',
    oxidizer_reaction_duration_seconds: 5.0,
    oxidizer_fact_text_override: 'ring observed'
  };

  const createResponse = await app.inject({
    method: 'POST',
    url: `/v1/scenarios/${scenarioId}/shapes`,
    headers: { 'x-trainer-ref': 'trainer@example.com' },
    payload
  });
  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as Record<string, unknown>;
  assert.equal(created.oxidizerEnabled, true);
  assert.equal(created.oxidizerTargetType, 'iodine');
  assert.equal(created.oxidizerConcentrationPpm, 5);
  assert.equal(created.oxidizerSamplePh, 5);
  assert.equal(created.oxidizerReactionResult, 'highPositive');
  assert.equal(created.oxidizerReactionPattern, 'blueVioletRing');
  assert.equal(created.oxidizerReactionDurationSeconds, 5);
  assert.equal(created.oxidizerFactTextOverride, 'ring observed');

  const getResponse = await app.inject({
    method: 'GET',
    url: `/v1/scenarios/${scenarioId}/shapes`,
    headers: { 'x-trainer-ref': 'trainer@example.com' }
  });
  assert.equal(getResponse.statusCode, 200);
  const shapes = getResponse.json() as Array<Record<string, unknown>>;
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0]?.oxidizerEnabled, true);
  assert.equal(shapes[0]?.oxidizerTargetType, 'iodine');
  assert.equal(shapes[0]?.oxidizerConcentrationPpm, 5);
  assert.equal(shapes[0]?.oxidizerSamplePh, 5);
  assert.equal(shapes[0]?.oxidizerReactionResult, 'highPositive');
  assert.equal(shapes[0]?.oxidizerReactionPattern, 'blueVioletRing');
  assert.equal(shapes[0]?.oxidizerReactionDurationSeconds, 5);
  assert.equal(shapes[0]?.oxidizerFactTextOverride, 'ring observed');

  await app.close();
});

test('PUT shape returns wet chemistry oxidizer fields for existing shape', async () => {
  const scenarioId = '55555555-5555-5555-5555-555555555555';
  const shapeId = '66666666-6666-6666-6666-666666666666';
  const trainerId = '77777777-7777-7777-7777-777777777777';
  const organizationId = '88888888-8888-8888-8888-888888888888';

  let persistedShape: Record<string, unknown> | null = null;
  const fakePg = {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.toLowerCase().includes('begin') || sql.toLowerCase().includes('commit') || sql.toLowerCase().includes('rollback')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('insert into trainers')) {
          return {
            rows: [
              {
                trainer_id: trainerId,
                trainer_ref: 'trainer@example.com',
                email: 'trainer@example.com',
                display_name: 'trainer@example.com',
                is_active: true
              }
            ],
            rowCount: 1
          };
        }
        if (sql.includes('from organization_memberships m')) {
          return {
            rows: [
              {
                organization_id: organizationId,
                organization_name: 'Trainer Personal',
                role: 'org_admin',
                is_active: true
              }
            ],
            rowCount: 1
          };
        }
        throw new Error(`Unexpected connect() query: ${sql}`);
      },
      release: () => {}
    }),
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('from scenarios') && sql.includes('where id = $1::uuid') && sql.includes('visibility')) {
        return {
          rows: [
            {
              created_by_trainer_id: trainerId,
              assigned_trainer_id: null,
              organization_id: organizationId,
              trainer_ref: 'trainer@example.com',
              visibility: 'private'
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('update scenario_shapes')) {
        const propertiesJson = JSON.parse(String(params?.[41] ?? '{}')) as Record<string, unknown>;
        persistedShape = {
          id: shapeId,
          scenario_id: scenarioId,
          description: String(params?.[2] ?? ''),
          kind: String(params?.[3] ?? 'polygon'),
          sort_order: Number(params?.[4] ?? 0),
          display_color_hex: params?.[5] ?? null,
          shape_geo_json: String(params?.[6] ?? ''),
          radius_m: params?.[7] ?? null,
          oxygen: null,
          lel: null,
          carbon_monoxide: null,
          hydrogen_sulfide: null,
          pid: null,
          oxygen_high_sampling_mode: null,
          oxygen_high_feather_percent: null,
          oxygen_low_sampling_mode: null,
          oxygen_low_feather_percent: null,
          lel_high_sampling_mode: null,
          lel_high_feather_percent: null,
          lel_low_sampling_mode: null,
          lel_low_feather_percent: null,
          carbon_monoxide_high_sampling_mode: null,
          carbon_monoxide_high_feather_percent: null,
          carbon_monoxide_low_sampling_mode: null,
          carbon_monoxide_low_feather_percent: null,
          hydrogen_sulfide_high_sampling_mode: null,
          hydrogen_sulfide_high_feather_percent: null,
          hydrogen_sulfide_low_sampling_mode: null,
          hydrogen_sulfide_low_feather_percent: null,
          pid_high_sampling_mode: null,
          pid_high_feather_percent: null,
          pid_low_sampling_mode: null,
          pid_low_feather_percent: null,
          chemical_readings: [],
          properties_json: propertiesJson,
          dose_rate: null,
          background: null,
          shielding: null,
          rad_latitude: null,
          rad_longitude: null,
          rad_dose_unit: null,
          rad_exposure_unit: null,
          ph: null
        };
        return { rows: [persistedShape], rowCount: 1 };
      }
      if (sql.includes('from scenario_shapes ss') && sql.includes('where ss.scenario_id = $1::uuid')) {
        return { rows: persistedShape ? [persistedShape] : [], rowCount: persistedShape ? 1 : 0 };
      }
      if (sql.includes('from scenarios s') && sql.includes('where s.id = $1::uuid')) {
        return {
          rows: [
            {
              id: scenarioId,
              scenario_name: 'Chem Drill',
              trainer_name: 'Trainer',
              scenario_date: '2026-04-28T00:00:00.000Z',
              latitude: null,
              longitude: null,
              detection_device: 'wet_chemistry_paper',
              version: 1,
              created_at: '2026-04-28T00:00:00.000Z',
              updated_at: '2026-04-28T00:00:00.000Z'
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('from scenario_sessions ss')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('update session_snapshots')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    }
  };

  const app = Fastify();
  (app as unknown as { decorate: (name: string, value: unknown) => void }).decorate('config', {
    authTokenSecret: 'test-secret',
    supabaseUrl: null,
    supabaseAnonKey: null
  });
  (app as unknown as { decorate: (name: string, value: unknown) => void }).decorate('pg', fakePg);
  app.register(scenariosRoutes);
  await app.ready();

  const updateResponse = await app.inject({
    method: 'PUT',
    url: `/v1/scenarios/${scenarioId}/shapes/${shapeId}`,
    headers: { 'x-trainer-ref': 'trainer@example.com' },
    payload: {
      description: 'Potassium Iodide Starch Paper',
      kind: 'polygon',
      sort_order: 1,
      shape_geo_json: '{"type":"Polygon","coordinates":[]}',
      oxidizer_enabled: true,
      oxidizer_target_type: 'iodine',
      oxidizer_concentration_ppm: 5.0,
      oxidizer_sample_ph: 5.0,
      oxidizer_reaction_result: 'highPositive',
      oxidizer_reaction_pattern: 'blueVioletRing',
      oxidizer_reaction_duration_seconds: 5.0,
      oxidizer_fact_text_override: 'ring observed'
    }
  });
  assert.equal(updateResponse.statusCode, 200);
  const updated = updateResponse.json() as Record<string, unknown>;
  assert.equal(updated.oxidizerEnabled, true);
  assert.equal(updated.oxidizerTargetType, 'iodine');
  assert.equal(updated.oxidizerConcentrationPpm, 5);
  assert.equal(updated.oxidizerSamplePh, 5);
  assert.equal(updated.oxidizerReactionResult, 'highPositive');
  assert.equal(updated.oxidizerReactionPattern, 'blueVioletRing');
  assert.equal(updated.oxidizerReactionDurationSeconds, 5);
  assert.equal(updated.oxidizerFactTextOverride, 'ring observed');

  await app.close();
});
