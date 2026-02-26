import type { FastifyPluginAsync } from 'fastify';
import { readTrainerRefHeader } from './_trainerAuth.js';

type ScenarioParams = { scenarioId: string };
type ShapeParams = { scenarioId: string; shapeId: string };

type ScenarioBody = {
  scenario_name?: string;
  trainer_name?: string;
  scenario_date?: string;
  latitude?: number | null;
  longitude?: number | null;
  detection_device?: 'air_monitor' | 'radiation_detection' | 'ph_paper';
  notes?: string | null;
};

type ShapeBody = {
  description?: string;
  kind?: 'polygon' | 'circle' | 'point';
  sort_order?: number;
  display_color_hex?: string | null;
  shape_geo_json?: string;
  radius_m?: number | null;
  oxygen?: string | null;
  lel?: string | null;
  carbon_monoxide?: string | null;
  hydrogen_sulfide?: string | null;
  pid?: string | null;
  chemical_readings?: unknown;
  dose_rate?: string | null;
  background?: string | null;
  shielding?: string | null;
  rad_latitude?: string | null;
  rad_longitude?: string | null;
  rad_dose_unit?: string | null;
  rad_exposure_unit?: string | null;
  p_h?: number | null;
  // camelCase compatibility
  sortOrder?: number;
  displayColorHex?: string | null;
  shapeGeoJSON?: string;
  radiusM?: number | null;
  chemicalReadings?: unknown;
  doseRate?: string | null;
  radLatitude?: string | null;
  radLongitude?: string | null;
  radDoseUnit?: string | null;
  radExposureUnit?: string | null;
  pH?: number | null;
};

type ScenarioRow = {
  id: string;
  scenario_name: string;
  trainer_name: string;
  scenario_date: string;
  latitude: number | null;
  longitude: number | null;
  detection_device: 'air_monitor' | 'radiation_detection' | 'ph_paper';
  version: number;
  created_at: string;
  updated_at: string;
};

