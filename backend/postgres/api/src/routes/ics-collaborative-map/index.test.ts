import test from 'node:test';
import assert from 'node:assert/strict';
import { getViewerAccessJoinCodeUpdate } from './index.js';

test('disabling viewer access rotates the viewer join code', async () => {
  const pool = {
    async query() {
      return {
        rowCount: 0,
        rows: []
      };
    }
  };

  const nextJoinCode = await getViewerAccessJoinCodeUpdate(pool, false);

  assert.match(nextJoinCode || '', /^[A-Z0-9]{6}$/);
});

test('enabling viewer access keeps the existing viewer join code', async () => {
  const pool = {
    async query() {
      throw new Error('query should not be called when enabling viewer access');
    }
  };

  const nextJoinCode = await getViewerAccessJoinCodeUpdate(pool, true);

  assert.equal(nextJoinCode, null);
});
