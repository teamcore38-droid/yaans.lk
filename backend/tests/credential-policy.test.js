import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getJwtSecret } from '../src/middleware/auth.js';
import { getInitialSeedState } from '../src/seed/initialState.js';

test('normal marketplace defaults never create a privileged account', () => {
  assert.deepEqual(getInitialSeedState().users, []);
});

test('authentication refuses missing, short and former fallback signing keys', () => {
  const previous = process.env.JWT_SECRET;
  try {
    for (const secret of ['', 'too-short', 'yaans_lk_sri_lanka_marketplace_jwt_secret_2026']) {
      process.env.JWT_SECRET = secret;
      assert.throws(getJwtSecret, (error) => error.status === 503);
    }
    process.env.JWT_SECRET = 'isolated-unit-test-key-with-at-least-32-characters';
    assert.equal(getJwtSecret(), process.env.JWT_SECRET);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
