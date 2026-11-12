import { startIsolatedApp } from '../../backend/tests/helpers/isolated-app.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

const testApp = await startIsolatedApp(5179);
const controlSecret = randomUUID();
const stateFile = new URL('../../test-results/api-state.json', import.meta.url);
const state = { runId: process.env.YAANS_TEST_RUN_ID, controlSecret, closed: false };
await fs.mkdir(new URL('../../test-results/', import.meta.url), { recursive: true });
await fs.writeFile(stateFile, JSON.stringify(state));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  try {
    await testApp.close();
    await fs.writeFile(stateFile, JSON.stringify({ ...state, closed: true }));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
// Registered only in the test bootstrap, never in the production API.
testApp.app.get('/__test/mailbox', (req,res)=>{
  if(req.get('x-yaans-test-control')!==controlSecret)return res.sendStatus(403);
  res.json({messages:testApp.mailbox});
});
testApp.app.post('/__test/shutdown', (req, res) => {
  if (req.get('x-yaans-test-control') !== controlSecret) return res.sendStatus(403);
  res.sendStatus(202);
  void close();
});
console.log(`Isolated test API ready at ${testApp.url}`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, close);
}
