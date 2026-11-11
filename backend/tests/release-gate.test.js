import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestVerification, waitForFullVerification } from '../../scripts/require-production-verification.mjs';

const sha = 'a'.repeat(40);
const run = { workflow_id: 414773514, head_sha: sha, head_repository: { full_name: 'teamcore38-droid/yaans.lk' },
  path: '.github/workflows/quality.yml', event: 'push', run_number: 1, run_attempt: 1, status: 'completed', conclusion: 'success' };
const response = (runs) => ({ ok: true, json: async () => ({ workflow_runs: runs }) });

test('production accepts only its exact revision and approved full workflow, never an unrelated green check', async () => {
  for (const changed of [{ head_sha: 'b'.repeat(40) }, { workflow_id: 1 }, { path: '.github/workflows/other.yml' },
    { head_repository: { full_name: 'untrusted/fork' } }, { event: 'pull_request_target' }]) {
    assert.equal(latestVerification([{ ...run, ...changed }], sha), undefined);
  }
  await assert.rejects(waitForFullVerification('main', { fetchImpl: () => { throw new Error('must not fetch'); } }), /exact Git commit/);
  assert.equal((await waitForFullVerification(sha, { fetchImpl: async () => response([run]) })).head_sha, sha);
});

test('a newer failed or cancelled verification cannot be bypassed with an older success', async () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped']) {
    await assert.rejects(waitForFullVerification(sha, { fetchImpl: async () => response([run, { ...run, run_number: 2, conclusion }]) }), /production remains blocked/);
  }
});

test('production waits for completion and fails closed for missing, unavailable or unfinished results', async () => {
  let calls = 0;
  const completed = await waitForFullVerification(sha, { fetchImpl: async () => response([{ ...run, status: ++calls === 1 ? 'in_progress' : 'completed' }]), pause: async () => {} });
  assert.equal(calls, 2); assert.equal(completed.conclusion, 'success');
  await assert.rejects(waitForFullVerification(sha, { fetchImpl: async () => ({ ok: false, status: 403 }) }), /production remains blocked/);
  await assert.rejects(waitForFullVerification(sha, { fetchImpl: async () => response([]), timeoutMs: 0 }), /production remains blocked/);
  await assert.rejects(waitForFullVerification(sha, { fetchImpl: async () => response([{ ...run, status: 'in_progress' }]), timeoutMs: 0 }), /production remains blocked/);
});
