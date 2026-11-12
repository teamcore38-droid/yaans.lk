import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { startIsolatedApp } from '../backend/tests/helpers/isolated-app.js';
import { populateCapacityData } from '../tests/performance/fixtures.mjs';
import { accounts, TEST_PASSWORD } from '../tests/support/fixtures.js';

let app;
try {
  app = await startIsolatedApp();
  const fixtures = await populateCapacityData(app.mongo);
  const login = await fetch(app.url + '/api/auth/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts.admin, password: TEST_PASSWORD }) });
  if (!login.ok) throw new Error('Synthetic administrator login failed.');
  const { token } = await login.json();
  const measurements = [];
  for (const route of ['/api/marketplace/products?limit=12', '/api/marketplace/products/prd_test_spice', '/api/marketplace/home', '/api/seller/dashboard?sellerId=sel_load_1', '/api/admin/overview']) {
    const started = performance.now();
    const response = await fetch(app.url + route, { headers: route.includes('/admin/') || route.includes('/seller/') ? { Authorization: `Bearer ${token}` } : {} });
    const text = await response.text(), data = JSON.parse(text);
    measurements.push({ route, httpStatus: response.status, elapsedMs: performance.now() - started,
      decodedResponseBytes: Buffer.byteLength(text), exceedsBufferedVercelResponseLimit: Buffer.byteLength(text) > 4.5 * 1024 * 1024,
      rows: Object.fromEntries(['products', 'reviews', 'orders', 'subOrders', 'settlements', 'users'].filter((key) => Array.isArray(data[key])).map((key) => [key, data[key].length])) });
  }
  const ids = (await app.mongo.collection('sellers').find({ status: 'approved' }).toArray()).map(({ _id }) => String(_id));
  const plan = await app.mongo.collection('products').find({ approvalStatus: 'approved', sellerId: { $in: ids } }).sort({ soldCount: -1, _id: 1 }).limit(12).explain('executionStats');
  const report = { at: new Date().toISOString(), environment: 'disposable loopback MongoDB only', fixtures, measurements,
    popularCatalogPlan: { returned: plan.executionStats.nReturned, documentsExamined: plan.executionStats.totalDocsExamined, keysExamined: plan.executionStats.totalKeysExamined, winningPlan: plan.queryPlanner.winningPlan } };
  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/capacity-query-inspection.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ measurements, popularCatalogPlan: { returned: report.popularCatalogPlan.returned, documentsExamined: report.popularCatalogPlan.documentsExamined, keysExamined: report.popularCatalogPlan.keysExamined } }));
} finally { await app?.close(); }
