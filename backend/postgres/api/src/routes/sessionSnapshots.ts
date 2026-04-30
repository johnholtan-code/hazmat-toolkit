import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

export type DBScenarioRow = {
  id: string;
  scenario_name: string;
  trainer_name: string;
  scenario_date: string | null;
  latitude: number | null;
  longitude: number | null;
  detection_device: 'air_monitor' | 'radiation_detection' | 'ph_paper' | 'wet_chemistry_paper';
  version: number;
  created_at: string;
  updated_at: string;
};

export type DBShapeRow = {
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
  oxygen_high_sampling_mode: string | null;
  oxygen_high_feather_percent: string | null;
  oxygen_low_sampling_mode: string | null;
  oxygen_low_feather_percent: string | null;
  lel_high_sampling_mode: string | null;
  lel_high_feather_percent: string | null;
  lel_low_sampling_mode: string | null;
  lel_low_feather_percent: string | null;
  carbon_monoxide_high_sampling_mode: string | null;
  carbon_monoxide_high_feather_percent: string | null;
  carbon_monoxide_low_sampling_mode: string | null;
  carbon_monoxide_low_feather_percent: string | null;
  hydrogen_sulfide_high_sampling_mode: string | null;
  hydrogen_sulfide_high_feather_percent: string | null;
  hydrogen_sulfide_low_sampling_mode: string | null;
  hydrogen_sulfide_low_feather_percent: string | null;
  pid_high_sampling_mode: string | null;
  pid_high_feather_percent: string | null;
  pid_low_sampling_mode: string | null;
  pid_low_feather_percent: string | null;
  chemical_readings: unknown;
  properties_json: unknown;
  dose_rate: string | null;
  background: string | null;
  shielding: string | null;
  rad_latitude: string | null;
  rad_longitude: string | null;
  rad_dose_unit: string | null;
  rad_exposure_unit: string | null;
  ph: number | null;
  oxidizer_enabled: boolean | null;
  oxidizer_target_type: string | null;
  oxidizer_concentration_ppm: number | null;
  oxidizer_sample_ph: number | null;
  oxidizer_reaction_result: string | null;
  oxidizer_reaction_pattern: string | null;
  oxidizer_reaction_duration_seconds: number | null;
  oxidizer_fact_text_override: string | null;
};

type SessionSnapshotRow = { id: string };
type SessionSnapshotFreshnessRow = {
  scenario_id: string;
  scenario_version: number;
  snapshot_version: number;
  snapshot_created_at: string;
  scenario_updated_at: string;
  latest_shape_updated_at: string | null;
};

type Queryable = {
  query: PoolClient['query'];
};

