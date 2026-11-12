import fs from 'node:fs/promises';

export async function checkOperations({ origin, token, repository, githubToken, fetchImpl = fetch, now = Date.now() }) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Monitoring requires an exact HTTPS origin.');
  const alerts = [];
  async function json(endpoint, headers = {}) {
    const response = await fetchImpl(endpoint, { headers, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  const results = await Promise.allSettled([
    json(`${origin}/api/health`),
    json(`${origin}/api/operations/status`, { Authorization: `Bearer ${token}` }),
    json(`https://api.github.com/repos/${repository}/actions/workflows/backups.yml/runs?per_page=10`, {
      Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json'
    })
  ]);
  const [health, operations, backup] = results;
  if (health.status !== 'fulfilled' || health.value.mongoConnected !== true || health.value.status !== 'ok') alerts.push('Website/database readiness check failed.');
  if (operations.status !== 'fulfilled') alerts.push('Authenticated operational monitoring failed.');
  else for (const reason of operations.value.alerts || []) alerts.push(`Application alert: ${['checkout_failures', 'database_errors', 'server_errors', 'admin_authentication_failures', 'login_failures', 'access_denials'].includes(reason) ? reason : 'invalid_monitor_response'}`);
  if (backup.status !== 'fulfilled') alerts.push('Backup workflow history could not be checked.');
  else {
    const runs = backup.value.workflow_runs;
    if (!Array.isArray(runs)) alerts.push('Backup workflow history returned an invalid result.');
    else {
      const success = runs.filter((run) => run.conclusion === 'success').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!success || now - new Date(success.created_at).getTime() > 7 * 3600000) alerts.push('No successful private backup in the last seven hours.');
      const latest = [...runs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (latest?.status === 'completed' && latest.conclusion !== 'success') alerts.push('The latest private backup or restore drill failed.');
      const drill = runs.filter((run) => run.display_title === 'Backup and restore verification' && run.conclusion === 'success')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!drill || now - new Date(drill.created_at).getTime() > 30 * 3600000) alerts.push('No successful recovery drill in the last thirty hours.');
    }
  }
  return { checkedAt: new Date(now).toISOString(), status: alerts.length ? 'alert' : 'ok', alerts };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/monitor.mjs')) {
  try {
    const report = await checkOperations({ origin: process.env.PRODUCTION_ORIGIN || 'https://yaans.lk', token: process.env.MONITORING_TOKEN,
      repository: process.env.GITHUB_REPOSITORY, githubToken: process.env.GITHUB_TOKEN });
    await fs.writeFile('monitor-result.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (report.status !== 'ok') process.exitCode = 1;
  } catch { console.error('Operational monitoring could not complete. Check the private workflow configuration.'); process.exitCode = 1; }
}
