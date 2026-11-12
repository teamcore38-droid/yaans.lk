import assert from 'node:assert/strict';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createRequire } from 'node:module';

// Match the backend's installed Mongoose instance, not the root dev-tool copy.
const mongoose = createRequire(new URL('../../backend/package.json', import.meta.url))('mongoose');

assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.MONGODB_DB_NAME, 'yaans_automated_test');
assert.match(process.env.MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1:/);
// Command monitoring is confined to this disposable test process.
const connect = mongoose.connect.bind(mongoose);
mongoose.connect = (uri, options) => connect(uri, { ...options, monitorCommands: true });
const { default: app } = await import('../../backend/src/server.js');
const { connectDatabase } = await import('../../backend/src/config/db.js');
await connectDatabase();
const commands = {};
let returnedDocuments = 0;
mongoose.connection.getClient().on('commandStarted', ({ commandName }) => { commands[commandName] = (commands[commandName] || 0) + 1; });
mongoose.connection.getClient().on('commandSucceeded', ({ reply }) => { returnedDocuments += reply?.cursor?.firstBatch?.length || reply?.cursor?.nextBatch?.length || 0; });
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
let cpu = process.cpuUsage();
const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
process.on('message', async ({ id, action }) => {
  if (action === 'sample') {
    const used = process.cpuUsage(cpu); cpu = process.cpuUsage();
    process.send({ id, sample: { pid: process.pid, cpuMs: (used.user + used.system) / 1000,
      rssMb: process.memoryUsage().rss / 1048576, heapMb: process.memoryUsage().heapUsed / 1048576,
      eventLoopP99Ms: loop.percentile(99) / 1e6, commands: { ...commands }, returnedDocuments } });
    for (const name of Object.keys(commands)) delete commands[name];
    returnedDocuments = 0; loop.reset();
  } else if (action === 'close') {
    server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
    loop.disable(); await mongoose.disconnect();
    process.send({ id, ok: true }); process.disconnect();
  }
});
process.send({ ready: true, url: `http://127.0.0.1:${server.address().port}` });
