import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.STAGING_BASE_URL;
const password = process.env.STAGING_ACCOUNT_PASSWORD;
const url = new URL(base || 'https://invalid.invalid');
if (!base || !password || url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.origin !== base) throw new Error('An exact HTTPS staging .vercel.app origin and private staging account password are required. Production domains are refused.');
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
async function request(route, { method = 'GET', body, token, key } = {}) {
  const response = await fetch(`${base}/api${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}), ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  let data; try { data = await response.json(); } catch { throw new Error(`Staging request returned non-JSON (HTTP ${response.status}).`); }
  return { status: response.status, data };
}
const health = await request('/health');
assert.equal(health.status, 200); assert.equal(health.data.environment, 'staging'); assert.equal(health.data.mongoConnected, true);
assert.equal(health.data.writesEnabled, true);
const signIn = async (email, admin = false) => {
  const result = await request(admin ? '/auth/admin/login' : '/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200); return result.data.token;
};
const customer = await signIn('customer@test.yaans.invalid');
const seller = await signIn('seller@test.yaans.invalid');
const admin = await signIn('admin@test.yaans.invalid', true);
const key = randomUUID();
const body = { items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }],
  shippingAddress: { recipientName: 'Staging Test Customer', phone: '0771234567', addressLine1: 'Synthetic address only', city: 'Colombo', district: 'Colombo' },
  customerEmail: 'customer@test.yaans.invalid', paymentMethod: 'COD', codConfirmedByCustomer: true };
const placed = await request('/orders/checkout', { method: 'POST', token: customer, key, body });
assert.equal(placed.status, 201);
assert.equal((await request('/orders/checkout', { method: 'POST', token: customer, key, body })).data.order._id, placed.data.order._id);
const sub = placed.data.subOrders[0];
for (const fulfillmentStatus of ['packed', 'shipped', 'delivered']) {
  const result = await request(`/seller/suborders/${sub._id}/status`, { method: 'PUT', token: seller, body: { fulfillmentStatus } });
  assert.equal(result.status, 200);
  if (fulfillmentStatus === 'delivered') { assert.equal(result.data.subOrder.settlementStatus, 'unsettled'); assert.equal(result.data.subOrder.codCollectionStatus, 'pending_collection'); }
}
const bankReference = `STAGING-${randomUUID()}`;
const payoutBody = { sellerId: sub.sellerId, subOrderIds: [sub._id], amountLkr: 950, bankReference: `${bankReference}-PAYOUT` };
assert.equal((await request('/admin/settlements/payout', { method: 'POST', token: admin, body: payoutBody })).status, 409);
const cash = (kind, amountLkr) => request(`/admin/suborders/${sub._id}/cash/${kind}`, { method: 'POST', token: admin,
  body: { bankReference: `${bankReference}-${kind}`, amountLkr } });
assert.equal((await cash('receipt', sub.grossTotalLkr)).status, 201);
assert.equal((await request('/admin/settlements/payout', { method: 'POST', token: admin, body: payoutBody })).status, 201);
assert.equal((await request('/admin/settlements/payout', { method: 'POST', token: admin, body: payoutBody })).status, 200);
assert.equal((await request(`/orders/suborders/${sub._id}/customer-action`, { method: 'POST', token: customer, body: { action: 'request_return', reason: 'Synthetic staging return' } })).status, 200);
assert.equal((await request(`/seller/suborders/${sub._id}/status`, { method: 'PUT', token: seller, body: { fulfillmentStatus: 'returned' } })).status, 200);
assert.equal((await cash('refund', sub.grossTotalLkr)).status, 201);
assert.equal((await request(`/admin/suborders/${sub._id}/restock-return`, { method: 'POST', token: admin, body: { inspectedForResale: true, reason: 'Synthetic staging return inspected for resale.' } })).status, 200);
assert.equal((await cash('recovery', 950)).status, 201);
console.log(JSON.stringify({ verified: true, environment: 'staging', checks: ['customer checkout and retry', 'seller delivery', 'unreceived-cash payout blocked', 'administrator receipt', 'payout and retry', 'customer return', 'seller return receipt', 'customer refund', 'seller recovery'] }));
