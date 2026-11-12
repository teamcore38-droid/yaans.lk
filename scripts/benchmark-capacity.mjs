import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { startIsolatedApp } from '../backend/tests/helpers/isolated-app.js';
import { populateCapacityData } from '../tests/performance/fixtures.mjs';
import { shippingAddress } from '../tests/support/fixtures.js';

const supported = new Set(['users', 'seconds', 'think-ms', 'instances', 'products', 'sellers', 'reviews', 'orders', 'label', 'out']);
if (process.argv.slice(2).some((arg) => !/^--[a-z-]+=/.test(arg) || !supported.has(arg.slice(2, arg.indexOf('='))))) {
  throw new Error('Unknown capacity option. This runner supports disposable loopback targets only.');
}
const option = (name, fallback) => process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const number = (name, fallback, min, max) => { const value = Number(option(name, fallback)); if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}.`); return value; };
const percentile = (values, p) => values.length ? values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const sizes = option('users', '10,25,50,100,200,500').split(',').map(Number);
if (!sizes.length || sizes.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 500)) throw new Error('Use 1–500 active local users.');
const seconds = number('seconds', 18, 5, 120), thinkMs = number('think-ms', 3000, 100, 30000);
const instances = number('instances', 2, 1, 4);
if (!Number.isSafeInteger(instances)) throw new Error('instances must be an integer.');
const fixtureSizes = Object.fromEntries(['products', 'sellers', 'reviews', 'orders'].map((key) => [key, number(key, { products: 1000, sellers: 100, reviews: 10000, orders: 10000 }[key], key === 'sellers' || key === 'products' ? 1 : 0, { products: 5000, sellers: 500, reviews: 50000, orders: 50000 }[key])]));
const runId = randomUUID();
let app;
const workers = [];
const orderIds = new Set();
const checkoutAttempts = new Map();
let completedCheckouts = 0, retriesVerified = 0;
const report = { format: 1, startedAt: new Date().toISOString(), label: option('label', 'local'),
  environment: 'disposable loopback MongoDB and API processes', mongoVersion: '7.0.14',
  host: { node: process.version, platform: process.platform, logicalCpus: os.availableParallelism(), totalMemoryGb: os.totalmem() / 1073741824 },
  workload: { model: 'closed loop with deterministic browsing pauses and staggered arrivals', thinkMs, secondsPerWave: seconds, instances,
    mix: '40% catalog lists, 20% product detail, 20% home, 15% cart quotes, 5% guest checkout plus occasional exact-key retry',
    clientAddresses: 'Synthetic trusted-proxy identities on loopback only; no hosted headers or rate-limit bypass' }, waves: [] };

async function spawnWorker() {
  const child = fork(fileURLToPath(new URL('../tests/performance/api-worker.mjs', import.meta.url)), [], {
    env: { ...process.env }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  let diagnostic = '';
  child.stderr.on('data', (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-4096); });
  const pending = new Map(); let sequence = 0;
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local API worker did not start.')), 30000);
    child.on('message', (message) => {
      if (message.ready) { clearTimeout(timeout); resolve(message); }
      else if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    });
    child.once('error', reject); child.once('exit', (code) => { clearTimeout(timeout); if (code) reject(new Error(`Local worker failed (${code}): ${diagnostic}`)); });
  });
  return { child, url: ready.url, send: (action) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Local worker did not answer.')); }, 10000);
    pending.set(id, (message) => { clearTimeout(timeout); resolve(message); }); child.send({ id, action });
  }) };
}

try {
  // This helper always starts a fresh loopback replica set and ignores all inherited database credentials.
  app = await startIsolatedApp();
  report.fixtures = await populateCapacityData(app.mongo, fixtureSizes);
  for (let i = 0; i < instances; i++) workers.push(await spawnWorker());
  for (const worker of workers) assert.equal(new URL(worker.url).hostname, '127.0.0.1');
  const initial = await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' });
  const stages = [
    { route: '/marketplace/products?page=2&limit=12', kind: 'catalog' },
    { route: '/marketplace/products/prd_test_spice', kind: 'detail' },
    { route: '/marketplace/home', kind: 'home' },
    { route: '/marketplace/products?q=spice&sort=price_asc&limit=12', kind: 'search' },
    { route: '/orders/quote', kind: 'quote', body: { items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }], destinationDistrict: 'Colombo' } }
  ];
  // Ordinary warm-up is separate from measured waves.
  for (const worker of workers) for (const item of stages) {
    const response = await fetch(worker.url + '/api' + item.route, { method: item.body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.18.254.254' }, ...(item.body ? { body: JSON.stringify(item.body) } : {}) });
    assert.equal(response.status, 200); await response.arrayBuffer();
  }
  for (const users of sizes) {
    await Promise.all(workers.map((worker) => worker.send('sample')));
    const databaseBefore = await app.mongo.admin().command({ serverStatus: 1 });
    const networkBefore = databaseBefore.network;
    const connectionSamples = [databaseBefore.connections.current];
    let sampling;
    const timer = setInterval(() => {
      if (sampling) return;
      sampling = app.mongo.admin().command({ serverStatus: 1 }).then((sample) => connectionSamples.push(sample.connections.current)).catch(() => {}).finally(() => { sampling = undefined; });
    }, 2000);
    const started = performance.now(), latencies = [], byKind = {}, statuses = {};
    let bytes = 0, requests = 0, unexpected = 0, aborted = false, inFlight = 0, peakInFlight = 0;
    async function request(user, item, key, expectedOrderId) {
      const mark = performance.now(); let status = 'network_error';
      inFlight++; peakInFlight = Math.max(peakInFlight, inFlight);
      try {
        const response = await fetch(workers[(user + requests) % workers.length].url + '/api' + item.route, {
          method: item.body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.${Math.floor(user / 250)}.${user % 250 + 1}`,
            ...(key ? { 'Idempotency-Key': key } : {}) }, ...(item.body ? { body: JSON.stringify(item.body) } : {}) });
        status = String(response.status); const body = await response.text(); bytes += Buffer.byteLength(body);
        if (response.status >= 200 && response.status < 300) {
          const data = JSON.parse(body);
          if (item.kind === 'checkout') {
            assert.ok(data.order?._id);
            if (expectedOrderId) { assert.equal(data.order._id, expectedOrderId); retriesVerified++; }
            else { assert.ok(!orderIds.has(data.order._id)); orderIds.add(data.order._id); completedCheckouts++; checkoutAttempts.get(key).orderId = data.order._id; }
            return data.order._id;
          }
          if (item.kind === 'catalog' || item.kind === 'search') assert.ok(Array.isArray(data.products) && data.products.length <= 12);
          if (item.kind === 'detail') assert.equal(data.product?._id, 'prd_test_spice');
        } else if (response.status !== 429) unexpected++;
      } catch { unexpected++; }
      finally {
        const elapsed = performance.now() - mark;
        latencies.push(elapsed); (byKind[item.kind] ||= []).push(elapsed);
        statuses[status] = (statuses[status] || 0) + 1; requests++;
        inFlight--;
        if (unexpected >= 5 || elapsed > 10000) aborted = true;
      }
    }
    await Promise.all(Array.from({ length: users }, async (_, user) => {
      // Spread arrivals across one think interval; this wave models active sessions, not an instantaneous flood.
      await pause(user / users * Math.min(thinkMs, 2000));
      let sequence = 0;
      while (!aborted && performance.now() - started < seconds * 1000) {
        const slot = (user + sequence++) % 20;
        if (slot === 19) {
          const key = randomUUID();
          const item = { route: '/orders/checkout', kind: 'checkout', body: {
            items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }], shippingAddress,
            customerEmail: `load-${runId}-${user}@test.yaans.invalid`, paymentMethod: 'COD', codConfirmedByCustomer: true } };
          checkoutAttempts.set(key, { user, body: item.body });
          const id = await request(user, item, key);
          if (id && user % 10 === 9) await request(user, item, key, id);
        } else await request(user, stages[slot % stages.length]);
        await pause(thinkMs);
      }
    }));
    clearInterval(timer); await sampling;
    const wallMs = performance.now() - started;
    const samples = await Promise.all(workers.map(async (worker) => (await worker.send('sample')).sample));
    const networkAfter = (await app.mongo.admin().command({ serverStatus: 1 })).network;
    const wave = { activeUsers: users, requests, wallSeconds: wallMs / 1000, achievedRps: requests / (wallMs / 1000),
      latencyMs: { p50: percentile(latencies, .5), p95: percentile(latencies, .95), p99: percentile(latencies, .99), max: Math.max(0, ...latencies) },
      routes: Object.fromEntries(Object.entries(byKind).map(([kind, values]) => [kind, { requests: values.length,
        p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), p99Ms: percentile(values, .99), maxMs: Math.max(...values) }])),
      statuses, unexpectedErrors: unexpected, responseBytes: bytes,
      mongoNetworkBytesOut: networkAfter.bytesOut - networkBefore.bytesOut,
      peakDatabaseConnections: Math.max(...connectionSamples), peakInFlightRequests: peakInFlight, idealRpsBeforeResponseTime: users / (thinkMs / 1000),
      workers: samples, aborted,
      meetsLocalTargets: unexpected === 0 && !statuses['429'] && percentile(byKind.catalog || [], .95) < 1000 && (!byKind.checkout || percentile(byKind.checkout, .95) < 2000) };
    report.waves.push(wave);
    console.log(JSON.stringify({ wave: users, requests, achievedRps: wave.achievedRps, p95Ms: wave.latencyMs.p95, statuses, unexpectedErrors: unexpected, aborted }));
    if (aborted) break;
  }
  // A timeout is an ambiguous response, not proof that a transaction failed.
  // Replay only the exact original keys/bodies at low load before checking stock.
  let recoveredAfterLoad = 0;
  for (const [key, attempt] of checkoutAttempts) {
    if (attempt.orderId) continue;
    const response = await fetch(workers[attempt.user % workers.length].url + '/api/orders/checkout', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key,
        'X-Forwarded-For': `198.18.${Math.floor(attempt.user / 250)}.${attempt.user % 250 + 1}` }, body: JSON.stringify(attempt.body) });
    assert.ok(response.status === 200 || response.status === 201, 'Ambiguous checkout recovery failed.');
    const data = await response.json(); assert.ok(data.order?._id);
    assert.ok(!orderIds.has(data.order._id)); orderIds.add(data.order._id);
    attempt.orderId = data.order._id; completedCheckouts++; recoveredAfterLoad++;
  }
  const saved = await app.mongo.collection('orders').find({ _id: { $in: [...orderIds] } }).toArray();
  const packages = await app.mongo.collection('suborders').countDocuments({ parentOrderId: { $in: [...orderIds] } });
  const final = await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' });
  assert.equal(saved.length, completedCheckouts); assert.equal(packages, completedCheckouts);
  assert.equal(initial.stock - final.stock, completedCheckouts);
  assert.equal(initial.variants[0].values[0].stock - final.variants[0].values[0].stock, completedCheckouts);
  assert.ok(final.stock >= 0);
  report.orderInvariants = { verified: true, completedCheckouts, recoveredAfterLoad, durableOrders: saved.length, durablePackages: packages, stockReserved: initial.stock - final.stock, exactKeyRetriesVerified: retriesVerified };
  report.outcome = report.waves.some((wave) => !wave.meetsLocalTargets || wave.aborted) ? 'local_capacity_target_not_met' : 'local_capacity_targets_met';
  if (report.outcome !== 'local_capacity_targets_met') process.exitCode = 2;
  report.completedAt = new Date().toISOString();
  console.log(JSON.stringify({ orderInvariants: report.orderInvariants }));
} catch (error) {
  report.failure = { name: error.name, message: error.message };
  report.outcome = 'harness_or_consistency_failure';
  process.exitCode = 1;
  console.error('The isolated capacity run failed; diagnostic results are retained.');
} finally {
  report.completedAt ||= new Date().toISOString();
  const output = path.resolve(option('out', `reports/capacity-${report.label}.json`));
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: output }));
  for (const worker of workers) { try { await worker.send('close'); } catch {} finally { worker.child.kill(); } }
  await app?.close();
}
