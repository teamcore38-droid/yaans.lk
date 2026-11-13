import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startIsolatedApp } from './helpers/isolated-app.js';

test('browser API bootstrap preserves the real 400-per-minute production IP limit', { timeout: 120000 }, async t => {
  const app = await startIsolatedApp();
  t.after(() => app.close());
  for (let request = 0; request < 400; request++) {
    const response = await fetch(`${app.url}/api/health`);
    assert.equal(response.status, 200, `Request ${request + 1} should be within the budget`);
    assert.equal(response.headers.get('ratelimit-limit'), '400');
    await response.text();
  }
  const blocked = await fetch(`${app.url}/api/health`);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('ratelimit-remaining'), '0');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  await blocked.text();
  // The same protection still applies to cart requests from that IP.
  const quote = await fetch(`${app.url}/api/orders/quote`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
  });
  assert.equal(quote.status, 429);
  await quote.text();
});