export function buildSessionSnapshot(sessionID: string, scenario: DBScenarioRow, shapes: DBShapeRow[]) {
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
    shapes: shapes.map((shape) => {
      const oxidizerFromProperties = extractOxidizerShapeFields(shape.properties_json);
      const oxidizer = {
        oxidizerEnabled: shape.oxidizer_enabled ?? oxidizerFromProperties.oxidizerEnabled,
        oxidizerTargetType: shape.oxidizer_target_type ?? oxidizerFromProperties.oxidizerTargetType,
        oxidizerConcentrationPpm: shape.oxidizer_concentration_ppm ?? oxidizerFromProperties.oxidizerConcentrationPpm,
        oxidizerSamplePh: shape.oxidizer_sample_ph ?? oxidizerFromProperties.oxidizerSamplePh,
        oxidizerReactionResult: shape.oxidizer_reaction_result ?? oxidizerFromProperties.oxidizerReactionResult,
        oxidizerReactionPattern: shape.oxidizer_reaction_pattern ?? oxidizerFromProperties.oxidizerReactionPattern,
        oxidizerReactionDurationSeconds:
          shape.oxidizer_reaction_duration_seconds ?? oxidizerFromProperties.oxidizerReactionDurationSeconds,
        oxidizerFactTextOverride: shape.oxidizer_fact_text_override ?? oxidizerFromProperties.oxidizerFactTextOverride
      };
      return {
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
        oxygenHighSamplingMode: shape.oxygen_high_sampling_mode,
        oxygenHighFeatherPercent: shape.oxygen_high_feather_percent ? parseFloat(shape.oxygen_high_feather_percent) : null,
        oxygenLowSamplingMode: shape.oxygen_low_sampling_mode,
        oxygenLowFeatherPercent: shape.oxygen_low_feather_percent ? parseFloat(shape.oxygen_low_feather_percent) : null,
        lelHighSamplingMode: shape.lel_high_sampling_mode,
        lelHighFeatherPercent: shape.lel_high_feather_percent ? parseFloat(shape.lel_high_feather_percent) : null,
        lelLowSamplingMode: shape.lel_low_sampling_mode,
        lelLowFeatherPercent: shape.lel_low_feather_percent ? parseFloat(shape.lel_low_feather_percent) : null,
        carbonMonoxideHighSamplingMode: shape.carbon_monoxide_high_sampling_mode,
        carbonMonoxideHighFeatherPercent: shape.carbon_monoxide_high_feather_percent ? parseFloat(shape.carbon_monoxide_high_feather_percent) : null,
        carbonMonoxideLowSamplingMode: shape.carbon_monoxide_low_sampling_mode,
        carbonMonoxideLowFeatherPercent: shape.carbon_monoxide_low_feather_percent ? parseFloat(shape.carbon_monoxide_low_feather_percent) : null,
        hydrogenSulfideHighSamplingMode: shape.hydrogen_sulfide_high_sampling_mode,
        hydrogenSulfideHighFeatherPercent: shape.hydrogen_sulfide_high_feather_percent ? parseFloat(shape.hydrogen_sulfide_high_feather_percent) : null,
        hydrogenSulfideLowSamplingMode: shape.hydrogen_sulfide_low_sampling_mode,
        hydrogenSulfideLowFeatherPercent: shape.hydrogen_sulfide_low_feather_percent ? parseFloat(shape.hydrogen_sulfide_low_feather_percent) : null,
        pidHighSamplingMode: shape.pid_high_sampling_mode,
        pidHighFeatherPercent: shape.pid_high_feather_percent ? parseFloat(shape.pid_high_feather_percent) : null,
        pidLowSamplingMode: shape.pid_low_sampling_mode,
        pidLowFeatherPercent: shape.pid_low_feather_percent ? parseFloat(shape.pid_low_feather_percent) : null,
        oxidizerEnabled: oxidizer.oxidizerEnabled,
        oxidizerTargetType: oxidizer.oxidizerTargetType,
        oxidizerConcentrationPpm: oxidizer.oxidizerConcentrationPpm,
        oxidizerSamplePh: oxidizer.oxidizerSamplePh,
        oxidizerReactionResult: oxidizer.oxidizerReactionResult,
        oxidizerReactionPattern: oxidizer.oxidizerReactionPattern,
        oxidizerReactionDurationSeconds: oxidizer.oxidizerReactionDurationSeconds,
        oxidizerFactTextOverride: oxidizer.oxidizerFactTextOverride,
        chemicalReadings: Array.isArray(shape.chemical_readings) ? shape.chemical_readings : [],
        doseRate: shape.dose_rate,
        background: shape.background,
        shielding: shape.shielding,
        radLatitude: shape.rad_latitude,
        radLongitude: shape.rad_longitude,
        radDoseUnit: shape.rad_dose_unit,
        radExposureUnit: shape.rad_exposure_unit,
        pH: shape.ph
      };
    }),
    rules: {
      overlapPriority: 'LOWER_SORT_ORDER_WINS'
    }
  };
}

