import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { captureBackup } from '../src/config/backupRepository.js';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';

const temporary = 'Temporary-staff-password!123';
const permanent = 'Personal-staff-password!456';
const account = { name: 'Order Operator', email: 'operator@test.invalid', phone: '0771234567', password: temporary, currentPassword: TEST_PASSWORD };
test('staff security, account lifecycle, bounded reads and sessions', { timeout: 180000 }, async t => {
  const app = await startIsolatedApp(); t.after(() => app.close()); t.beforeEach(() => app.reset());
  async function request(path, { token, body, method = body ? 'POST' : 'GET', headers = {} } = {}) {
    const response = await fetch(`${app.url}/api${path}`, { method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  }
  async function login(email, password = TEST_PASSWORD, path = '/auth/login') {
    const result = await request(path, { body: { email, password } }); assert.equal(result.status, 200); return result.data.token;
  }
  const adminLogin = () => login(accounts.admin, TEST_PASSWORD, '/auth/admin/login');
  async function create(admin) {
    const result = await request('/admin/staff', { token: admin, body: account }); assert.equal(result.status, 201); return result.data.staff;
  }
  async function staffReady(admin) {
    const staff = await create(admin);
    const tempToken = await login(account.email, temporary, '/auth/staff/login');
    const result = await request('/auth/staff/password', { token: tempToken, body: { currentPassword: temporary, newPassword: permanent } });
    assert.equal(result.status, 200); return { staff, token: result.data.token, tempToken };
  }
  async function order() {
    const result = await request('/orders/checkout', { headers: { 'Idempotency-Key': randomUUID() }, body: {
      items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }, { productId: 'prd_test_lamp', quantity: 1 }],
      shippingAddress, paymentMethod: 'COD', codConfirmedByCustomer: true } });
    assert.equal(result.status, 201); return result.data.order;
  }
  await t.test('only administrators create/manage staff and must reauthenticate; no role escalation or sensitive output', async () => {
    const admin = await adminLogin(), customer = await login(accounts.customer), seller = await login(accounts.seller);
    assert.equal((await request('/admin/staff')).status, 401);
    for (const token of [customer, seller]) assert.equal((await request('/admin/staff', { token, body: account })).status, 403);
    assert.equal((await request('/admin/staff', { token: admin, body: { ...account, currentPassword: 'incorrect' } })).status, 401);
    assert.equal((await request('/admin/staff', { token: admin, body: { ...account, password: 'short' } })).status, 400);
    assert.equal((await request('/admin/staff', { token: admin, body: { ...account, role: 'admin' } })).status, 400);
    const staff = await create(admin);
    assert.equal(staff.staffMustChangePassword, true); assert.equal(staff.passwordHash, undefined);
    assert.equal((await request('/admin/staff', { token: admin, body: account })).status, 409);
    assert.equal((await request('/admin/staff/usr_test_admin', { token: admin, method: 'PATCH', body: { currentPassword: TEST_PASSWORD, isActive: false } })).status, 404);
    const list = await request('/admin/staff', { token: admin });
    assert.equal(list.data.staff.length, 1); assert.equal(list.data.staff[0].passwordHash, undefined);
    assert.match(list.headers.get('cache-control'), /no-store/);
    const audit = await app.mongo.collection('securityevents').findOne({ event: 'STAFF_CREATED' });
    assert.equal(audit.metadata.staffId, staff._id); assert.ok(!JSON.stringify(audit).includes(temporary));
    const browserAdmin = await request('/auth/admin/login', { body: { email: accounts.admin, password: TEST_PASSWORD }, headers: { 'X-Yaans-Client': 'browser' } });
    const cookies = browserAdmin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.equal((await request('/admin/staff', { body: { ...account, email: 'second@test.invalid' }, headers: { Cookie: cookies } })).status, 403);
  });
  await t.test('dedicated login forces password change, rejects storefront/admin login and restricts staff to order monitoring', async () => {
    const admin = await adminLogin(); const staff = await create(admin);
    assert.equal((await request('/auth/login', { body: { email: account.email, password: temporary } })).status, 403);
    assert.equal((await request('/auth/admin/login', { body: { email: account.email, password: temporary } })).status, 403);
    const token = await login(account.email, temporary, '/auth/staff/login');
    assert.equal((await request('/staff/orders', { token })).status, 403);
    assert.equal((await request('/notifications', { token })).status, 403);
    assert.equal((await request('/auth/me', { token })).data.user.staffMustChangePassword, true);
    assert.equal((await request('/auth/staff/password', { token, body: { currentPassword: temporary, newPassword: temporary } })).status, 400);
    const changed = await request('/auth/staff/password', { token, body: { currentPassword: temporary, newPassword: permanent } });
    assert.equal(changed.status, 200); const active = changed.data.token;
    assert.equal((await request('/auth/me', { token })).status, 401);
    for (const path of ['/admin/overview', '/seller/dashboard', '/admin/staff', '/auth/update-credentials', '/auth/profile', '/auth/wishlist/toggle', '/orders/checkout']) {
      assert.equal((await request(path, { token: active, ...(path.startsWith('/auth/') || path === '/orders/checkout' ? { body: { newEmail: 'attacker@test.invalid', role: 'admin' }, method: path === '/orders/checkout' || path === '/auth/wishlist/toggle' ? 'POST' : 'PUT' } : {}) })).status, 403, path);
    }
    const placed = await order();
    const inbox = (await request('/notifications', { token: active })).data;
    assert.equal(inbox.unreadCount, 1); assert.equal(inbox.notifications[0].items.length, 2);
    assert.equal((await request(`/notifications/${encodeURIComponent(inbox.notifications[0]._id)}/read`, { token: active, body: {} })).status, 200);
    assert.equal((await request('/notifications', { token: admin })).data.unreadCount, 1);
    const list = (await request('/staff/orders', { token: active })).data;
    assert.equal(list.orders[0]._id, placed._id); assert.equal(list.orders[0].shippingAddress, undefined);
    const details = await request(`/staff/orders/${placed._id}`, { token: active });
    assert.equal(details.status, 200); assert.equal(details.data.order.shippingAddress.recipientName, shippingAddress.recipientName);
    assert.equal(details.data.order.guestAccessTokenHash, undefined); assert.equal(details.data.order.customerEmail, undefined);
    assert.equal(details.data.order.packages[0].commissionAmountLkr, undefined);
    assert.equal(details.data.order.packages[0].items[0].unitPriceLkr, undefined);
    assert.equal((await request('/staff/orders?before[$ne]=anything', { token: active })).status, 400);
    assert.ok(await app.mongo.collection('securityevents').findOne({ event: 'staff_order_view', userId: staff._id }));
  });
  await t.test('eight-hour sessions enforce server-side idle expiry, do not renew from polling, and cannot be revived', async () => {
    const admin = await adminLogin(); const { token } = await staffReady(admin);
    const decoded = jwt.decode(token); assert.equal(decoded.exp - decoded.iat, 8 * 3600); assert.equal(decoded.isStaffSession, true);
    const sessions = app.mongo.collection('staffsessions');
    const backup = await captureBackup(app.mongo); assert.equal(backup.data.staffsessions, undefined);
    const before = await sessions.findOne({ _id: decoded.staffSessionId });
    await request('/notifications', { token }); await request('/auth/me', { token }); await request('/staff/orders', { token });
    assert.deepEqual((await sessions.findOne({ _id: decoded.staffSessionId })).lastActiveAt, before.lastActiveAt);
    await sessions.updateOne({ _id: decoded.staffSessionId }, { $set: { lastActiveAt: new Date(Date.now() - 5*60000) } });
    assert.equal((await request('/auth/staff/activity', { token, body: {} })).status, 200);
    assert.ok((await sessions.findOne({ _id: decoded.staffSessionId })).lastActiveAt.getTime() > Date.now() - 10000);
    await sessions.updateOne({ _id: decoded.staffSessionId }, { $set: { lastActiveAt: new Date(Date.now() - 31*60000) } });
    assert.equal((await request('/staff/orders', { token })).status, 401);
    assert.equal((await request('/auth/staff/activity', { token, body: {} })).status, 401);
    const fresh = await login(account.email, permanent, '/auth/staff/login'); const freshId = jwt.decode(fresh).staffSessionId;
    await sessions.updateOne({ _id: freshId }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal((await request('/notifications', { token: fresh })).status, 401);
    const expiredJwt = jwt.sign({ ...decoded, exp: Math.floor(Date.now()/1000) - 1 }, process.env.JWT_SECRET);
    assert.equal((await request('/auth/me', { token: expiredJwt })).status, 401);
    const legacy = jwt.sign({ id: decoded.id, version: 3, tokenVersion: decoded.tokenVersion }, process.env.JWT_SECRET, { issuer: 'yaans.lk', audience: 'yaans.lk' });
    assert.equal((await request('/auth/me', { token: legacy })).status, 401);
  });
  await t.test('disable, re-enable, password reset and logout revoke sessions without deleting order notifications', async () => {
    const admin = await adminLogin(); const { staff, token } = await staffReady(admin); await order();
    assert.equal((await request(`/admin/staff/${staff._id}`, { token: admin, method: 'PATCH', body: { currentPassword: TEST_PASSWORD, isActive: false } })).status, 200);
    assert.equal((await request('/notifications', { token })).status, 401);
    assert.equal((await request('/auth/staff/login', { body: { email: account.email, password: permanent } })).status, 401);
    const notificationCount = await app.mongo.collection('ordernotifications').countDocuments({ recipient: `staff:${staff._id}` });
    await order(); assert.equal(await app.mongo.collection('ordernotifications').countDocuments({ recipient: `staff:${staff._id}` }), notificationCount);
    await request(`/admin/staff/${staff._id}`, { token: admin, method: 'PATCH', body: { currentPassword: TEST_PASSWORD, isActive: true } });
    assert.equal((await request('/auth/me', { token })).status, 401);
    const fresh = await login(account.email, permanent, '/auth/staff/login');
    assert.equal((await request(`/admin/staff/${staff._id}/reset-password`, { token: admin, body: { currentPassword: TEST_PASSWORD, newPassword: temporary } })).status, 200);
    assert.equal((await request('/auth/me', { token: fresh })).status, 401);
    const resetToken = await login(account.email, temporary, '/auth/staff/login');
    assert.equal((await request('/staff/orders', { token: resetToken })).status, 403);
    assert.equal((await request('/auth/logout', { token: resetToken, body: {} })).status, 200);
    assert.equal((await request('/auth/me', { token: resetToken })).status, 401);
  });
  await t.test('staff and order lists use bounded indexed pages without loading private fields', async () => {
    const admin = await adminLogin(); const { token } = await staffReady(admin);
    await app.mongo.collection('users').insertMany(Array.from({ length: 60 }, (_, i) => ({ _id: `usr_staff_extra_${String(i).padStart(3,'0')}`, role: 'staff', name: `Staff ${i}`, email: `staff${i}@test.invalid`, isActive: false, passwordHash: 'hidden' })));
    const first = (await request('/admin/staff', { token: admin })).data;
    assert.equal(first.staff.length, 25); assert.ok(first.nextCursor); assert.equal(first.staff[0].passwordHash, undefined);
    const second = (await request(`/admin/staff?after=${first.nextCursor}`, { token: admin })).data;
    assert.equal(second.staff.length, 25); assert.ok(second.staff.every(user => !first.staff.some(previous => previous._id === user._id)));
    await app.mongo.collection('orders').insertMany(Array.from({ length: 60 }, (_, i) => ({ _id: `ord_page_${i}`, orderNumber: `PAGE-${i}`, createdAt: new Date(Date.now() - i*1000).toISOString(), shippingAddress, guestAccessTokenHash: 'private' })));
    const a = (await request('/staff/orders', { token })).data, b = (await request(`/staff/orders?before=${a.nextCursor}`, { token })).data;
    assert.equal(a.orders.length, 25); assert.equal(b.orders.length, 25); assert.ok(b.orders.every(order => !a.orders.some(previous => previous._id === order._id)));
    assert.equal(a.orders[0].guestAccessTokenHash, undefined);
    const plan = await app.mongo.collection('orders').find({}).sort({ createdAt: -1, _id: -1 }).limit(26).explain('executionStats');
    assert.ok(plan.executionStats.totalDocsExamined <= 26); assert.equal(plan.executionStats.nReturned, 26);
  });
});
