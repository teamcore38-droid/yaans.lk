import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleConfiguration, validateGoogleIdentity } from '../src/services/googleLogin.js';
import { customerRedirect } from '../../shared/customerRedirect.js';
import { UserModel } from '../src/models/schemas.js';

test('only Google customer accounts can omit profile phone and start without a delivery district', () => {
  const base = { _id: 'profile-test', name: 'Customer', email: 'customer@test.invalid', passwordHash: 'synthetic-hash' };
  const google = new UserModel({ ...base, googleSubject: '123456789', role: 'customer', phone: '' });
  assert.equal(google.validateSync(), undefined);
  assert.equal(google.defaultDistrict, null);
  for (const role of ['customer', 'seller', 'staff', 'admin']) {
    const account = new UserModel({ ...base, role, ...(role !== 'customer' ? { googleSubject: '123456789' } : {}) });
    assert.ok(account.validateSync()?.errors.phone, `${role} must retain its existing phone requirement`);
  }
});

test('Google login fails closed unless explicitly and safely configured', () => {
  const keys = ['GOOGLE_LOGIN_ENABLED', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_LOGIN_ORIGIN', 'NODE_ENV'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { GOOGLE_LOGIN_ENABLED: 'false', GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'synthetic-secret', GOOGLE_LOGIN_ORIGIN: 'https://yaans.lk', NODE_ENV: 'production' });
    assert.equal(googleConfiguration(), null);
    process.env.GOOGLE_LOGIN_ENABLED = 'true';
    assert.equal(googleConfiguration().redirectUri, 'https://yaans.lk/api/auth/google/callback');
    for (const origin of ['http://yaans.lk', 'https://yaans.lk/', 'https://yaans.lk/anything', 'https://user@yaans.lk', 'not-a-url']) {
      process.env.GOOGLE_LOGIN_ORIGIN = origin; assert.equal(googleConfiguration(), null);
    }
    process.env.GOOGLE_LOGIN_ORIGIN = 'https://yaans.lk'; process.env.GOOGLE_CLIENT_SECRET = '';
    assert.equal(googleConfiguration(), null);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('verified Google identity requires a request-bound nonce, permanent subject and verified email', () => {
  const valid = { nonce: 'request-nonce', sub: '123456789', email: 'CUSTOMER@GMAIL.COM', email_verified: true, name: 'Customer' };
  assert.deepEqual(validateGoogleIdentity(valid, 'request-nonce'), { subject: '123456789', email: 'customer@gmail.com', name: 'Customer' });
  for (const change of [{ nonce: 'another-nonce' }, { nonce: undefined }, { sub: '' }, { sub: {} }, { email_verified: false }, { email_verified: 'true' }, { email: {} }, { email: 'bad-email' }]) {
    assert.throws(() => validateGoogleIdentity({ ...valid, ...change }, 'request-nonce'), { status: 401 });
  }
});

test('customer login return paths reject external, executable and privileged destinations', () => {
  for (const route of ['//evil.invalid', '/\\evil.invalid', '/%2fevil.invalid', 'https://evil.invalid', '/admin', '/staff', '/seller/dashboard', '/api/auth/login', '/login', '/products\n']) assert.equal(customerRedirect(route), '/account');
  for (const route of ['/', '/checkout', '/cart', '/wishlist', '/products?q=spice', '/product/spice', '/store/kandy']) assert.equal(customerRedirect(route), route);
});
