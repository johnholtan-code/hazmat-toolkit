import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShapeBody, type ShapeBody } from './scenarios.js';

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
