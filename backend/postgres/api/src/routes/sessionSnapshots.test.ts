import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionSnapshot,
  refreshSessionSnapshotIfStale,
  refreshSessionSnapshotsForScenario,
  type DBScenarioRow,
  type DBShapeRow
} from './sessionSnapshots.js';

function makeScenario(): DBScenarioRow {
  return {
    id: 'scenario-1',
    scenario_name: 'Farm Test',
    trainer_name: 'Trainer',
    scenario_date: '2026-04-22T12:00:00.000Z',
    latitude: 29.1,
    longitude: -95.2,
    detection_device: 'air_monitor',
    version: 7,
    created_at: '2026-04-20T12:00:00.000Z',
    updated_at: '2026-04-22T12:00:00.000Z'
  };
}

function makeShape(): DBShapeRow {
  return {
    id: 'shape-1',
    scenario_id: 'scenario-1',
    description: 'Hot Zone',
    kind: 'polygon',
    sort_order: 1,
    display_color_hex: '#ff0000',
    shape_geojson: '{"type":"Polygon","coordinates":[]}',
    radius_m: null,
    oxygen: '20.9',
    lel: '100.000',
    carbon_monoxide: null,
    hydrogen_sulfide: null,
    pid: null,
    oxygen_high_sampling_mode: null,
    oxygen_high_feather_percent: null,
    oxygen_low_sampling_mode: null,
    oxygen_low_feather_percent: null,
    lel_high_sampling_mode: 'lower',
    lel_high_feather_percent: '50',
    lel_low_sampling_mode: 'lower',
    lel_low_feather_percent: '50',
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
    properties_json: {
      oxidizerEnabled: true,
      oxidizerTargetType: 'freeChlorine',
      oxidizerConcentrationPpm: 5,
      oxidizerSamplePh: 6.8,
      oxidizerReactionResult: 'lowPositive',
      oxidizerReactionPattern: 'blueVioletRing',
      oxidizerReactionDurationSeconds: 5,
      oxidizerFactTextOverride: 'A blue-violet ring indicates oxidizer presence.'
    },
    dose_rate: null,
    background: null,
    shielding: null,
    rad_latitude: null,
    rad_longitude: null,
    rad_dose_unit: null,
    rad_exposure_unit: null,
    ph: null,
    oxidizer_enabled: null,
    oxidizer_target_type: null,
    oxidizer_concentration_ppm: null,
    oxidizer_sample_ph: null,
    oxidizer_reaction_result: null,
    oxidizer_reaction_pattern: null,
    oxidizer_reaction_duration_seconds: null,
    oxidizer_fact_text_override: null
  };
}

test('buildSessionSnapshot includes LEL feather fields in trainee payload shape', () => {
  const snapshot = buildSessionSnapshot('session-1', makeScenario(), [makeShape()]);
  assert.equal(snapshot.shapes[0]?.lelHighSamplingMode, 'lower');
  assert.equal(snapshot.shapes[0]?.lelHighFeatherPercent, 50);
  assert.equal(snapshot.shapes[0]?.lelLowSamplingMode, 'lower');
  assert.equal(snapshot.shapes[0]?.lelLowFeatherPercent, 50);
  assert.equal(snapshot.shapes[0]?.oxidizerEnabled, true);
  assert.equal(snapshot.shapes[0]?.oxidizerTargetType, 'freeChlorine');
  assert.equal(snapshot.shapes[0]?.oxidizerReactionPattern, 'blueVioletRing');
});

test('refreshSessionSnapshotsForScenario rebuilds active and scheduled session snapshots with current shape settings', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const scenario = makeScenario();
  const shape = makeShape();

  const query = async <T>(sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('from scenarios s')) {
      return { rows: [scenario], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('from scenario_shapes ss')) {
      return { rows: [shape], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('from scenario_sessions ss')) {
      return { rows: [{ id: 'session-a' }, { id: 'session-b' }], rowCount: 2 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('update session_snapshots')) {
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  await refreshSessionSnapshotsForScenario({ query }, 'scenario-1');

  const updates = calls.filter((entry) => entry.sql.includes('update session_snapshots'));
  assert.equal(updates.length, 2);

  for (const update of updates) {
    const snapshot = JSON.parse(String(update.params?.[1])) as {
      shapes: Array<{
        lelHighSamplingMode: string | null;
        lelHighFeatherPercent: number | null;
        lelLowSamplingMode: string | null;
        lelLowFeatherPercent: number | null;
      }>;
    };
    assert.equal(snapshot.shapes[0]?.lelHighSamplingMode, 'lower');
    assert.equal(snapshot.shapes[0]?.lelHighFeatherPercent, 50);
    assert.equal(snapshot.shapes[0]?.lelLowSamplingMode, 'lower');
    assert.equal(snapshot.shapes[0]?.lelLowFeatherPercent, 50);
  }
});

test('refreshSessionSnapshotIfStale rebuilds an existing session snapshot when shapes changed after snapshot creation', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const scenario = makeScenario();
  const shape = makeShape();

  const query = async <T>(sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('group by ss.scenario_id')) {
      return {
        rows: [
          {
            scenario_id: scenario.id,
            scenario_version: scenario.version,
            snapshot_version: scenario.version,
            snapshot_created_at: '2026-04-20T17:49:59.296Z',
            scenario_updated_at: '2026-04-20T17:49:59.296Z',
            latest_shape_updated_at: '2026-04-22T12:00:00.000Z'
          }
        ],
        rowCount: 1
      } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('from scenarios s')) {
      return { rows: [scenario], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('from scenario_shapes ss')) {
      return { rows: [shape], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    if (sql.includes('update session_snapshots')) {
      return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  await refreshSessionSnapshotIfStale({ query }, 'session-a');

  const updates = calls.filter((entry) => entry.sql.includes('update session_snapshots'));
  assert.equal(updates.length, 1);
  const snapshot = JSON.parse(String(updates[0]?.params?.[1])) as {
    shapes: Array<{ lelHighSamplingMode: string | null; lelHighFeatherPercent: number | null }>;
  };
  assert.equal(snapshot.shapes[0]?.lelHighSamplingMode, 'lower');
  assert.equal(snapshot.shapes[0]?.lelHighFeatherPercent, 50);
});
