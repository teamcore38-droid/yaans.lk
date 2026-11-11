import fs from 'node:fs/promises';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (repository !== 'teamcore38-droid/yaans-operations' || !token) throw new Error('Use the private operations repository and its workflow token.');
const kind = process.argv[2];
if (!['monitoring', 'backup', 'recovery'].includes(kind)) throw new Error('Unknown operational alert type.');
const failed = process.argv[3] !== 'success';
const title = `[Operations] ${{ backup: 'Private encrypted backup failed', recovery: 'Recovery drill failed', monitoring: 'Website or checkout monitoring needs attention' }[kind]}`;
const run = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
async function api(endpoint, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`GitHub operational alert API failed (HTTP ${response.status}).`);
  return response.json();
}
const details = await api('');
if (!details.private) throw new Error('Operational alerts must remain private.');
const issues = await api('/issues?state=open&per_page=100');
const existing = issues.find((issue) => issue.title === title && !issue.pull_request);
if (failed && !existing) {
  let explanation = 'Review the failed steps and recovery instructions in the workflow.';
  if (kind === 'monitoring') {
    try { const report = JSON.parse(await fs.readFile('monitor-result.json', 'utf8')); explanation = (report.alerts || []).join('\n'); } catch { /* Generic failure remains actionable. */ }
  }
  await api('/issues', 'POST', { title, body: `${explanation}\n\n[Open the private workflow run](${run}).\n\nThis alert stays open until the next successful check. Check GitHub notification delivery settings for email alerts.` });
} else if (!failed && existing) await api(`/issues/${existing.number}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
console.log(failed ? 'Private operational alert recorded (duplicates suppressed).' : 'Operational check healthy; any existing alert was resolved.');
