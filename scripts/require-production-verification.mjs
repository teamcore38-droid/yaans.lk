import { pathToFileURL } from 'node:url';
import { getJwtSecret } from '../backend/src/middleware/auth.js';

export const repository = 'teamcore38-droid/yaans.lk';
const workflowId = 414773514;

export function latestVerification(runs, sha) {
  return runs.filter((run) => run.workflow_id === workflowId && run.head_sha === sha &&
    run.head_repository?.full_name?.toLowerCase() === repository &&
    run.path === '.github/workflows/quality.yml' && ['push', 'pull_request', 'workflow_dispatch'].includes(run.event))
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
}

export async function waitForFullVerification(sha, {
  fetchImpl = fetch, pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now, timeoutMs = 10 * 60 * 1000, intervalMs = 30000
} = {}) {
  if (!/^[a-f\d]{40}$/i.test(sha || '')) throw new Error('Production requires an exact Git commit SHA.');
  const started = now();
  do {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/workflows/${workflowId}/runs?head_sha=${sha}&per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'yaans-production-verification' },
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Cannot verify the required GitHub suite (HTTP ${response.status}); production remains blocked.`);
    const body = await response.json();
    if (!Array.isArray(body.workflow_runs)) throw new Error('GitHub returned an invalid verification response.');
    const run = latestVerification(body.workflow_runs, sha);
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`Required full verification concluded ${run.conclusion}; production remains blocked.`);
      console.log(`[release gate] Full Node, React, MongoDB and browser verification passed for ${sha.slice(0, 12)}.`);
      return run;
    }
    if (now() - started >= timeoutMs) break;
    console.log('[release gate] Waiting for the required full GitHub verification suite.');
    await pause(intervalMs);
  } while (now() - started < timeoutMs);
  throw new Error('The required full suite did not finish within the deployment window; production remains blocked.');
}

export async function requireProductionVerification(environment = process.env, options) {
  if (environment.VERCEL_ENV !== 'production') return;
  if (`${environment.VERCEL_GIT_REPO_OWNER}/${environment.VERCEL_GIT_REPO_SLUG}`.toLowerCase() !== repository) {
    throw new Error('Production repository metadata is missing or does not match the approved repository.');
  }
  getJwtSecret();
  if (!/^mongodb(?:\+srv)?:\/\//.test(environment.MONGODB_URI || '')) throw new Error('Production database configuration is missing.');
  await waitForFullVerification(environment.VERCEL_GIT_COMMIT_SHA, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  requireProductionVerification().catch((error) => { console.error(`[release gate] ${error.message}`); process.exitCode = 1; });
}