export async function fetchScenarioForSnapshot(client: Queryable, scenarioID: string): Promise<DBScenarioRow | null> {
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
        s.updated_at
      from scenarios s
      left join trainers t on t.id = s.trainer_id
      where s.id = $1::uuid
      limit 1
    `,
    [scenarioID]
  );
  return result.rows[0] ?? null;
}

export async function fetchScenarioShapesForSnapshot(client: Queryable, scenarioID: string): Promise<DBShapeRow[]> {
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
        ss.oxygen_high_sampling_mode,
        ss.oxygen_high_feather_percent::text as oxygen_high_feather_percent,
        ss.oxygen_low_sampling_mode,
        ss.oxygen_low_feather_percent::text as oxygen_low_feather_percent,
        ss.lel_high_sampling_mode,
        ss.lel_high_feather_percent::text as lel_high_feather_percent,
        ss.lel_low_sampling_mode,
        ss.lel_low_feather_percent::text as lel_low_feather_percent,
        ss.carbon_monoxide_high_sampling_mode,
        ss.carbon_monoxide_high_feather_percent::text as carbon_monoxide_high_feather_percent,
        ss.carbon_monoxide_low_sampling_mode,
        ss.carbon_monoxide_low_feather_percent::text as carbon_monoxide_low_feather_percent,
        ss.hydrogen_sulfide_high_sampling_mode,
        ss.hydrogen_sulfide_high_feather_percent::text as hydrogen_sulfide_high_feather_percent,
        ss.hydrogen_sulfide_low_sampling_mode,
        ss.hydrogen_sulfide_low_feather_percent::text as hydrogen_sulfide_low_feather_percent,
        ss.pid_high_sampling_mode,
        ss.pid_high_feather_percent::text as pid_high_feather_percent,
        ss.pid_low_sampling_mode,
        ss.pid_low_feather_percent::text as pid_low_feather_percent,
        coalesce(ss.properties_json -> 'chemicalReadings', '[]'::jsonb) as chemical_readings,
        ss.properties_json,
        ss.dose_rate,
        ss.background,
        ss.shielding,
        ss.rad_latitude::text as rad_latitude,
        ss.rad_longitude::text as rad_longitude,
        ss.rad_dose_unit,
        ss.rad_exposure_unit,
        ss.ph::float8 as ph,
        ss.oxidizer_enabled,
        ss.oxidizer_target_type,
        ss.oxidizer_concentration_ppm::float8 as oxidizer_concentration_ppm,
        ss.oxidizer_sample_ph::float8 as oxidizer_sample_ph,
        ss.oxidizer_reaction_result,
        ss.oxidizer_reaction_pattern,
        ss.oxidizer_reaction_duration_seconds::float8 as oxidizer_reaction_duration_seconds,
        ss.oxidizer_fact_text_override
      from scenario_shapes ss
      where ss.scenario_id = $1::uuid
      order by ss.sort_order asc, ss.created_at asc
    `,
    [scenarioID]
  );
  return result.rows;
}

export async function refreshSessionSnapshotsForScenario(client: Queryable, scenarioID: string): Promise<void> {
  const scenario = await fetchScenarioForSnapshot(client, scenarioID);
  if (!scenario) return;

  const [shapesResult, sessionsResult] = await Promise.all([
    fetchScenarioShapesForSnapshot(client, scenarioID),
    client.query<SessionSnapshotRow>(
      `
        select ss.id::text as id
        from scenario_sessions ss
        join session_snapshots snap on snap.session_id = ss.id
        where ss.scenario_id = $1::uuid
          and ss.status in ('scheduled', 'live')
      `,
      [scenarioID]
    )
  ]);

  for (const session of sessionsResult.rows) {
    await writeSessionSnapshot(client, session.id, scenario, shapesResult);
  }
}

export async function refreshSessionSnapshotIfStale(client: Queryable, sessionID: string): Promise<void> {
  const result = await client.query<SessionSnapshotFreshnessRow>(
    `
      select
        ss.scenario_id::text as scenario_id,
        s.version as scenario_version,
        snap.scenario_version as snapshot_version,
        snap.created_at as snapshot_created_at,
        s.updated_at as scenario_updated_at,
        max(sh.updated_at) as latest_shape_updated_at
      from scenario_sessions ss
      join session_snapshots snap on snap.session_id = ss.id
      join scenarios s on s.id = ss.scenario_id
      left join scenario_shapes sh on sh.scenario_id = ss.scenario_id
      where ss.id = $1::uuid
      group by ss.scenario_id, s.version, snap.scenario_version, snap.created_at, s.updated_at
      limit 1
    `,
    [sessionID]
  );

  const row = result.rows[0];
  if (!row) return;

  const snapshotCreatedAt = new Date(row.snapshot_created_at).getTime();
  const scenarioUpdatedAt = new Date(row.scenario_updated_at).getTime();
  const latestShapeUpdatedAt = row.latest_shape_updated_at ? new Date(row.latest_shape_updated_at).getTime() : 0;
  const isStale =
    row.snapshot_version !== row.scenario_version ||
    scenarioUpdatedAt > snapshotCreatedAt ||
    latestShapeUpdatedAt > snapshotCreatedAt;

  if (!isStale) return;

  const scenario = await fetchScenarioForSnapshot(client, row.scenario_id);
  if (!scenario) return;
  const shapes = await fetchScenarioShapesForSnapshot(client, row.scenario_id);
  await writeSessionSnapshot(client, sessionID, scenario, shapes);
}

