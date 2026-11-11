import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOperations } from '../../operations/monitor.mjs';

const now = new Date('2026-11-12T00:00:00Z').getTime();
const successfulBackup = { status: 'completed', conclusion: 'success', created_at: new Date(now - 3600000).toISOString(), display_title: 'Backup and restore verification' };
const configuration = { origin: 'https://yaans.lk', token: 'synthetic-monitoring-token', repository: 'teamcore38-droid/yaans-operations', githubToken: 'synthetic-github-token', now };
function responses({ health = { status: 'ok', mongoConnected: true }, operations = { alerts: [] }, runs = [successfulBackup], failure = false } = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (failure) throw new Error('Network unavailable');
    return { ok: true, json: async () => url.endsWith('/health') ? health : url.endsWith('/status') ? operations : { workflow_runs: runs } };
  };
}
test('operational monitor checks readiness, private application alerts, backup freshness and restoration', async () => {
  const result = await checkOperations({ ...configuration, fetchImpl: responses() });
  assert.equal(result.status, 'ok'); assert.deepEqual(result.alerts, []);
});
test('monitor raises failures for stale backups, missing recovery checks and checkout errors', async () => {
  const old = { ...successfulBackup, created_at: new Date(now - 40 * 3600000).toISOString() };
  const result = await checkOperations({ ...configuration, fetchImpl: responses({ operations: { alerts: ['checkout_failures'] }, runs: [old] }) });
  assert.equal(result.status, 'alert'); assert.equal(result.alerts.length, 3);
});
test('network or readiness failures are visible and unknown response details are never forwarded to alerts', async () => {
  assert.equal((await checkOperations({ ...configuration, fetchImpl: responses({ failure: true }) })).alerts.length, 3);
  const result = await checkOperations({ ...configuration, fetchImpl: responses({ health: { status: 'ok', mongoConnected: false }, operations: { alerts: ['private-customer-information'] } }) });
  assert.ok(result.alerts.some((alert) => alert.includes('readiness')));
  assert.ok(!JSON.stringify(result).includes('private-customer-information'));
});
test('monitor rejects insecure origins and URL paths before sending its authentication token', async () => {
  for (const origin of ['http://yaans.lk', 'https://yaans.lk/private']) await assert.rejects(checkOperations({ ...configuration, origin, fetchImpl: responses() }));
});
