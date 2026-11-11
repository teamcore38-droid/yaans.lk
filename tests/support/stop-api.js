import fs from 'node:fs/promises';

export default async function stopApi() {
  const stateFile = new URL('../../test-results/api-state.json', import.meta.url);
  let state;
  try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (state.runId !== process.env.YAANS_TEST_RUN_ID || state.closed) return;
  const response = await fetch('http://127.0.0.1:5179/__test/shutdown', {
    method: 'POST', headers: { 'x-yaans-test-control': state.controlSecret },
    signal: AbortSignal.timeout(5000)
  });
  if (response.status !== 202) throw new Error('Isolated test API refused shutdown');
  await response.text();
  // Playwright force-kills processes on Windows. Wait for our explicit cleanup first.
  for (let attempt = 0; attempt < 100; attempt++) {
    const latest = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    if (latest.runId === state.runId && latest.closed) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Isolated test API did not finish cleanup');
}