async function writeSessionSnapshot(
  client: Queryable,
  sessionID: string,
  scenario: DBScenarioRow,
  shapes: DBShapeRow[]
): Promise<void> {
  const snapshot = buildSessionSnapshot(sessionID, scenario, shapes);
  const snapshotJSONString = JSON.stringify(snapshot);
  const snapshotSHA256 = createHash('sha256').update(snapshotJSONString).digest('hex');
  await client.query(
    `
      update session_snapshots
      set
        scenario_version = $3,
        snapshot_json = $2::jsonb,
        snapshot_sha256 = $4,
        created_at = now()
      where session_id = $1::uuid
    `,
    [sessionID, snapshotJSONString, scenario.version, snapshotSHA256]
  );
}

const OXIDIZER_TARGET_TYPES = new Set(['freeChlorine', 'nitrite', 'iodine', 'peroxide', 'genericOxidizer']);
const OXIDIZER_REACTION_RESULTS = new Set(['negative', 'lowPositive', 'highPositive', 'invalidPH', 'unknown']);
const OXIDIZER_REACTION_PATTERNS = new Set(['none', 'blueVioletRing', 'blueVioletSpot', 'fullStripDarkening']);

type OxidizerShapeFields = {
  oxidizerEnabled: boolean;
  oxidizerTargetType: string | null;
  oxidizerConcentrationPpm: number | null;
  oxidizerSamplePh: number | null;
  oxidizerReactionResult: string | null;
  oxidizerReactionPattern: string | null;
  oxidizerReactionDurationSeconds: number | null;
  oxidizerFactTextOverride: string | null;
};

function extractOxidizerShapeFields(value: unknown): OxidizerShapeFields {
  const object = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const enabledValue = object.oxidizerEnabled ?? object.oxidizer_enabled;
  const enabled =
    enabledValue === true ||
    (typeof enabledValue === 'string' &&
      enabledValue.trim().length > 0 &&
      enabledValue.trim().toLowerCase() === 'true');
  if (!enabled) {
    return {
      oxidizerEnabled: false,
      oxidizerTargetType: null,
      oxidizerConcentrationPpm: null,
      oxidizerSamplePh: null,
      oxidizerReactionResult: null,
      oxidizerReactionPattern: null,
      oxidizerReactionDurationSeconds: null,
      oxidizerFactTextOverride: null
    };
  }

  return {
    oxidizerEnabled: true,
    oxidizerTargetType: normalizeEnumValue(
      object.oxidizerTargetType ?? object.oxidizer_target_type,
      OXIDIZER_TARGET_TYPES
    ),
    oxidizerConcentrationPpm: normalizeUnknownNumber(
      object.oxidizerConcentrationPpm ??
        object.oxidizer_concentration_ppm ??
        object.oxidizerConcentrationPPM ??
        object.oxidizer_concentration_PPM
    ),
    oxidizerSamplePh: normalizeUnknownNumber(
      object.oxidizerSamplePh ??
        object.oxidizer_sample_ph ??
        object.oxidizerSamplePH ??
        object.oxidizer_sample_pH
    ),
    oxidizerReactionResult: normalizeEnumValue(
      object.oxidizerReactionResult ?? object.oxidizer_reaction_result,
      OXIDIZER_REACTION_RESULTS
    ),
    oxidizerReactionPattern: normalizeEnumValue(
      object.oxidizerReactionPattern ?? object.oxidizer_reaction_pattern,
      OXIDIZER_REACTION_PATTERNS
    ),
    oxidizerReactionDurationSeconds: normalizeUnknownNumber(
      object.oxidizerReactionDurationSeconds ?? object.oxidizer_reaction_duration_seconds
    ),
    oxidizerFactTextOverride: normalizeOptionalText(
      typeof object.oxidizerFactTextOverride === 'string'
        ? object.oxidizerFactTextOverride
        : typeof object.oxidizer_fact_text_override === 'string'
          ? object.oxidizer_fact_text_override
          : null
    )
  };
}

function normalizeEnumValue(value: unknown, allowed: Set<string>): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return allowed.has(trimmed) ? trimmed : null;
}

function normalizeUnknownNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
