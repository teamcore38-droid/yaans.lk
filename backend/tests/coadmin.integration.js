import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as OTPAuth from 'otpauth';
import mongoose from 'mongoose';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, adminLoginBody, nextAdminRecoveryCode } from '../../tests/support/fixtures.js';
import { OPERATIONS_PRESET } from '../../shared/adminAccess.js';

test('co-admin operations enforce individual MFA and owner-controlled permissions', { timeout: 180000 }, async t => {
  const app = await startIsolatedApp(); t.after(() => app.close()); t.beforeEach(() => app.reset());
  async function req(path, { token, body, method = body ? 'POST' : 'GET', headers = {} } = {}) {
    const response = await fetch(app.url + '/api' + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const owner = async () => { const r = await req('/auth/admin/login', { body: adminLoginBody() }); assert.equal(r.status, 200); assert.ok(r.data.token); return r.data.token; };
  const change = (token, id, body) => req('/admin/coadmins' + (id ? '/' + id : ''), { token, method: id ? 'PATCH' : 'POST', body: { currentPassword: TEST_PASSWORD, code: nextAdminRecoveryCode(), ...body } });
  async function create(token, permissions = OPERATIONS_PRESET) {
    const result = await change(token, null, { name: 'Operations User', email: 'operations@test.invalid', phone: '0771234567', password: TEST_PASSWORD, permissions });
    assert.equal(result.status, 201, JSON.stringify(result.data)); return result.data.id;
  }
  const revision = async (token, sku = 'prd_test_spice') => (await req('/admin/operations?module=products&q=' + sku, { token })).data.rows[0].revision;
  const login = body => req('/auth/admin/login', { body: { email: 'operations@test.invalid', password: TEST_PASSWORD, ...body } });
  async function enroll(temporary) {
    const begin = await req('/auth/admin/mfa/enroll', { token: temporary, body: { currentPassword: TEST_PASSWORD } }); assert.equal(begin.status, 200);
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(begin.data.secret), algorithm: 'SHA1', digits: 6, period: 30 });
    const confirm = await req('/auth/admin/mfa/confirm', { token: temporary, body: { code: totp.generate() } }); assert.equal(confirm.status, 200);
    return confirm.data;
  }
  async function ready() {
    const admin = await owner(), id = await create(admin), temporary = await login();
    const enrolled = await enroll(temporary.data.token);
    const password = 'Operations-personal-passphrase!456';
    const changed = await req('/auth/update-credentials', { token: enrolled.token, method: 'PUT', body: { currentPassword: TEST_PASSWORD, newPassword: password } });
    assert.equal(changed.status, 200); return { admin, id, token: changed.data.token, password, codes: enrolled.recoveryCodes };
  }

  await t.test('owner roster writes require fresh password plus one-use MFA and cannot grant ownership', async () => {
    const token = await owner();
    const body = { name: 'Operations User', email: 'operations@test.invalid', phone: '0771234567', password: TEST_PASSWORD };
    assert.equal((await req('/admin/coadmins', { token, body })).status, 401);
    assert.equal((await change(token, null, { ...body, permissions: ['owner'] })).status, 400);
    const code = nextAdminRecoveryCode();
    const created = await req('/admin/coadmins', { token, body: { ...body, role: 'admin', adminAccess: 'owner', currentPassword: TEST_PASSWORD, code } });
    assert.equal(created.status, 201);
    const stored = await app.mongo.collection('users').findOne({ _id: created.data.id });
    assert.equal(stored.adminAccess, 'coadmin'); assert.equal(stored.adminMustChangePassword, true); assert.deepEqual(stored.adminPermissions, OPERATIONS_PRESET);
    assert.notEqual(stored.passwordHash, TEST_PASSWORD); assert.equal(stored.adminMfa, undefined);
    assert.equal((await req('/admin/coadmins/' + created.data.id, { token, method: 'PATCH', body: { currentPassword: TEST_PASSWORD, code, permissions: [] } })).status, 401);
    assert.equal((await change(token, 'usr_test_admin', { permissions: [] })).status, 404);
    const roster = await req('/admin/coadmins', { token }); assert.equal(roster.data.coadmins.length, 1);
    assert.ok(!JSON.stringify(roster.data).includes('passwordHash')); assert.ok(!JSON.stringify(roster.data).includes('recoveryHashes'));
  });

  await t.test('temporary login is setup-only, MFA is individual, and both password change and enrollment are required', async () => {
    const admin = await owner(); const id = await create(admin);
    assert.equal((await req('/auth/login', { body: { email: 'operations@test.invalid', password: TEST_PASSWORD } })).status, 403);
    const temporary = await login(); assert.equal(temporary.data.user.adminSetupRequired, true);
    assert.equal((await req('/admin/operations?module=products', { token: temporary.data.token })).status, 403);
    const enrolled = await enroll(temporary.data.token); assert.equal(enrolled.recoveryCodes.length, 8);
    assert.equal((await req('/auth/me', { token: temporary.data.token })).status, 401);
    assert.equal((await req('/admin/operations?module=products', { token: enrolled.token })).status, 403);
    assert.equal((await req('/auth/update-credentials', { token: enrolled.token, method: 'PUT', body: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD } })).status, 400);
    const personal = await req('/auth/update-credentials', { token: enrolled.token, method: 'PUT', body: { currentPassword: TEST_PASSWORD, newPassword: 'New-personal-passphrase!123' } }); assert.equal(personal.status, 200);
    assert.equal((await req('/admin/operations?module=products', { token: personal.data.token })).status, 200);
    const stored = await app.mongo.collection('users').findOne({ _id: id }); assert.ok(!JSON.stringify(stored.adminMfa).includes(enrolled.recoveryCodes[0])); assert.equal(stored.adminMustChangePassword, false);
  });

  await t.test('co-admin has no alternate owner, seller override, document or financial access', async () => {
    const { token } = await ready();
    for (const path of ['/admin/overview', '/admin/audit-logs', '/admin/coadmins', '/admin/staff', '/admin/business-settings', '/seller/dashboard', '/documents/email-status', '/notifications']) {
      assert.equal((await req(path, { token })).status, 403, path);
    }
    for (const [path, method, body] of [['/admin/config/general', 'PUT', { defaultCommissionPercent: 0 }], ['/admin/suborders/any/cash/refund', 'POST', { amountLkr: 100 }], ['/admin/products/prd_test_spice', 'DELETE', {}], ['/admin/categories/any', 'DELETE', {}], ['/admin/operation-requests/any', 'PATCH', { status: 'reviewed', note: 'Unapproved' }]]) {
      assert.equal((await req(path, { token, method, body })).status, 403, path);
    }
    await app.mongo.collection('orders').insertOne({ _id: 'private_order', userId: 'usr_test_customer', orderNumber: 'PRIVATE' });
    assert.equal((await req('/documents/orders/private_order', { token })).status, 403);
    assert.equal((await req('/admin/orders/private_order', { token })).data.order.orderNumber, 'PRIVATE');
  });

  await t.test('allowed modules redact seller identity/finance and protect product pricing, stock and variants', async () => {
    const { token } = await ready();
    const sellers = await req('/admin/operations?module=sellers', { token }); assert.equal(sellers.status, 200); assert.ok(!/bankDetails|nicOrBrNumber|commissionRateOverride/.test(JSON.stringify(sellers.data)));
    const reviewed = await req('/admin/sellers/sel_test_pantry/status', { token, method: 'PUT', body: { status: 'approved', rejectionReason: 'Reviewed storefront content' } }); assert.equal(reviewed.status, 200); assert.ok(!/bankDetails|nicOrBrNumber|commissionRateOverride/.test(JSON.stringify(reviewed.data)));
    assert.equal((await req('/admin/sellers/sel_test_pantry/status', { token, method: 'PUT', body: { status: 'approved', rejectionReason: 'Reviewed', commissionRateOverride: 0 } })).status, 403);
    for (const body of [{ stock: 0 }, { priceLkr: 1 }, { variants: [] }, { sellerId: 'changed' }]) assert.equal((await req('/admin/products/prd_test_spice', { token, method: 'PUT', body })).status, 403);
    assert.equal((await req('/admin/products/prd_test_spice', { token, method: 'PUT', body: { title: { $ne: null } } })).status, 400);
    const stale = await revision(token);
    await app.mongo.collection('products').updateOne({ _id: 'prd_test_spice' }, { $set: { description: 'Concurrent change' } });
    assert.equal((await req('/admin/products/prd_test_spice', { token, method: 'PUT', body: { title: 'Stale change', revision: stale } })).status, 409);
    const updated = await req('/admin/products/prd_test_spice', { token, method: 'PUT', body: { title: 'Reviewed product content', revision: await revision(token) } }); assert.equal(updated.status, 200);
    assert.equal(updated.data.product.stock, 100); assert.equal(updated.data.product.priceLkr, 1000);
    assert.equal((await req('/admin/products/prd_test_pending/moderation', { token, method: 'PUT', body: { approvalStatus: 'approved', revision: await revision(token, 'prd_test_pending') } })).status, 200);
    const upload = new FormData(); upload.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
    assert.equal((await fetch(app.url + '/api/admin/product-image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: upload })).status, 415);
    assert.ok(await app.mongo.collection('securityevents').findOne({ event: 'product_override', userId: updated.data.product.lastEditedById || (await app.mongo.collection('users').findOne({ email: 'operations@test.invalid' }))._id }));
  });

  await t.test('permission updates, suspension and security reset revoke sessions and pending MFA challenges', async () => {
    const { admin, id, token, password, codes } = await ready();
    const challenge = await login({ password }); assert.equal(challenge.data.requiresMfa, true);
    assert.equal((await change(admin, id, { permissions: ['products', 'productPricing'] })).status, 200);
    assert.equal((await req('/admin/operations?module=products', { token })).status, 401);
    assert.equal((await req('/auth/admin/mfa/login', { body: { challengeToken: challenge.data.challengeToken, code: codes[0] } })).status, 401);
    const current = await login({ password, code: codes[0] }); assert.equal(current.status, 200);
    assert.equal((await req('/admin/orders/private_order', { token: current.data.token })).status, 403);
    assert.equal((await req('/admin/operations?module=sellers', { token: current.data.token })).status, 403);
    assert.equal((await req('/admin/products/prd_test_spice', { token: current.data.token, method: 'PUT', body: { priceLkr: 1200, revision: await revision(current.data.token) } })).status, 200);
    assert.equal((await req('/admin/products/prd_test_spice', { token: current.data.token, method: 'PUT', body: { stock: 0 } })).status, 403);
    assert.equal((await change(admin, id, { isActive: false })).status, 200);
    assert.equal((await req('/auth/me', { token: current.data.token })).status, 401);
    assert.equal((await login({ password })).status, 403);
    assert.equal((await change(admin, id, { isActive: true, resetSecurity: true, newPassword: TEST_PASSWORD })).status, 200);
    const reset = await login(); assert.equal(reset.data.user.mfaEnabled, false); assert.equal(reset.data.user.adminMustChangePassword, true);
    assert.equal((await req('/admin/operations?module=products', { token: reset.data.token })).status, 403);
  });

  await t.test('stock overrides are separately granted and stale inventory edits are rejected', async () => {
    const { admin, id, password, codes } = await ready();
    assert.equal((await change(admin, id, { permissions: ['products', 'productStock'] })).status, 200);
    const session = await login({ password, code: codes[0] }); assert.equal(session.status, 200);
    const before = await revision(session.data.token);
    const stocked = await req('/admin/products/prd_test_spice', { token: session.data.token, method: 'PUT', body: { stock: 70, revision: before } });
    assert.equal(stocked.status, 200); assert.equal(stocked.data.product.stock, 70); assert.equal(stocked.data.product.priceLkr, 1000);
    assert.equal((await req('/admin/products/prd_test_spice', { token: session.data.token, method: 'PUT', body: { priceLkr: 1 } })).status, 403);
    assert.equal((await req('/admin/products/prd_test_spice', { token: session.data.token, method: 'PUT', body: { stock: 90, revision: before } })).status, 409);
  });

  await t.test('bounded pages, audit scope and support requests keep unrelated information private', async () => {
    const { admin, token, id } = await ready();
    await app.mongo.collection('products').insertMany(Array.from({ length: 30 }, (_, i) => ({ _id: 'page_' + String(i).padStart(3, '0'), slug: 'page-' + i, title: 'Page record', stock: 1, priceLkr: 1 })));
    const page = await req('/admin/operations?module=products', { token }); assert.equal(page.data.rows.length, 25); assert.ok(page.data.nextCursor);
    const more = await req('/admin/operations?module=products&after=' + page.data.nextCursor, { token }); assert.equal(more.data.rows.length, 8); assert.ok(!more.data.rows.some(row => page.data.rows.some(old => old._id === row._id)));
    assert.equal((await req('/admin/operations?module=products&q[$ne]=x', { token })).status, 400);
    await app.mongo.collection('orders').insertOne({ _id: 'support_order', orderNumber: 'SUPPORT', overallStatus: 'pending', grandTotalLkr: 9999 });
    const order = await req('/admin/operations?module=orders&q=SUPPORT', { token }); assert.equal(order.data.rows[0].grandTotalLkr, undefined);
    const request = await req('/admin/operation-requests', { token, body: { orderNumber: 'SUPPORT', kind: 'refund', reason: 'Customer asks for review' } }); assert.equal(request.status, 201);
    assert.equal((await app.mongo.collection('orders').findOne({ _id: 'support_order' })).overallStatus, 'pending'); assert.equal(await app.mongo.collection('cashmovements').countDocuments({}), 0);
    await app.mongo.collection('operationrequests').insertOne({ _id: 'other_user_request', actorId: 'other', reason: 'PRIVATE' });
    assert.equal((await req('/admin/operation-requests', { token })).data.rows.length, 1);
    assert.equal((await req('/admin/operation-requests/' + request.data.request._id, { token: admin, method: 'PATCH', body: { status: 'reviewed', note: 'Use protected refund workflow after reconciliation' } })).status, 200);
    assert.equal(await app.mongo.collection('cashmovements').countDocuments({}), 0);
    await app.mongo.collection('securityevents').insertOne({ userId: 'other', event: 'PRIVATE', createdAt: new Date() });
    const audit = await req('/admin/operations?module=audit', { token }); assert.equal(audit.status, 200); assert.ok(!JSON.stringify(audit.data).includes('PRIVATE'));
    assert.ok(await app.mongo.collection('securityevents').findOne({ userId: id, event: 'coadmin_operation', outcome: 'requested' }));
  });

  await t.test('expired temporary access and unenrolled owners stay locked to security setup', async () => {
    const token = await owner(); const id = await create(token);
    const temporary = await login();
    await app.mongo.collection('users').updateOne({ _id: id }, { $set: { adminInvitationExpiresAt: new Date(Date.now() - 1) } });
    assert.equal((await login()).status, 403); assert.equal((await req('/auth/me', { token: temporary.data.token })).status, 403);
    await app.mongo.collection('users').updateOne({ _id: 'usr_test_admin' }, { $unset: { adminMfa: '' }, $inc: { tokenVersion: 1 } });
    const setup = await req('/auth/admin/login', { body: { email: accounts.admin, password: TEST_PASSWORD } }); assert.equal(setup.data.user.adminSetupRequired, true);
    assert.equal((await req('/admin/overview', { token: setup.data.token })).status, 403);
    assert.equal((await req('/auth/me', { token: setup.data.token })).status, 200);
  });

  await t.test('audit storage failures prevent co-admin mutations and browser writes require CSRF', async () => {
    const { token, password, codes } = await ready();
    const currentRevision = await revision(token);
    const original = mongoose.mongo.Collection.prototype.insertOne;
    mongoose.mongo.Collection.prototype.insertOne = function(document, ...options) {
      if (this.collectionName === 'securityevents' && document.event === 'coadmin_operation') return Promise.reject(new Error('Synthetic audit outage'));
      return original.call(this, document, ...options);
    };
    try {
      assert.equal((await req('/admin/products/prd_test_spice', { token, method: 'PUT', body: { title: 'Unaudited update', revision: currentRevision } })).status, 500);
    } finally { mongoose.mongo.Collection.prototype.insertOne = original; }
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).title, 'Test Ceylon Spice');
    const browser = await req('/auth/admin/login', { body: { email: 'operations@test.invalid', password, code: codes[0] }, headers: { 'X-Yaans-Client': 'browser' } });
    assert.equal(browser.status, 200); assert.equal(browser.data.token, undefined);
    const cookie = browser.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
    assert.equal((await req('/admin/products/prd_test_spice', { method: 'PUT', body: { title: 'Missing CSRF', revision: currentRevision }, headers: { Cookie: cookie } })).status, 403);
  });
});