type ShapeRow = {
  id: string;
  scenario_id: string;
  description: string;
  kind: 'polygon' | 'circle' | 'point';
  sort_order: number;
  display_color_hex: string | null;
  shape_geo_json: string | null;
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

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scenarios', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    const result = await app.pg.query<ScenarioRow>(
      `
        select
          s.id::text as id,
          s.scenario_name,
          coalesce(t.display_name, s.trainer_ref, 'Trainer') as trainer_name,
          coalesce(s.scenario_date, s.created_at)::timestamptz as scenario_date,
          case when s.center_geog is null then null else ST_Y(s.center_geog::geometry) end as latitude,
          case when s.center_geog is null then null else ST_X(s.center_geog::geometry) end as longitude,
          s.detection_device::text as detection_device,
          s.version,
          s.created_at,
          s.updated_at
        from scenarios s
        left join trainers t on t.id = s.trainer_id
        where ($1::text is null or s.trainer_ref = $1::text)
        order by s.created_at desc
      `,
      [trainerRef]
    );
    return reply.send(result.rows.map(mapScenarioRow));
  });

  app.post<{ Body: ScenarioBody }>('/v1/scenarios', async (request, reply) => {
    const body = request.body ?? {};
    if (!body.scenario_name || !body.trainer_name || !body.scenario_date || !body.detection_device) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Missing required scenario fields.' });
    }

    const trainerRef = readTrainerRefHeader(request.headers) ?? body.trainer_name.trim();
    const trainerName = body.trainer_name.trim();
    const notes = body.notes ?? '';

    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const trainer = await upsertTrainerIfPossible(client, trainerRef, trainerName);

      const inserted = await client.query<ScenarioRow>(
        `
          insert into scenarios (
            trainer_id,
            trainer_ref,
            scenario_name,
            detection_device,
            scenario_date,
            notes,
            center_geog,
            status
          )
          values (
            $1::uuid,
            $2,
            $3,
            $4::device_type,
            $5::timestamptz,
            $6,
            case
              when $7::float8 is null or $8::float8 is null then null
              else ST_SetSRID(ST_MakePoint($8::float8, $7::float8), 4326)::geography
            end,
            'draft'
          )
          returning
            id::text as id,
            scenario_name,
            $9::text as trainer_name,
            coalesce(scenario_date, created_at)::timestamptz as scenario_date,
            case when center_geog is null then null else ST_Y(center_geog::geometry) end as latitude,
            case when center_geog is null then null else ST_X(center_geog::geometry) end as longitude,
            detection_device::text as detection_device,
            version,
            created_at,
            updated_at
        `,
        [
          trainer?.id ?? null,
          trainerRef,
          body.scenario_name,
          body.detection_device,
          body.scenario_date,
          notes,
          body.latitude ?? null,
          body.longitude ?? null,
          trainerName
        ]
      );

      await client.query('COMMIT');
      return reply.code(201).send(mapScenarioRow(inserted.rows[0]));
    } catch (error) {
      await client.query('ROLLBACK');
      app.log.error({ err: error }, 'createScenario failed');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create scenario.' });
    } finally {
      client.release();
    }
  });

  app.patch<{ Params: ScenarioParams; Body: ScenarioBody }>('/v1/scenarios/:scenarioId', async (request, reply) => {
    const body = request.body ?? {};
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'X-Trainer-Ref header required.' });
    }
    const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
    if (ownsScenario === 'not_found') {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
    }
    if (ownsScenario === 'forbidden') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
    }
    if (!body.scenario_name || !body.trainer_name || !body.scenario_date || !body.detection_device) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Missing required scenario fields.' });
    }

    const client = await app.pg.connect();
    try {
      await client.query('BEGIN');
      const trainer = await upsertTrainerIfPossible(client, trainerRef, body.trainer_name.trim());
      const updated = await client.query<ScenarioRow>(
        `
          update scenarios
          set
            trainer_id = $2::uuid,
            trainer_ref = $3,
            scenario_name = $4,
            detection_device = $5::device_type,
            scenario_date = $6::timestamptz,
            center_geog = case
              when $7::float8 is null or $8::float8 is null then null
              else ST_SetSRID(ST_MakePoint($8::float8, $7::float8), 4326)::geography
            end,
            version = version + 1
          where id = $1::uuid
          returning
            id::text as id,
            scenario_name,
            $9::text as trainer_name,
            coalesce(scenario_date, created_at)::timestamptz as scenario_date,
            case when center_geog is null then null else ST_Y(center_geog::geometry) end as latitude,
            case when center_geog is null then null else ST_X(center_geog::geometry) end as longitude,
            detection_device::text as detection_device,
            version,
            created_at,
            updated_at
        `,
        [
          request.params.scenarioId,
          trainer?.id ?? null,
          trainerRef,
          body.scenario_name,
          body.detection_device,
          body.scenario_date,
          body.latitude ?? null,
          body.longitude ?? null,
          body.trainer_name.trim()
        ]
      );
      await client.query('COMMIT');
      if (updated.rowCount === 0) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
      }
      return reply.send(mapScenarioRow(updated.rows[0]));
    } catch (error) {
      await client.query('ROLLBACK');
      app.log.error({ err: error }, 'updateScenario failed');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update scenario.' });
    } finally {
      client.release();
    }
  });

  app.delete<{ Params: ScenarioParams }>('/v1/scenarios/:scenarioId', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'X-Trainer-Ref header required.' });
    }
    const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
    if (ownsScenario === 'not_found') {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
    }
    if (ownsScenario === 'forbidden') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
    }

    await app.pg.query('delete from scenarios where id = $1::uuid', [request.params.scenarioId]);
    return reply.code(204).send();
  });

  app.get<{ Params: ScenarioParams }>('/v1/scenarios/:scenarioId/shapes', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (trainerRef) {
      const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
      if (ownsScenario === 'not_found') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
      }
      if (ownsScenario === 'forbidden') {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
      }
    }

    const result = await app.pg.query<ShapeRow>(
      `
        select
          ss.id::text as id,
          ss.scenario_id::text as scenario_id,
          ss.description,
          ss.kind::text as kind,
          ss.sort_order,
          ss.display_color_hex,
          ST_AsGeoJSON(ss.geom)::text as shape_geo_json,
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
      [request.params.scenarioId]
    );

    return reply.send(result.rows.map(mapShapeRow));
  });

  app.post<{ Params: ScenarioParams; Body: ShapeBody }>('/v1/scenarios/:scenarioId/shapes', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'X-Trainer-Ref header required.' });
    }
    const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
    if (ownsScenario === 'not_found') {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
    }
    if (ownsScenario === 'forbidden') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
    }

    const created = await insertOrUpdateShape(app, request.params.scenarioId, null, request.body ?? {});
    if (!created) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Invalid shape payload.' });
    }
    return reply.code(201).send(created);
  });

  app.put<{ Params: ShapeParams; Body: ShapeBody }>('/v1/scenarios/:scenarioId/shapes/:shapeId', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'X-Trainer-Ref header required.' });
    }
    const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
    if (ownsScenario === 'not_found') {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
    }
    if (ownsScenario === 'forbidden') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
    }

    const saved = await insertOrUpdateShape(app, request.params.scenarioId, request.params.shapeId, request.body ?? {});
    if (!saved) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Invalid shape payload.' });
    }
    return reply.send(saved);
  });

  app.delete<{ Params: ShapeParams }>('/v1/scenarios/:scenarioId/shapes/:shapeId', async (request, reply) => {
    const trainerRef = readTrainerRefHeader(request.headers);
    if (!trainerRef) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'X-Trainer-Ref header required.' });
    }
    const ownsScenario = await trainerOwnsScenario(app, request.params.scenarioId, trainerRef);
    if (ownsScenario === 'not_found') {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Scenario not found.' });
    }
    if (ownsScenario === 'forbidden') {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Trainer does not own this scenario.' });
    }

    await app.pg.query(
      'delete from scenario_shapes where id = $1::uuid and scenario_id = $2::uuid',
      [request.params.shapeId, request.params.scenarioId]
    );
    return reply.code(204).send();
  });
};

function mapScenarioRow(row: ScenarioRow) {
  return {
    id: row.id,
    scenarioName: row.scenario_name,
    trainerName: row.trainer_name,
    scenarioDate: row.scenario_date,
    latitude: row.latitude,
    longitude: row.longitude,
    detectionDevice: row.detection_device,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapShapeRow(row: ShapeRow) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    description: row.description,
    kind: row.kind,
    sortOrder: row.sort_order,
    displayColorHex: row.display_color_hex,
    shapeGeoJSON: row.shape_geo_json ?? '',
    radiusM: row.radius_m,
    oxygen: row.oxygen,
    lel: row.lel,
    carbonMonoxide: row.carbon_monoxide,
    hydrogenSulfide: row.hydrogen_sulfide,
    pid: row.pid,
    chemicalReadings: Array.isArray(row.chemical_readings) ? row.chemical_readings : [],
    doseRate: row.dose_rate,
    background: row.background,
    shielding: row.shielding,
    radLatitude: row.rad_latitude,
    radLongitude: row.rad_longitude,
    radDoseUnit: row.rad_dose_unit,
    radExposureUnit: row.rad_exposure_unit,
    pH: row.ph
  };
}

async function upsertTrainerIfPossible(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }> },
  trainerRef: string | null,
  trainerName: string
): Promise<{ id: string } | null> {
  if (!trainerRef) return null;
  const result = await client.query(
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

async function trainerOwnsScenario(
  app: { pg: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: Array<{ trainer_ref: string | null }> }> } },
  scenarioID: string,
  trainerRef: string
): Promise<'ok' | 'forbidden' | 'not_found'> {
  const result = await app.pg.query(
    'select trainer_ref from scenarios where id = $1::uuid limit 1',
    [scenarioID]
  );
  if (result.rowCount === 0) return 'not_found';
  const owner = (result.rows[0].trainer_ref ?? '').trim();
  if (!owner) return 'forbidden';
  return owner.localeCompare(trainerRef, undefined, { sensitivity: 'accent' }) === 0 ? 'ok' : 'forbidden';
}

async function insertOrUpdateShape(
  app: { pg: { query: (sql: string, params?: unknown[]) => Promise<{ rows: ShapeRow[]; rowCount: number }> } },
  scenarioID: string,
  shapeID: string | null,
  body: ShapeBody
): Promise<ReturnType<typeof mapShapeRow> | null> {
  const normalized = normalizeShapeBody(body);
  if (!normalized.description || !normalized.kind || normalized.sort_order == null || !normalized.shape_geo_json) {
    return null;
  }

  const chemicalReadings = Array.isArray(normalized.chemical_readings) ? normalized.chemical_readings : [];
  const propertiesJSON = JSON.stringify({ chemicalReadings });

  const params = [
    shapeID ?? null,
    scenarioID,
    normalized.description,
    normalized.kind,
    normalized.sort_order,
    normalized.display_color_hex ?? null,
    normalized.shape_geo_json,
    normalized.radius_m ?? null,
    normalizeNumericString(normalized.oxygen),
    normalizeNumericString(normalized.lel),
    normalizeNumericString(normalized.carbon_monoxide),
    normalizeNumericString(normalized.hydrogen_sulfide),
    normalizeNumericString(normalized.pid),
    normalized.dose_rate ?? null,
    normalized.background ?? null,
    normalized.shielding ?? null,
    normalizeNumericString(normalized.rad_latitude),
    normalizeNumericString(normalized.rad_longitude),
    normalized.rad_dose_unit ?? null,
    normalized.rad_exposure_unit ?? null,
    normalized.p_h ?? null,
    propertiesJSON
  ];

  try {
    if (shapeID) {
      const updated = await app.pg.query(updateShapeSQL, params);
      if (updated.rowCount && updated.rowCount > 0) {
        return mapShapeRow(updated.rows[0]);
      }
    }

    const inserted = await app.pg.query(shapeID ? insertShapeWithIDSQL : insertShapeSQL, params);
    if (inserted.rowCount === 0) return null;
    return mapShapeRow(inserted.rows[0]);
  } catch (error) {
    // Surface details in backend logs; the route still returns a 400 for malformed/invalid shape payloads.
    console.error('insertOrUpdateShape failed', error);
    return null;
  }
}

function normalizeShapeBody(body: ShapeBody): ShapeBody {
  return {
    ...body,
    description: body.description ?? '',
    kind: body.kind ?? (undefined as unknown as ShapeBody['kind']),
    sort_order: body.sort_order ?? body.sortOrder,
    display_color_hex: body.display_color_hex ?? body.displayColorHex,
    shape_geo_json: body.shape_geo_json ?? body.shapeGeoJSON,
    radius_m: body.radius_m ?? body.radiusM,
    chemical_readings: body.chemical_readings ?? body.chemicalReadings,
    dose_rate: body.dose_rate ?? body.doseRate,
    rad_latitude: body.rad_latitude ?? body.radLatitude,
    rad_longitude: body.rad_longitude ?? body.radLongitude,
    rad_dose_unit: body.rad_dose_unit ?? body.radDoseUnit,
    rad_exposure_unit: body.rad_exposure_unit ?? body.radExposureUnit,
    p_h: body.p_h ?? body.pH
  };
}

const shapeReturningColumns = `
  returning
    id::text as id,
    scenario_id::text as scenario_id,
    description,
    kind::text as kind,
    sort_order,
    display_color_hex,
    ST_AsGeoJSON(geom)::text as shape_geo_json,
    radius_m,
    oxygen::text as oxygen,
    lel::text as lel,
    carbon_monoxide::text as carbon_monoxide,
    hydrogen_sulfide::text as hydrogen_sulfide,
    pid::text as pid,
    coalesce(properties_json -> 'chemicalReadings', '[]'::jsonb) as chemical_readings,
    dose_rate,
    background,
    shielding,
    rad_latitude::text as rad_latitude,
    rad_longitude::text as rad_longitude,
    rad_dose_unit,
    rad_exposure_unit,
    ph::float8 as ph
`;

const updateShapeSQL = `
  update scenario_shapes
  set
    description = $3,
    kind = $4::shape_kind,
    sort_order = $5::int,
    display_color_hex = $6,
    geom = ST_SetSRID(ST_GeomFromGeoJSON($7), 4326),
    radius_m = $8::float8,
    oxygen = $9::numeric,
    lel = $10::numeric,
    carbon_monoxide = $11::numeric,
    hydrogen_sulfide = $12::numeric,
    pid = $13::numeric,
    dose_rate = $14,
    background = $15,
    shielding = $16,
    rad_latitude = $17::float8,
    rad_longitude = $18::float8,
    rad_dose_unit = $19,
    rad_exposure_unit = $20,
    ph = $21::numeric,
    properties_json = $22::jsonb
  where id = $1::uuid and scenario_id = $2::uuid
  ${shapeReturningColumns}
`;

const insertShapeSQL = `
  insert into scenario_shapes (
    scenario_id, description, kind, sort_order, display_color_hex, geom, radius_m,
    oxygen, lel, carbon_monoxide, hydrogen_sulfide, pid,
    dose_rate, background, shielding,
    rad_latitude, rad_longitude, rad_dose_unit, rad_exposure_unit,
    ph, properties_json
  ) values (
    $2::uuid, $3, $4::shape_kind, $5::int, $6,
    ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), $8::float8,
    $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::numeric,
    $14, $15, $16,
    $17::float8, $18::float8, $19, $20,
    $21::numeric, $22::jsonb
  )
  ${shapeReturningColumns}
`;

const insertShapeWithIDSQL = `
  insert into scenario_shapes (
    id, scenario_id, description, kind, sort_order, display_color_hex, geom, radius_m,
    oxygen, lel, carbon_monoxide, hydrogen_sulfide, pid,
    dose_rate, background, shielding,
    rad_latitude, rad_longitude, rad_dose_unit, rad_exposure_unit,
    ph, properties_json
  ) values (
    $1::uuid, $2::uuid, $3, $4::shape_kind, $5::int, $6,
    ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), $8::float8,
    $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::numeric,
    $14, $15, $16,
    $17::float8, $18::float8, $19, $20,
    $21::numeric, $22::jsonb
  )
  ${shapeReturningColumns}
`;

function normalizeNumericString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
