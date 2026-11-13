import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { saveCheckoutDraft, readCheckoutDraft, bindCheckoutDraft, clearCheckoutDraft } from '../src/utils/checkoutDraft.js';
import { customerAuthPath, customerReturnFromLocation } from '../../shared/customerRedirect.js';

const items = [{ productId: 'spice', variantLabel: '100 g', quantity: 2 }];
const customer = { _id: 'customer-a', role: 'customer' };
beforeEach(() => {
  const values = new Map();
  globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
});

test('auth links preserve customer destinations and filters and reject unsafe/privileged pages', () => {
  assert.equal(customerAuthPath('login', '/products?q=spice&sort=price'), '/login?redirect=%2Fproducts%3Fq%3Dspice%26sort%3Dprice');
  assert.equal(customerReturnFromLocation({ pathname: '/product/spice', search: '?reviews=2' }), '/product/spice?reviews=2');
  assert.equal(customerReturnFromLocation({ pathname: '/products', search: '?q=Ceylon%20Spice' }), '/products?q=Ceylon%20Spice');
  assert.equal(customerReturnFromLocation({ pathname: '/login', search: '?google=complete&redirect=%2Fcheckout' }), '/checkout');
  for (const path of ['//evil.invalid', '/admin', '/staff', '/seller/dashboard', '/api/auth/google/callback', '/%2fevil.invalid']) {
    assert.equal(customerAuthPath('register', path), '/register?redirect=%2Faccount');
  }
});

test('draft allowlist excludes credentials, consent and prices; explicit guest login binds to one account', () => {
  saveCheckoutDraft(items, null, { phone: '0771234567', district: 'Galle', addressLine1: '42 Test Street', password: 'never-store', token: 'never-store', codConfirmed: true, total: 1 });
  const draft = readCheckoutDraft(items, null);
  assert.equal(draft.phone, '0771234567'); assert.equal(draft.district, 'Galle');
  assert.equal(draft.password, undefined); assert.equal(draft.token, undefined); assert.equal(draft.codConfirmed, undefined); assert.equal(draft.total, undefined);
  bindCheckoutDraft(customer);
  assert.equal(readCheckoutDraft(items, customer).addressLine1, '42 Test Street');
  assert.equal(readCheckoutDraft(items, null), null);
  assert.equal(readCheckoutDraft(items, { _id: 'other', role: 'customer' }), null);
  bindCheckoutDraft({ _id: 'other', role: 'customer' });
  assert.equal(readCheckoutDraft(items, customer), null);
});

test('draft expiry, malformed data, changed carts, privileged accounts and unavailable storage fail safely', () => {
  saveCheckoutDraft(items, customer, { district: 'Kandy' });
  assert.equal(readCheckoutDraft([{ ...items[0], quantity: 3 }], customer), null);
  assert.equal(readCheckoutDraft(items, { ...customer, role: 'seller' }), null);
  const saved = JSON.parse(sessionStorage.getItem('yaans_checkout_draft_v1'));
  sessionStorage.setItem('yaans_checkout_draft_v1', JSON.stringify({ ...saved, expiresAt: Date.now() - 1 }));
  assert.equal(readCheckoutDraft(items, customer), null);
  sessionStorage.setItem('yaans_checkout_draft_v1', '{broken');
  assert.equal(readCheckoutDraft(items, customer), null);
  saveCheckoutDraft(items, customer, {}); clearCheckoutDraft();
  assert.equal(readCheckoutDraft(items, customer), null);
  globalThis.sessionStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => saveCheckoutDraft(items, customer, {}));
  assert.equal(readCheckoutDraft(items, customer), null);
});
