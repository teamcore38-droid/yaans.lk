import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID, createHash, generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';
import { captureBackup } from '../src/config/backupRepository.js';
import { revokedCredentialDigests } from '../src/config/revokedCredentials.js';

test('customer Google OAuth with real JWT verification, HTTP and isolated MongoDB', { timeout: 180000 }, async t => {
  const app = await startIsolatedApp();
  const keys = ['GOOGLE_LOGIN_ENABLED', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_LOGIN_ORIGIN'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const config = { GOOGLE_LOGIN_ENABLED: 'true', GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'synthetic-secret', GOOGLE_LOGIN_ORIGIN: app.url };
  Object.assign(process.env, config);
  t.after(async () => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await app.close(); });
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const providerCodes = new Map();
  // Mock only Google's remote token and certificate endpoints; keep its actual JWT verifier.
  t.mock.method(OAuth2Client.prototype, 'getFederatedSignonCertsAsync', async () => ({ certs: { 'test-key': publicKey.export({ type: 'spki', format: 'pem' }) } }));
  const exchange = t.mock.method(OAuth2Client.prototype, 'getToken', async function (options) {
    const entry = providerCodes.get(options.code); assert.ok(entry, 'only issued synthetic codes may be exchanged');
    providerCodes.delete(options.code);
    assert.equal(options.codeVerifier, entry.verifier); assert.equal(options.redirect_uri, app.url + '/api/auth/google/callback');
    if (entry.fail) throw new Error('synthetic provider failure');
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: 'https://accounts.google.com', aud: config.GOOGLE_CLIENT_ID, iat: now, exp: now + 3600, ...entry.payload };
    const idToken = jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid: 'test-key' });
    return { tokens: { id_token: entry.tampered ? idToken.slice(0, -8) + 'AAAAAAAA' : idToken, access_token: 'discard-this-synthetic-token' } };
  });
  const cookieOf = response => response.headers.getSetCookie().filter(value => !value.includes('Max-Age=0')).map(value => value.split(';')[0]).join('; ');
  async function request(route, { body, cookie, headers = {}, token, method = body ? 'POST' : 'GET' } = {}) {
    const response = await fetch(app.url + '/api' + route, { method, redirect: 'manual', headers: {
      ...(body ? { 'Content-Type': 'application/json', Origin: app.url, 'X-Yaans-Client': 'browser' } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  }
  async function begin({ email = 'new@gmail.com', subject = '100001', claims = {}, returnTo = '/checkout', cookie, purpose, token, headers } = {}) {
    const result = await request('/auth/google/start', { body: { returnTo, purpose }, cookie, token, headers }); assert.equal(result.status, 200, JSON.stringify(result.data));
    const url = new URL(result.data.url); const state = url.searchParams.get('state');
    assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('scope'), 'openid email profile'); assert.equal(url.searchParams.get('access_type'), 'online');
    const attempt = await app.mongo.collection('authchallenges').findOne({ _id: `google-state:${createHash('sha256').update(state).digest('hex')}` });
    assert.ok(attempt); assert.equal(createHash('sha256').update(attempt.codeVerifier).digest('base64url'), url.searchParams.get('code_challenge'));
    const code = randomBytes(16).toString('hex');
    providerCodes.set(code, { verifier: attempt.codeVerifier, payload: { sub: subject, email, email_verified: true, nonce: attempt.nonce, name: 'Google Customer', ...claims } });
    return { cookie: cookieOf(result), state, callback: `/auth/google/callback?state=${encodeURIComponent(state)}&code=${code}` };
  }
  async function prepare(options) {
    const flow = await begin(options); const callback = await request(flow.callback, { cookie: flow.cookie });
    assert.equal(callback.status, 303); assert.equal(callback.headers.get('location'), app.url + '/login?google=complete');
    const cookie = cookieOf(callback); const pending = await request('/auth/google/pending', { cookie }); assert.equal(pending.status, 200);
    return { ...flow, cookie, pending: pending.data };
  }
  async function complete(flow, body) { return request('/auth/google/complete', { cookie: flow.cookie, headers: { 'X-Google-CSRF': flow.pending.csrf }, body }); }
  const profile = { name: 'New Customer', phone: '0771234567', defaultDistrict: 'Kandy', acceptTerms: true };
  async function scenario(name, work) { await t.test(name, async () => { await app.reset(); Object.assign(process.env, config); await work(); }); }

  await scenario('disabled/malformed configuration and maintenance fail closed without affecting password login', async () => {
    process.env.GOOGLE_LOGIN_ENABLED = 'false'; assert.equal((await request('/auth/google/config')).data.enabled, false);
    assert.equal((await request('/auth/google/start', { body: {} })).status, 503);
    assert.equal((await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD } })).status, 200);
    process.env.GOOGLE_LOGIN_ENABLED = 'true'; process.env.MAINTENANCE_READ_ONLY = 'true';
    try {
      assert.equal((await request('/auth/google/config')).data.enabled, false);
      assert.equal((await request('/auth/google/callback?state=x&code=x')).status, 503);
    } finally { process.env.MAINTENANCE_READ_ONLY = ''; }
  });

  await scenario('new customers complete a validated profile, get secure cookies and can place orders', async () => {
    const flow = await prepare(); assert.equal(flow.pending.mode, 'register');
    assert.equal((await request('/auth/me', { cookie: flow.cookie })).status, 401);
    assert.equal((await complete(flow, { ...profile, phone: '' })).status, 400);
    assert.equal((await complete(flow, { ...profile, defaultDistrict: 'Invalid' })).status, 400);
    assert.equal((await complete(flow, { ...profile, acceptTerms: false })).status, 400);
    const result = await complete(flow, { ...profile, role: 'admin', googleSubject: 'attacker', email: accounts.admin });
    assert.equal(result.status, 201); assert.equal(result.data.token, undefined);
    assert.equal(result.data.user.role, 'customer'); assert.equal(result.data.user.email, 'new@gmail.com');
    assert.equal(result.data.user.hasPassword, false); assert.equal(result.data.user.googleLinked, true);
    assert.equal(result.data.user.googleSubject, undefined); assert.equal(result.data.user.passwordHash, undefined);
    assert.equal(result.data.returnTo, '/checkout'); assert.match(result.headers.get('cache-control'), /no-store/);
    assert.ok(result.headers.getSetCookie().some(value => value.startsWith('yaans_session=') && value.includes('HttpOnly') && value.includes('SameSite=Lax')));
    const session = cookieOf(result); const csrf = /yaans_csrf=([^;]+)/.exec(session)[1];
    assert.equal((await request('/auth/me', { cookie: session })).status, 200);
    const stored = await app.mongo.collection('users').findOne({ email: 'new@gmail.com' });
    assert.equal(stored.passwordHash, null); assert.ok(stored.termsAcceptedAt); assert.equal(stored.phone, profile.phone);
    assert.equal((await request('/auth/login', { body: { email: stored.email, password: TEST_PASSWORD } })).status, 401);
    assert.equal((await request('/auth/admin/login', { body: { email: stored.email, password: TEST_PASSWORD } })).status, 401);
    assert.equal((await request('/auth/update-credentials', { method: 'PUT', cookie: session, headers: { 'X-CSRF-Token': csrf }, body: { newPassword: TEST_PASSWORD, currentPassword: TEST_PASSWORD } })).status, 400);
    const order = await request('/orders/checkout', { cookie: session, headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': randomUUID() }, body: {
      items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }], shippingAddress, paymentMethod: 'COD', codConfirmedByCustomer: true
    } }); assert.equal(order.status, 201, JSON.stringify(order.data));
    assert.equal((await complete(flow, profile)).status, 401);
    const logs = JSON.stringify(await app.mongo.collection('securityevents').find({}).toArray());
    assert.ok(!logs.includes('discard-this-synthetic-token')); assert.ok(!logs.includes('synthetic-secret'));
  });

  await scenario('legacy customer linking requires password, preserves data, invalidates old sessions, and binds future login to subject', async () => {
    const original = await app.mongo.collection('users').findOne({ email: accounts.customer });
    const prior = await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD }, headers: { 'X-Yaans-Client': 'native-test' } });
    const flow = await prepare({ email: accounts.customer }); assert.equal(flow.pending.mode, 'link');
    assert.equal((await complete(flow, { currentPassword: 'wrong' })).status, 401);
    const linked = await complete(flow, { currentPassword: TEST_PASSWORD }); assert.equal(linked.status, 200);
    assert.equal(linked.data.user._id, original._id); assert.deepEqual(linked.data.user.wishlist, original.wishlist);
    assert.equal((await app.mongo.collection('users').findOne({ _id: original._id })).passwordHash, original.passwordHash);
    assert.equal((await request('/auth/me', { token: prior.data.token })).status, 401);
    const again = await begin({ email: 'updated-google-email@gmail.com', returnTo: '//evil.invalid' });
    const logged = await request(again.callback, { cookie: again.cookie });
    assert.equal(logged.headers.get('location'), app.url + '/account');
    assert.equal((await request('/auth/me', { cookie: cookieOf(logged) })).data.user._id, original._id);
    const password = await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD } }); assert.equal(password.status, 200);
  });

  await scenario('browser binding, CSRF, expiry and one-use state reject callback and completion replay', async () => {
    const flow = await begin(); const before = exchange.mock.callCount();
    assert.equal((await request(flow.callback)).headers.get('location'), app.url + '/login?google=failed');
    assert.equal(exchange.mock.callCount(), before);
    const callback = await request(flow.callback, { cookie: flow.cookie }); const cookie = cookieOf(callback);
    assert.equal((await request(flow.callback, { cookie: flow.cookie })).headers.get('location'), app.url + '/login?google=failed');
    const data = (await request('/auth/google/pending', { cookie })).data;
    assert.equal((await request('/auth/google/complete', { cookie, body: profile })).status, 403);
    assert.equal((await request('/auth/google/complete', { cookie, body: profile, headers: { Origin: 'https://www.yaans.lk', 'X-Google-CSRF': data.csrf } })).status, 403);
    await app.mongo.collection('authchallenges').updateMany({ _id: /^google-pending:/ }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal((await request('/auth/google/pending', { cookie })).status, 401);
    const expired = await begin(); await app.mongo.collection('authchallenges').updateMany({ _id: /^google-state:/ }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    assert.equal((await request(expired.callback, { cookie: expired.cookie })).headers.get('location'), app.url + '/login?google=failed');
    const cancel = await begin();
    assert.equal((await request(`/auth/google/callback?state=${cancel.state}&error=access_denied`, { cookie: cancel.cookie })).headers.get('location'), app.url + '/login?google=failed');
  });

  await scenario('real Google library rejects invalid audience, issuer, expiry and nonce; unverified emails cannot register', async () => {
    for (const claims of [{ aud: 'wrong-client' }, { iss: 'https://evil.invalid' }, { iat: 1, exp: 2 }, { nonce: 'another-request' }, { email_verified: false }]) {
      const flow = await begin({ claims });
      assert.equal((await request(flow.callback, { cookie: flow.cookie })).headers.get('location'), app.url + '/login?google=failed');
    }
    const tampered = await begin();
    providerCodes.get(new URL('http://test' + tampered.callback).searchParams.get('code')).tampered = true;
    assert.equal((await request(tampered.callback, { cookie: tampered.cookie })).headers.get('location'), app.url + '/login?google=failed');
    assert.equal(await app.mongo.collection('users').countDocuments({ email: 'new@gmail.com' }), 0);
  });

  await scenario('seller, staff, admin, inactive and revoked roles cannot enter through customer Google login', async () => {
    for (const role of ['seller', 'admin', 'staff']) {
      const email = role === 'staff' ? 'staff-google@test.invalid' : accounts[role];
      if (role === 'staff') await app.mongo.collection('users').insertOne({ _id: 'staff_google', email, role, isActive: true, passwordHash: 'synthetic' });
      const flow = await begin({ email, subject: `role-${role}` });
      assert.equal((await request(flow.callback, { cookie: flow.cookie })).headers.get('location'), app.url + '/login?google=failed');
      assert.equal(await app.mongo.collection('users').countDocuments({ email, googleSubject: { $exists: true } }), 0);
    }
    await app.mongo.collection('users').updateOne({ email: accounts.customer }, { $set: { isActive: false } });
    const flow = await begin({ email: accounts.customer });
    assert.equal((await request(flow.callback, { cookie: flow.cookie })).headers.get('location'), app.url + '/login?google=failed');
    const customer = await app.mongo.collection('users').findOne({ email: accounts.customer });
    const revoked = createHash('sha256').update(customer.passwordHash).digest('hex');
    revokedCredentialDigests.add(revoked);
    try {
      await app.mongo.collection('users').updateOne({ _id: customer._id }, { $set: { isActive: true } });
      const attempt = await begin({ email: accounts.customer });
      assert.equal((await request(attempt.callback, { cookie: attempt.cookie })).headers.get('location'), app.url + '/login?google=failed');
    } finally { revokedCredentialDigests.delete(revoked); }
  });

  await scenario('concurrent onboarding cannot create duplicate identities and schema index enforces uniqueness', async () => {
    const one = await prepare(), two = await prepare();
    const results = await Promise.all([complete(one, profile), complete(two, profile)]);
    assert.equal(results.filter(result => result.status === 201).length, 1);
    assert.equal(await app.mongo.collection('users').countDocuments({ googleSubject: '100001' }), 1);
    await assert.rejects(app.mongo.collection('users').insertOne({ _id: 'duplicate_google', email: 'another@gmail.com', googleSubject: '100001' }), error => error.code === 11000);
  });

  await scenario('password setup requires the linked Google identity and revokes previous sessions', async () => {
    const created = await complete(await prepare(), profile); const session = cookieOf(created);
    const csrf = /yaans_csrf=([^;]+)/.exec(session)[1];
    const mismatch = await begin({ purpose: 'set-password', cookie: session, headers: { 'X-CSRF-Token': csrf } });
    const code = new URL('http://test' + mismatch.callback).searchParams.get('code'); providerCodes.get(code).payload.sub = 'wrong-account';
    assert.equal((await request(mismatch.callback, { cookie: mismatch.cookie })).headers.get('location'), app.url + '/login?google=failed');
    // Cookie-session mutations require the normal session CSRF proof as well.
    const denied = await request('/auth/google/start', { body: { purpose: 'set-password' }, cookie: session }); assert.equal(denied.status, 403);
    const result = await request('/auth/google/start', { body: { purpose: 'set-password' }, cookie: session, headers: { 'X-CSRF-Token': csrf } });
    assert.equal(result.status, 200);
    const state = new URL(result.data.url).searchParams.get('state');
    const attempt = await app.mongo.collection('authchallenges').findOne({ _id: `google-state:${createHash('sha256').update(state).digest('hex')}` });
    const secondCode = 'set-password-code'; providerCodes.set(secondCode, { verifier: attempt.codeVerifier, payload: { sub: '100001', email: 'new@gmail.com', email_verified: true, nonce: attempt.nonce } });
    const callback = await request(`/auth/google/callback?state=${state}&code=${secondCode}`, { cookie: cookieOf(result) }); const cookie = cookieOf(callback);
    const flow = { cookie, pending: (await request('/auth/google/pending', { cookie })).data }; assert.equal(flow.pending.mode, 'set-password');
    assert.equal((await complete(flow, { newPassword: 'short' })).status, 400);
    const saved = await complete(flow, { newPassword: TEST_PASSWORD }); assert.equal(saved.status, 200); assert.equal(saved.data.user.hasPassword, true);
    assert.equal((await request('/auth/me', { cookie: session })).status, 401);
    assert.equal((await request('/auth/login', { body: { email: 'new@gmail.com', password: TEST_PASSWORD } })).status, 200);
  });

  await scenario('account changes invalidate pending linking and temporary credentials stay out of backups', async () => {
    const flow = await prepare({ email: accounts.customer });
    const backup = await captureBackup(app.mongo); assert.equal(backup.data.authchallenges, undefined);
    await app.mongo.collection('users').updateOne({ email: accounts.customer }, { $inc: { tokenVersion: 1 } });
    assert.equal((await complete(flow, { currentPassword: TEST_PASSWORD })).status, 409);
    assert.equal((await app.mongo.collection('users').findOne({ email: accounts.customer })).googleSubject, undefined);
  });

  await scenario('completion rate limits persist across requests', async () => {
    const flow = await prepare({ email: accounts.customer });
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await complete(flow, { currentPassword: 'wrong' })).status, 401);
    const denied = await complete(flow, { currentPassword: TEST_PASSWORD }); assert.equal(denied.status, 429); assert.ok(denied.headers.get('retry-after'));
    const passwordLogin = await request('/auth/login', { body: { email: accounts.customer, password: TEST_PASSWORD } });
    assert.equal(passwordLogin.status, 200, 'Google rate limits must not consume the password login budget');
  });
});
