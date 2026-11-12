import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';

test('order notifications are durable, private, idempotent and independently readable', { timeout: 120000 }, async t => {
  const app = await startIsolatedApp(); t.after(() => app.close());
  async function request(path, token, body, key) {
    const response = await fetch(`${app.url}/api${path}`, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  }
  const login = async (email, admin = false) => (await request(admin ? '/auth/admin/login' : '/auth/login', null, { email, password: TEST_PASSWORD })).data.token;
  const admin = await login(accounts.admin, true), seller = await login(accounts.seller), other = await login(accounts.otherSeller), customer = await login(accounts.customer);
  assert.equal((await request('/notifications')).status, 401);
  assert.equal((await request('/notifications', customer)).status, 403);
  const body = { items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }, { productId: 'prd_test_lamp', quantity: 1 }], shippingAddress, paymentMethod: 'COD', codConfirmedByCustomer: true };
  const key = randomUUID();
  assert.equal((await request('/orders/checkout', customer, body, key)).status, 201);
  assert.equal((await request('/orders/checkout', customer, body, key)).status, 200);
  assert.equal(await app.mongo.collection('ordernotifications').countDocuments(), 3);
  const a = await request('/notifications', admin), s = await request('/notifications', seller), o = await request('/notifications', other);
  assert.equal(a.data.notifications[0].items.length, 2);
  assert.equal(s.data.notifications[0].items.length, 1);
  assert.equal(o.data.notifications[0].items.length, 1);
  assert.notEqual(s.data.notifications[0].items[0].title, o.data.notifications[0].items[0].title);
  assert.equal(s.data.notifications[0].recipient, undefined);
  assert.match(s.cache, /no-store/);
  const id = s.data.notifications[0]._id;
  assert.equal((await request(`/notifications/${encodeURIComponent(id)}/read`, other, {})).status, 404);
  assert.equal((await request(`/notifications/${encodeURIComponent(id)}/read`, seller, {})).status, 200);
  assert.equal((await request(`/notifications/${encodeURIComponent(id)}/read`, seller, {})).status, 200);
  assert.equal((await request('/notifications', seller)).data.unreadCount, 0);
  assert.equal((await request('/notifications', admin)).data.unreadCount, 1);
  assert.equal((await request('/notifications', other)).data.unreadCount, 1);
  assert.equal((await request('/orders/checkout', customer, { ...body, items: [{ productId: 'prd_test_spice', quantity: 999999 }] }, randomUUID())).status, 400);
  assert.equal(await app.mongo.collection('ordernotifications').countDocuments(), 3);
  const collection = app.mongo.collection('ordernotifications');
  const plan = await collection.find({ recipient: `seller:${(await app.mongo.collection('sellers').findOne({ userId: 'usr_test_seller' }))._id}`, readAt: null }).sort({ createdAt: -1, _id: -1 }).limit(20).hint('order_notification_inbox').explain('executionStats');
  assert.ok(plan.executionStats.totalDocsExamined <= 20);
  await app.reset();
  await app.mongo.command({ collMod: 'ordernotifications', validator: { totalLkr: { $lt: 0 } } });
  try {
    assert.equal((await request('/orders/checkout', customer, body, randomUUID())).status, 503);
  } finally { await app.mongo.command({ collMod: 'ordernotifications', validator: {} }); }
  assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
  assert.equal(await app.mongo.collection('checkoutrequests').countDocuments(), 0);
  assert.equal(await collection.countDocuments(), 0);

});
