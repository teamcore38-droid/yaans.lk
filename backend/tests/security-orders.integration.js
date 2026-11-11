import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';

const runFile = promisify(execFile);
const payload = (quantity = 1) => ({ items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity }],
  customerEmail: 'guest@test.invalid', shippingAddress, paymentMethod: 'COD', codConfirmedByCustomer: true });

test('security, durable orders and recovery with real MongoDB transactions', { timeout: 600000 }, async (t) => {
  const app = await startIsolatedApp();
  const child = fork(fileURLToPath(new URL('./helpers/api-worker.js', import.meta.url)), [], {
    env: { ...process.env, MONGODB_URI: app.mongoUri, VERCEL: '1', NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  const waiting = new Map();
  let sequence = 0;
  const ready = await new Promise((resolve, reject) => {
    child.on('message', (message) => {
      if (message.ready) resolve(message);
      else if (waiting.has(message.id)) {
        const pending = waiting.get(message.id); waiting.delete(message.id);
        message.error ? pending.reject(new Error(message.error)) : pending.resolve(message);
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => { if (code) reject(new Error(`Isolated API worker exited: ${code}`)); });
  });
  const send = (action) => new Promise((resolve, reject) => {
    const id = ++sequence; waiting.set(id, { resolve, reject }); child.send({ id, action });
  });
  t.after(async () => {
    try { if (child.connected) await send('close'); } finally { child.kill(); await app.close(); }
  });
  t.beforeEach(() => app.reset());
  const request = async (route, { body, token, key, access, method = body ? 'POST' : 'GET', url = app.url } = {}) => {
    const response = await fetch(`${url}/api${route}`, { method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}), ...(access ? { 'X-Order-Access-Token': access } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  const login = async (email, admin = false, password = TEST_PASSWORD) => {
    const result = await request(admin ? '/auth/admin/login' : '/auth/login', { body: { email, password } });
    assert.equal(result.status, 200); return result.data.token;
  };
  const place = async (options = {}) => {
    const result = await request('/orders/checkout', { body: payload(), key: randomUUID(), ...options });
    assert.equal(result.status, 201, JSON.stringify(result.data)); return result.data;
  };

  await t.test('the release read-only window allows browsing/quotes but rejects mutations without saving an order', async () => {
    const previous = process.env.MAINTENANCE_READ_ONLY;
    process.env.MAINTENANCE_READ_ONLY = 'true';
    try {
      assert.equal((await request('/marketplace/categories')).status, 200);
      assert.equal((await request('/orders/quote', { body: { items: payload().items, destinationDistrict: 'Colombo' } })).status, 200);
      assert.equal((await request('/orders/checkout', { key: randomUUID(), body: payload() })).status, 503);
      assert.equal((await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD } })).status, 503);
      assert.equal((await request('/health')).data.writesEnabled, false);
      assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
    } finally {
      if (previous === undefined) delete process.env.MAINTENANCE_READ_ONLY;
      else process.env.MAINTENANCE_READ_ONLY = previous;
    }
    assert.equal((await request('/health')).data.writesEnabled, true);
  });

  await t.test('deleting an administrator revokes their session and cannot resurrect seed credentials', async () => {
    const token = await login(accounts.admin, true);
    await app.mongo.collection('users').deleteOne({ _id: 'usr_test_admin' });
    assert.equal((await request('/admin/overview', { token })).status, 401);
    assert.equal((await request('/auth/admin/login', { body: { email: 'admin@yaans.lk', password: 'Admin@123' } })).status, 401);
    assert.equal(await app.mongo.collection('users').countDocuments({ role: 'admin' }), 0);
  });

  await t.test('an explicitly stored administrator with the former demo password cannot sign in', async () => {
    await app.mongo.collection('users').updateOne({ _id: 'usr_test_admin' }, { $set: { passwordHash: await bcrypt.hash('Admin@123', 4) } });
    assert.equal((await request('/auth/admin/login', { body: { email: accounts.admin, password: 'Admin@123' } })).status, 403);
  });

  await t.test('password changes revoke previous sessions', async () => {
    const token = await login(accounts.customer);
    const result = await request('/auth/update-credentials', { method: 'PUT', token,
      body: { currentPassword: TEST_PASSWORD, newPassword: 'NewTestingPassword@123' } });
    assert.equal(result.status, 200);
    assert.equal((await request('/auth/me', { token })).status, 401);
    assert.equal((await request('/auth/me', { token: result.data.token })).status, 200);
  });

  await t.test('missing/short/default JWT secrets fail authentication without accepting a fallback', async () => {
    const previous = process.env.JWT_SECRET;
    try {
      for (const secret of ['', 'short', 'yaans_lk_sri_lanka_marketplace_jwt_secret_2026']) {
        process.env.JWT_SECRET = secret;
        assert.equal((await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD } })).status, 503);
      }
    } finally { process.env.JWT_SECRET = previous; }
  });

  await t.test('guest tracking requires its private code and does not expose stored access hashes or seller margins', async () => {
    const placed = await place();
    const route = `/orders/track?orderNumber=${placed.order.orderNumber}`;
    for (const options of [{}, { access: 'a'.repeat(43) }]) {
      const denied = await request(route, options);
      assert.equal(denied.status, 403); assert.equal(denied.data.order, undefined);
    }
    assert.equal((await request(`${route}&phone=${shippingAddress.phone}`)).status, 403);
    const allowed = await request(route, { access: placed.guestAccessToken });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.data.order.shippingAddress.recipientName, shippingAddress.recipientName);
    assert.equal(allowed.data.order.guestAccessTokenHash, undefined);
    assert.equal(allowed.data.subOrders[0].netSellerEarningsLkr, undefined);
    assert.equal(allowed.data.subOrders[0].commissionAmountLkr, undefined);
    assert.equal(placed.order.guestAccessTokenHash, undefined);
  });

  await t.test('guest codes cannot authorize another order and expire', async () => {
    const first = await place(); const second = await place();
    assert.equal((await request(`/orders/track?orderNumber=${second.order.orderNumber}`, { access: first.guestAccessToken })).status, 403);
    await app.mongo.collection('orders').updateOne({ _id: first.order._id }, { $set: { guestAccessExpiresAt: new Date(0).toISOString() } });
    assert.equal((await request(`/orders/track?orderNumber=${first.order.orderNumber}`, { access: first.guestAccessToken })).status, 403);
  });

  await t.test('only the owning signed-in customer can view or change their registered order', async () => {
    const owner = await login(accounts.customer), other = await login(accounts.seller);
    const placed = await place({ token: owner });
    assert.equal(placed.guestAccessToken, undefined);
    const route = `/orders/track?orderNumber=${placed.order.orderNumber}`;
    assert.equal((await request(route, { token: owner })).status, 200);
    assert.equal((await request(route, { token: other })).status, 403);
    const action = `/orders/suborders/${placed.subOrders[0]._id}/customer-action`;
    assert.equal((await request(action, { token: other, body: { action: 'cancel' } })).status, 403);
    assert.equal((await request('/orders/my-orders', { token: other })).data.orders.length, 0);
  });

  await t.test('unauthorized cancellation cannot alter stock and an authorized repeated cancellation restores it once', async () => {
    const placed = await place(); const sub = placed.subOrders[0];
    const route = `/orders/suborders/${sub.subOrderNumber}/customer-action`;
    assert.equal((await request(route, { body: { action: 'cancel' } })).status, 403);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 99);
    for (let i = 0; i < 2; i++) assert.equal((await request(route, { access: placed.guestAccessToken, body: { action: 'cancel' } })).status, 200);
    const product = await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' });
    assert.equal(product.stock, 100); assert.equal(product.variants[0].values[0].stock, 50);
    assert.equal((await app.mongo.collection('orders').findOne({ _id: placed.order._id })).overallStatus, 'cancelled');
  });

  await t.test('invalid quantities, unavailable variants/products and unapproved direct URLs are rejected', async () => {
    for (const quantity of [0, -1, 1.5, '2', '2abc', null, 100]) {
      assert.equal((await request('/orders/checkout', { key: randomUUID(), body: payload(quantity) })).status, 400);
    }
    for (const item of [
      { productId: 'prd_test_pending', quantity: 1 },
      { productId: 'missing', quantity: 1 },
      { productId: 'prd_test_spice', variantLabel: 'Standard', quantity: 1 },
      { productId: 'prd_test_spice', variantLabel: 'not-a-pack', quantity: 1 }
    ]) assert.equal((await request('/orders/checkout', { key: randomUUID(), body: { ...payload(), items: [item] } })).status, 409);
    assert.equal((await request('/marketplace/products/prd_test_pending')).status, 404);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
  });

  await t.test('unsupported payment, missing COD agreement and missing retry keys cannot create an order', async () => {
    assert.equal((await request('/orders/checkout', { body: payload() })).status, 400);
    for (const override of [{ paymentMethod: 'ONLINE_CARD_FUTURE' }, { codConfirmedByCustomer: false }, { codConfirmedByCustomer: undefined }]) {
      assert.equal((await request('/orders/checkout', { key: randomUUID(), body: { ...payload(), ...override } })).status, 400);
    }
    assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
  });

  await t.test('aggregate product and variant stock prevent overselling, including duplicated cart lines', async () => {
    await app.mongo.collection('products').updateOne({ _id: 'prd_test_spice' }, { $set: { stock: 1 } });
    for (const items of [payload(3).items, [...payload().items, ...payload().items],
      [...payload().items, { productId: 'prd_test_spice', variantLabel: '250 g', quantity: 1 }]]) {
      assert.equal((await request('/orders/checkout', { key: randomUUID(), body: { ...payload(), items } })).status, 409);
    }
    await app.mongo.collection('products').updateOne({ _id: 'prd_test_spice' }, { $set: { stock: 100, 'variants.0.values.0.stock': 0 } });
    assert.equal((await request('/orders/checkout', { key: randomUUID(), body: payload() })).status, 409);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
  });

  await t.test('simultaneous buyers in two actual API processes cannot sell the final item twice', async () => {
    assert.notEqual(ready.pid, process.pid);
    await app.mongo.collection('products').updateOne({ _id: 'prd_test_spice' }, { $set: { stock: 1, 'variants.0.values.0.stock': 1 } });
    const results = await Promise.all([app.url, ready.url].map((url) => request('/orders/checkout', { url, key: randomUUID(), body: payload() })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 1);
    const product = await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' });
    assert.equal(product.stock, 0); assert.equal(product.variants[0].values[0].stock, 0);
  });

  await t.test('concurrent identical checkout keys across API processes return one durable order', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => request('/orders/checkout', { url: index % 2 ? ready.url : app.url, key, body: payload() })));
    assert.ok(results.every((result) => [200, 201].includes(result.status)), JSON.stringify(results.map((r) => ({ status: r.status, error: r.data.message }))));
    assert.equal(new Set(results.map((r) => r.data.order._id)).size, 1);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 1);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 99);
    const replay = await request('/orders/checkout', { url: ready.url, key, body: payload() });
    assert.equal(replay.status, 200); assert.equal(replay.data.order._id, results[0].data.order._id);
    assert.equal(replay.data.guestAccessToken, results[0].data.guestAccessToken);
  });

  await t.test('a retry key is bound to the payload and can recover the original completed checkout', async () => {
    const key = randomUUID(); const placed = await place({ key });
    const changed = await request('/orders/checkout', { key, body: payload(2) });
    assert.equal(changed.status, 409); assert.equal(changed.data.code, 'IDEMPOTENCY_CONFLICT');
    const recovered = await request('/orders/checkout-result', { method: 'POST', key });
    assert.equal(recovered.status, 200); assert.equal(recovered.data.order._id, placed.order._id);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 1);
  });

  await t.test('signing in during a pending guest checkout cannot create a second order, and another account cannot replay a registered checkout', async () => {
    const owner = await login(accounts.customer), other = await login(accounts.seller);
    const guestKey = randomUUID(), registeredKey = randomUUID();
    const guest = await place({ key: guestKey });
    const resumed = await request('/orders/checkout', { key: guestKey, token: owner, body: payload() });
    assert.equal(resumed.status, 200); assert.equal(resumed.data.order._id, guest.order._id);
    await place({ key: registeredKey, token: owner });
    assert.equal((await request('/orders/checkout', { key: registeredKey, token: other, body: payload() })).status, 403);
    assert.equal((await request('/orders/checkout-result', { key: registeredKey, token: other, method: 'POST' })).status, 403);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 2);
  });

  await t.test('fulfillment cannot skip dispatch rules or reopen a cancelled package and release its inventory twice', async () => {
    const seller = await login(accounts.seller), placed = await place();
    const route = `/seller/suborders/${placed.subOrders[0]._id}/status`;
    assert.equal((await request(route, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'delivered' } })).status, 409);
    assert.equal((await request(route, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'not-a-status' } })).status, 400);
    assert.equal((await request(route, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'cancelled' } })).status, 200);
    assert.equal((await request(route, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'confirmed' } })).status, 409);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 100);
  });

  await t.test('legacy BSON ObjectId accounts can sign in and update a profile without converting their identifier', async () => {
    const id = new app.db.MODEL_MAP.users.db.base.Types.ObjectId();
    const example = await app.mongo.collection('users').findOne({ _id: 'usr_test_customer' });
    await app.mongo.collection('users').insertOne({ ...example, _id: id, email: 'legacy@test.invalid' });
    const token = await login('legacy@test.invalid');
    const changed = await request('/auth/profile', { method: 'PUT', token, body: { name: 'Updated legacy account' } });
    assert.equal(changed.status, 200); assert.equal(changed.data.user._id, String(id));
    assert.equal((await app.mongo.collection('users').findOne({ _id: id })).name, 'Updated legacy account');
    assert.equal(await app.mongo.collection('users').countDocuments({ _id: String(id) }), 0);
  });

  await t.test('a stale unrelated edit from another process preserves newly committed orders and inventory', async () => {
    await send('snapshot');
    const placed = await place();
    await send('edit-unrelated');
    assert.ok(await app.mongo.collection('orders').findOne({ _id: placed.order._id }));
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 99);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_lamp' })).priceLkr, 3000);
  });

  await t.test('a stale edit of the same product is rejected rather than reverting committed stock', async () => {
    const stale = await app.db.getStore({ products: { _id: 'prd_test_spice' } });
    await place(); stale.products[0].priceLkr = 1200;
    await assert.rejects(app.db.persistStore(stale), (error) => error.status === 409);
    const stored = await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' });
    assert.equal(stored.stock, 99); assert.equal(stored.priceLkr, 1000);
  });

  await t.test('failed package writes roll back orders, stock, counters and retry records; a retry can succeed', async () => {
    const collection = app.db.MODEL_MAP.subOrders.collection;
    const original = collection.insertOne;
    const key = randomUUID();
    collection.insertOne = async () => { throw new Error('Synthetic package write failure'); };
    try { assert.equal((await request('/orders/checkout', { key, body: payload() })).status, 500); }
    finally { collection.insertOne = original; }
    assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
    assert.equal(await app.mongo.collection('suborders').countDocuments(), 0);
    assert.equal(await app.mongo.collection('checkoutrequests').countDocuments(), 0);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 100);
    assert.equal((await request('/orders/checkout', { key, body: payload() })).status, 201);
    assert.equal((await request('/orders/checkout', { key, body: payload() })).status, 200);
  });

  await t.test('a response cannot claim success while its database write is still pending', async () => {
    const collection = app.db.MODEL_MAP.products.collection, original = collection.updateOne;
    let entered, release; const started = new Promise((resolve) => { entered = resolve; });
    const blocked = new Promise((resolve) => { release = resolve; });
    collection.updateOne = async function (...args) { entered(); await blocked; return original.apply(this, args); };
    let settled = false;
    const pending = request('/orders/checkout', { key: randomUUID(), body: payload() }).then((result) => { settled = true; return result; });
    try { await started; assert.equal(settled, false); }
    finally { release(); collection.updateOne = original; }
    assert.equal((await pending).status, 201);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 1);
  });

  await t.test('order sequencing starts beyond legacy records and remains unique under concurrent checkout', async () => {
    const year = new Date().getUTCFullYear();
    await app.mongo.collection('orders').insertOne({ _id: 'ord_legacy', orderNumber: `YLK-${year}-5000` });
    const results = await Promise.all(Array.from({ length: 8 }, () => request('/orders/checkout', { key: randomUUID(), body: payload() })));
    assert.ok(results.every((result) => result.status === 201), JSON.stringify(results.map((r) => r.status)));
    const numbers = results.map((result) => Number(result.data.order.orderNumber.split('-').at(-1)));
    assert.equal(new Set(numbers).size, 8); assert.equal(Math.min(...numbers), 5001);
  });

  await t.test('administrator recovery uses secure input, revokes old sessions and does not print a password', async () => {
    const token = await login(accounts.admin, true), password = 'A-unique-recovery-password-123!';
    const script = fileURLToPath(new URL('../scripts/provision-admin.js', import.meta.url));
    const recover = (email) => new Promise((resolve, reject) => {
      const child = execFile(process.execPath, [script, `--email=${email}`, '--reset-existing', '--password-stdin'], {
        env: { ...process.env, MONGODB_URI: app.mongoUri }, encoding: 'utf8'
      });
      child.stdin.end(password);
      let output = ''; child.stdout.on('data', (data) => { output += data; }); child.stderr.on('data', (data) => { output += data; });
      child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output)));
    });
    await assert.rejects(recover('missing-admin@test.invalid'), /not found/);
    assert.equal(await app.mongo.collection('users').countDocuments({ role: 'admin' }), 1);
    const result = await recover(accounts.admin);
    assert.ok(!result.includes(password));
    assert.equal((await request('/admin/overview', { token })).status, 401);
    const replacement = await login(accounts.admin, true, password);
    assert.equal((await request('/admin/overview', { token: replacement })).status, 200);
  });

  const deliver = async (placed, sellerToken) => {
    const sub = placed.subOrders[0];
    for (const fulfillmentStatus of ['packed', 'shipped', 'delivered']) {
      const result = await request(`/seller/suborders/${sub._id}/status`, { token: sellerToken, method: 'PUT', body: { fulfillmentStatus } });
      assert.equal(result.status, 200, JSON.stringify(result.data));
    }
    return sub;
  };
  const cash = (sub, kind, token, reference, amountLkr = sub.grossTotalLkr) => request(`/admin/suborders/${sub._id}/cash/${kind}`, {
    token, body: { bankReference: reference, amountLkr }
  });
  const payout = (sub, token, reference, url = app.url) => request('/admin/settlements/payout', {
    token, url, body: { sellerId: sub.sellerId, subOrderIds: [sub._id], amountLkr: sub.netSellerEarningsLkr || 950, bankReference: reference }
  });

  await t.test('seller delivery cannot confirm cash, make an unpaid order eligible or forge a refund', async () => {
    const seller = await login(accounts.seller), admin = await login(accounts.admin, true);
    const placed = await place(); const sub = await deliver(placed, seller);
    const saved = await app.mongo.collection('suborders').findOne({ _id: sub._id });
    assert.equal(saved.codCollectionStatus, 'pending_collection'); assert.equal(saved.settlementStatus, 'unsettled');
    for (const codCollectionStatus of ['remitted_to_platform', 'refunded']) {
      assert.equal((await request(`/seller/suborders/${sub._id}/status`, { method: 'PUT', token: seller, body: { codCollectionStatus } })).status, 403);
    }
    assert.equal((await cash(sub, 'receipt', seller, 'NOT-ALLOWED-RECEIPT')).status, 403);
    assert.equal((await payout(sub, admin, 'UNRECEIVED-PAYOUT')).status, 409);
    // Old automatically-remitted records without explicit evidence remain blocked.
    await app.mongo.collection('suborders').updateOne({ _id: sub._id }, { $set: { codCollectionStatus: 'remitted_to_platform', settlementStatus: 'eligible_for_payout' } });
    assert.equal((await payout(sub, admin, 'LEGACY-UNVERIFIED-PAYOUT')).status, 409);
  });

  await t.test('receipt amounts and references are verified, retries are idempotent and concurrent payouts claim a package once', async () => {
    const seller = await login(accounts.seller), admin = await login(accounts.admin, true);
    const sub = await deliver(await place(), seller);
    for (const amount of [-1, 0, sub.grossTotalLkr - 1, 1.001]) assert.ok([400, 409].includes((await cash(sub, 'receipt', admin, 'RECEIPT-EXACT-AMOUNT', amount)).status));
    assert.equal((await cash(sub, 'receipt', admin, '')).status, 400);
    assert.equal((await cash(sub, 'receipt', admin, 'RECEIPT-EXACT-AMOUNT')).status, 201);
    assert.equal((await cash(sub, 'receipt', admin, 'RECEIPT-EXACT-AMOUNT')).status, 200);
    assert.equal((await cash(sub, 'receipt', admin, 'SECOND-RECEIPT')).status, 409);
    const second = await deliver(await place(), seller);
    assert.equal((await cash(second, 'receipt', admin, 'RECEIPT-EXACT-AMOUNT')).status, 409);
    const results = await Promise.all([payout(sub, admin, 'CONCURRENT-PAYOUT'), payout(sub, admin, 'CONCURRENT-PAYOUT', ready.url)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
    assert.equal(await app.mongo.collection('settlements').countDocuments(), 1);
    assert.equal((await payout(sub, admin, 'ANOTHER-PAYOUT')).status, 409);
    assert.equal(await app.mongo.collection('cashmovements').countDocuments({ kind: 'payout' }), 1);
  });

  await t.test('a requested return holds payout and returned goods do not imply a refund or automatic restocking', async () => {
    const seller = await login(accounts.seller), admin = await login(accounts.admin, true);
    const placed = await place(); const sub = await deliver(placed, seller);
    await cash(sub, 'receipt', admin, 'RETURN-RECEIPT');
    const action = await request(`/orders/suborders/${sub._id}/customer-action`, { access: placed.guestAccessToken, body: { action: 'request_return' } });
    assert.equal(action.status, 200); assert.equal(action.data.subOrder.settlementStatus, 'held_for_return');
    assert.equal((await payout(sub, admin, 'RETURN-PAYOUT')).status, 409);
    assert.equal((await cash(sub, 'refund', admin, 'PREMATURE-REFUND')).status, 409);
    assert.equal((await request(`/seller/suborders/${sub._id}/status`, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'returned' } })).status, 200);
    let saved = await app.mongo.collection('suborders').findOne({ _id: sub._id });
    assert.equal(saved.codCollectionStatus, 'remitted_to_platform'); assert.equal(saved.refund, undefined);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 99);
    assert.equal((await cash(sub, 'refund', admin, 'CUSTOMER-REFUND', sub.grossTotalLkr - 1)).status, 409);
    assert.equal((await cash(sub, 'refund', admin, 'CUSTOMER-REFUND')).status, 201);
    assert.equal((await cash(sub, 'refund', admin, 'CUSTOMER-REFUND')).status, 200);
    saved = await app.mongo.collection('suborders').findOne({ _id: sub._id });
    assert.equal(saved.codCollectionStatus, 'refunded'); assert.equal(saved.settlementStatus, 'voided');
    const restock = `/admin/suborders/${sub._id}/restock-return`;
    assert.equal((await request(restock, { token: admin, body: { reason: 'Received returned goods.' } })).status, 400);
    for (let i = 0; i < 2; i++) assert.equal((await request(restock, { token: admin, body: { inspectedForResale: true, reason: 'Goods inspected and approved for resale.' } })).status, 200);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 100);
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).variants[0].values[0].stock, 50);
    const view = await request(`/orders/track?orderNumber=${placed.order.orderNumber}`, { access: placed.guestAccessToken });
    assert.equal(view.data.subOrders[0].refund.reference, undefined);
    assert.equal(view.data.subOrders[0].refund.amountLkr, sub.grossTotalLkr);
  });

  await t.test('refund after seller payout creates a recovery obligation and blocks further seller payouts until confirmed recovery', async () => {
    const seller = await login(accounts.seller), admin = await login(accounts.admin, true);
    const placed = await place(); const sub = await deliver(placed, seller);
    await cash(sub, 'receipt', admin, 'PAID-RETURN-RECEIPT');
    assert.equal((await payout(sub, admin, 'PAID-RETURN-PAYOUT')).status, 201);
    await request(`/orders/suborders/${sub._id}/customer-action`, { access: placed.guestAccessToken, body: { action: 'request_return' } });
    await request(`/seller/suborders/${sub._id}/status`, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'returned' } });
    assert.equal((await cash(sub, 'refund', admin, 'PAID-CUSTOMER-REFUND')).status, 201);
    const next = await deliver(await place(), seller);
    await cash(next, 'receipt', admin, 'NEXT-RECEIPT');
    assert.equal((await payout(next, admin, 'NEXT-PAYOUT')).status, 409);
    assert.equal((await cash(sub, 'recovery', admin, 'SELLER-RECOVERY', 949)).status, 409);
    assert.equal((await cash(sub, 'recovery', admin, 'SELLER-RECOVERY', 950)).status, 201);
    assert.equal((await payout(next, admin, 'NEXT-PAYOUT')).status, 201);
  });

  await t.test('shared limits enforce one budget across API processes and never store plaintext client identities', async () => {
    const results = await Promise.all(Array.from({ length: 70 }, (_, index) => request('/orders/track?orderNumber=NOT-A-REAL-ORDER', { url: index % 2 ? ready.url : app.url })));
    assert.equal(results.filter((result) => result.status === 404).length, 60);
    assert.equal(results.filter((result) => result.status === 429).length, 10);
    const counters = await app.mongo.collection('ratelimits').find({}).toArray();
    assert.equal(counters.length, 1); assert.equal(counters[0].hits, 61); assert.ok(counters[0].expiresAt instanceof Date);
    assert.ok(!JSON.stringify(counters).includes('127.0.0.1'));
    const { consumeLimit } = await import('../src/middleware/sharedRateLimit.js');
    const instant = Date.now();
    assert.equal((await consumeLimit('boundary', 'test-client', 1, 1000, instant)).allowed, true);
    assert.equal((await consumeLimit('boundary', 'test-client', 1, 1000, instant)).allowed, false);
    assert.equal((await consumeLimit('boundary', 'test-client', 1, 1000, instant + 1000)).allowed, true);
  });

  await t.test('monitoring is authenticated and exposes only bounded aggregate counters', async () => {
    const previous = process.env.MONITORING_TOKEN;
    process.env.MONITORING_TOKEN = 'tests-only-monitoring-secret-32-characters';
    try {
      assert.equal((await request('/operations/status')).status, 401);
      const { recordOperationalEvent } = await import('../src/config/operations.js');
      for (let i = 0; i < 3; i++) await recordOperationalEvent('checkout_failure');
      const response = await request('/operations/status', { token: process.env.MONITORING_TOKEN });
      assert.equal(response.status, 200); assert.equal(response.data.status, 'degraded');
      assert.deepEqual(response.data.alerts, ['checkout_failures']);
      assert.equal(response.data.counts.checkout_failure, 3);
      assert.ok(!JSON.stringify(response.data).includes(accounts.customer));
      assert.ok((await app.mongo.collection('operationalmetrics').listIndexes().toArray()).some((index) => index.expireAfterSeconds === 0));
    } finally { if (previous === undefined) delete process.env.MONITORING_TOKEN; else process.env.MONITORING_TOKEN = previous; }
  });

  await t.test('administrator lockouts are shared across instances and sensitive routes fail closed when protection storage fails', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await request('/auth/admin/login', { body: { email: accounts.admin, password: 'incorrect-password' }, url: i % 2 ? ready.url : app.url })).status, 401);
    assert.equal((await request('/auth/admin/login', { body: { email: accounts.admin, password: TEST_PASSWORD }, url: ready.url })).status, 429);
    const original = app.mongo.collection;
    app.mongo.collection = function (name, ...options) {
      if (name === 'ratelimits') return { async findOneAndUpdate() { throw new Error('Synthetic shared protection outage'); } };
      return original.call(this, name, ...options);
    };
    try { assert.equal((await request('/orders/track?orderNumber=TEST')).status, 503); }
    finally { app.mongo.collection = original; }
  });

  await t.test('staging setup creates private synthetic accounts and business indexes without replacing existing orders', async () => {
    const script = fileURLToPath(new URL('../scripts/seed-staging.js', import.meta.url));
    const environment = { ...process.env, MONGODB_URI: app.mongoUri, APP_ENV: 'staging', MONGODB_DB_NAME: 'yaans_staging_lk',
      STAGING_ACCOUNT_PASSWORD: 'PrivateSyntheticStagingPassword@123' };
    await assert.rejects(runFile(process.execPath, [script], { env: { ...environment, MONGODB_DB_NAME: 'yaans_lk' } }));
    await runFile(process.execPath, [script], { env: environment });
    const stage = app.mongo.client.db('yaans_staging_lk');
    assert.equal(await stage.collection('users').countDocuments(), 4);
    const admin = await stage.collection('users').findOne({ email: accounts.admin });
    assert.equal(await bcrypt.compare(TEST_PASSWORD, admin.passwordHash), false);
    assert.equal(await bcrypt.compare(environment.STAGING_ACCOUNT_PASSWORD, admin.passwordHash), true);
    await assert.rejects(stage.collection('users').insertOne({ _id: 'duplicate-email', email: accounts.admin }), (error) => error.code === 11000);
    await stage.collection('orders').insertOne({ _id: 'staging-order-to-preserve' });
    await runFile(process.execPath, [script], { env: environment });
    assert.equal(await stage.collection('orders').countDocuments({ _id: 'staging-order-to-preserve' }), 1);
    assert.equal(await app.mongo.collection('users').countDocuments(), 4);
  });

  await t.test('encrypted backups restore BSON IDs, dates and indexes into a separate empty database without erasing production-like data', async () => {
    const root = path.resolve(os.tmpdir()); const directory = await fs.mkdtemp(path.join(root, 'yaans-backup-test-'));
    const keys = generateKeyPairSync('rsa', { modulusLength: 3072,
      publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const publicFile = path.join(directory, 'public.pem'), privateFile = path.join(directory, 'key.private.pem');
    await fs.writeFile(publicFile, keys.publicKey); await fs.writeFile(privateFile, keys.privateKey);
    const script = fileURLToPath(new URL('../scripts/backup_db.js', import.meta.url));
    const environment = { ...process.env, MONGODB_URI: app.mongoUri, BACKUP_PUBLIC_KEY_FILE: publicFile };
    try {
      const placed = await place();
      await app.mongo.collection('typechecks').insertOne({ _id: new app.db.MODEL_MAP.users.db.base.Types.ObjectId(), at: new Date('2026-01-01'), value: 5 });
      await app.mongo.collection('typechecks').createIndex({ value: 1 }, { unique: true });
      await runFile(process.execPath, [script, `--out=${directory}`], { env: environment });
      const files = (await fs.readdir(directory)).filter((name) => name.endsWith('.backup.enc'));
      assert.equal(files.length, 1);
      const filename = path.join(directory, files[0]);
      assert.ok(!(await fs.readFile(filename, 'utf8')).includes(accounts.admin));
      const target = `yaans_restore_${randomUUID().replaceAll('-', '')}`;
      await runFile(process.execPath, [script, `--restore=${filename}`, `--private-key=${privateFile}`, `--target-db=${target}`], { env: environment });
      const restored = app.mongo.client.db(target);
      assert.equal(await restored.collection('orders').countDocuments({ _id: placed.order._id }), 1);
      assert.equal((await restored.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 99);
      assert.equal(await restored.collection('users').countDocuments(), 4);
      const value = await restored.collection('typechecks').findOne({ value: 5 });
      assert.equal(value._id._bsontype, 'ObjectId'); assert.ok(value.at instanceof Date);
      assert.ok((await restored.collection('typechecks').listIndexes().toArray()).some((index) => index.unique));
      const drillScript = fileURLToPath(new URL('../scripts/restore-drill.js', import.meta.url));
      await runFile(process.execPath, [drillScript], { env: { ...environment, RESTORE_MONGODB_URI: app.mongoUri,
        BACKUP_FILE: filename, BACKUP_PRIVATE_KEY_FILE: privateFile } });
      assert.equal((await app.mongo.client.db('yaans_restore_automated').listCollections().toArray()).length, 0);
      await assert.rejects(runFile(process.execPath, [script, `--restore=${filename}`, `--private-key=${privateFile}`, '--target-db=yaans_automated_test'], { env: environment }));
      await assert.rejects(runFile(process.execPath, [script, `--restore=${filename}`, `--private-key=${privateFile}`, `--target-db=${target}`], { env: environment }));
      assert.equal(await app.mongo.collection('users').countDocuments(), 4);
    } finally {
      assert.equal(path.dirname(path.resolve(directory)), root); assert.ok(path.basename(directory).startsWith('yaans-backup-test-'));
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
