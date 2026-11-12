import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD, shippingAddress } from '../../tests/support/fixtures.js';

test('marketplace API with disposable MongoDB', { timeout: 600000 }, async (t) => {
  const app = await startIsolatedApp();
  t.after(() => app.close());
  const request = async (route, { method = 'GET', token, body, headers = {} } = {}) => {
    const response = await fetch(`${app.url}/api${route}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(route === '/orders/checkout' ? { 'Idempotency-Key': randomUUID() } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json() };
  };
  const login = async (email, admin = false) => {
    const result = await request(admin ? '/auth/admin/login' : '/auth/login', {
      method: 'POST', body: { email, password: TEST_PASSWORD }
    });
    assert.equal(result.status, 200);
    assert.ok(result.data.token);
    assert.equal(result.data.user.passwordHash, undefined);
    return result.data.token;
  };
  let customerToken;
  let sellerToken;
  let otherSellerToken;
  let adminToken;
  let order;
  let subOrders;

  await t.test('health confirms a real MongoDB connection and preserves the developer data path', async () => {
    const result = await request('/health');
    assert.equal(result.status, 200);
    assert.equal(result.data.mongoConnected, true);
    assert.match(process.env.MONGODB_URI, /^mongodb:\/\/127\.0\.0\.1:/);
    assert.notEqual((await app.mongo.collection('users').findOne({ _id: 'usr_test_admin' })).email, 'admin@yaans.lk');
  });

  await t.test('catalog excludes pending listings and supports combined filters, sorting and pagination', async () => {
    const all = await request('/marketplace/products?sort=price_asc&limit=1');
    assert.equal(all.status, 200);
    assert.equal(all.data.products.length, 1);
    assert.equal(all.data.products[0]._id, 'prd_test_spice');
    assert.equal(all.data.pagination.total, 2);
    const filtered = await request('/marketplace/products?q=lamp&category=electronics&inStock=true&minPrice=2000&maxPrice=3000');
    assert.deepEqual(filtered.data.products.map((p) => p._id), ['prd_test_lamp']);
    const empty = await request('/marketplace/products?q=does-not-exist');
    assert.deepEqual(empty.data.products, []);
    assert.equal((await request('/marketplace/products/missing')).status, 404);
    assert.equal((await request('/marketplace/sellers/test-kandy-pantry')).data.seller.storeName, 'Test Kandy Pantry');
  });

  await t.test('customer, seller and dedicated admin logins return sanitized sessions', async () => {
    customerToken = await login(accounts.customer.toUpperCase());
    sellerToken = await login(accounts.seller);
    otherSellerToken = await login(accounts.otherSeller);
    adminToken = await login(accounts.admin, true);
    assert.equal((await request('/auth/me', { token: customerToken })).data.user.role, 'customer');
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: accounts.admin, password: TEST_PASSWORD } })).status, 403);
    assert.equal((await request('/auth/admin/login', { method: 'POST', body: { email: accounts.customer, password: TEST_PASSWORD } })).status, 403);
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: accounts.customer, password: 'incorrect' } })).status, 401);
  });

  await t.test('missing/tampered sessions and cross-role access are rejected', async () => {
    assert.equal((await request('/auth/me')).status, 401);
    assert.equal((await request('/auth/me', { token: 'invalid-token' })).status, 401);
    assert.equal((await request('/admin/overview', { token: customerToken })).status, 403);
    assert.equal((await request('/seller/dashboard', { token: customerToken })).status, 403);
    assert.equal((await request('/admin/overview', { token: sellerToken })).status, 403);
    const otherProduct = await request('/seller/products/prd_test_lamp/stock', { method: 'PATCH', token: sellerToken, body: { stock: 1 } });
    assert.equal(otherProduct.status, 403);
  });

  await t.test('customer registration normalizes emails and rejects duplicate/missing fields', async () => {
    const payload = { name: 'New Customer', email: 'NEW@TEST.INVALID', phone: '0771234567', password: TEST_PASSWORD };
    const result = await request('/auth/register-customer', { method: 'POST', body: payload });
    assert.equal(result.status, 201);
    assert.equal(result.data.user.email, 'new@test.invalid');
    assert.equal(result.data.user.role, 'customer');
    assert.equal(result.data.user.passwordHash, undefined);
    assert.equal((await request('/auth/register-customer', { method: 'POST', body: { ...payload, email: 'new@test.invalid' } })).status, 409);
    assert.equal((await request('/auth/register-customer', { method: 'POST', body: {} })).status, 400);
  });

  await t.test('addresses and wishlists are isolated to the signed-in customer', async () => {
    const result = await request('/auth/addresses', { method: 'POST', token: customerToken, body: { ...shippingAddress, label: 'Home', isDefault: true } });
    assert.equal(result.status, 200);
    assert.equal(result.data.addresses[0].isDefault, true);
    const addressId = result.data.addresses[0]._id;
    const saved = await request('/auth/wishlist/toggle', { method: 'POST', token: customerToken, body: { productId: 'prd_test_spice' } });
    assert.deepEqual(saved.data.wishlist, ['prd_test_spice']);
    const removed = await request('/auth/wishlist/toggle', { method: 'POST', token: customerToken, body: { productId: 'prd_test_spice' } });
    assert.deepEqual(removed.data.wishlist, []);
    assert.deepEqual((await request('/auth/me', { token: sellerToken })).data.user.addresses, []);
    assert.deepEqual((await request(`/auth/addresses/${addressId}`, { method: 'DELETE', token: customerToken })).data.addresses, []);
  });

  await t.test('credential changes require the current password and never expose hashes', async () => {
    assert.equal((await request('/auth/update-credentials', { method: 'PUT', token: customerToken, body: { newPassword: 'Different@123-passphrase!' } })).status, 400);
    assert.equal((await request('/auth/update-credentials', { method: 'PUT', token: customerToken, body: { currentPassword: 'wrong', newPassword: 'Different@123-passphrase!' } })).status, 401);
    const result = await request('/auth/update-credentials', { method: 'PUT', token: customerToken, body: { currentPassword: TEST_PASSWORD, newPassword: 'Different@123-passphrase!' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.passwordHash, undefined);
    const changed = await request('/auth/login', { method: 'POST', body: { email: accounts.customer, password: 'Different@123-passphrase!' } });
    assert.equal(changed.status, 200);
    customerToken = changed.data.token;
  });

  const cart = [{ productId: 'prd_test_spice', variantLabel: '250 g', quantity: 2 }, { productId: 'prd_test_lamp', quantity: 1 }];
  await t.test('multi-seller quotes use stored variant prices, district shipping and commission', async () => {
    const result = await request('/orders/quote', { method: 'POST', body: { items: cart, destinationDistrict: 'Colombo' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.sellerCount, 2);
    assert.equal(result.data.itemsSubtotalLkr, 6500);
    assert.equal(result.data.totalDeliveryFeeLkr, 700);
    assert.equal(result.data.grandTotalLkr, 7200);
    assert.equal(result.data.sellerGroups[0].commissionAmountLkr, 200);
    assert.equal(result.data.sellerGroups[1].commissionAmountLkr, 200);
  });

  await t.test('empty carts and incomplete delivery addresses cannot create orders', async () => {
    assert.equal((await request('/orders/checkout', { method: 'POST', body: { items: [], shippingAddress } })).status, 400);
    assert.equal((await request('/orders/checkout', { method: 'POST', body: { items: cart, shippingAddress: {} } })).status, 400);
    assert.equal(await app.mongo.collection('orders').countDocuments(), 0);
  });

  await t.test('checkout creates one parent and one package per seller and recalculates all client amounts', async () => {
    const result = await request('/orders/checkout', { method: 'POST', token: customerToken, body: {
      items: cart.map((item) => ({ ...item, unitPriceLkr: 1 })), shippingAddress, grandTotalLkr: 1, paymentMethod: 'COD', codConfirmedByCustomer: true
    } });
    assert.equal(result.status, 201);
    ({ order, subOrders } = result.data);
    assert.equal(order.grandTotalLkr, 7200);
    assert.equal(order.isGuestOrder, false);
    assert.equal(order.userId, 'usr_test_customer');
    assert.equal(subOrders.length, 2);
    assert.deepEqual(order.subOrderIds, subOrders.map((s) => s._id));
    assert.equal((await app.mongo.collection('products').findOne({ _id: 'prd_test_spice' })).stock, 98);
    const mine = await request('/orders/my-orders', { token: customerToken });
    assert.equal(mine.data.orders[0].orderNumber, order.orderNumber);
    assert.equal((await request('/orders/my-orders', { token: sellerToken })).data.orders.length, 0);
    const tracking = await request(`/orders/track?orderNumber=${order.orderNumber}`, { token: customerToken });
    assert.equal(tracking.data.subOrders.length, 2);
    assert.equal((await request(`/orders/track?orderNumber=${order.orderNumber}&phone=0779999999`)).status, 403);
  });

  await t.test('only the owning seller can fulfill packages and mixed shipments update the parent', async () => {
    const first = subOrders.find((s) => s.sellerId === 'sel_test_pantry');
    const second = subOrders.find((s) => s.sellerId === 'sel_test_home');
    assert.equal((await request(`/seller/suborders/${first._id}/status`, { method: 'PUT', token: otherSellerToken, body: { fulfillmentStatus: 'shipped' } })).status, 403);
    for (const fulfillmentStatus of ['packed', 'shipped']) assert.equal((await request(`/seller/suborders/${first._id}/status`, { method: 'PUT', token: sellerToken, body: { fulfillmentStatus } })).status, 200);
    const delivered = await request(`/seller/suborders/${first._id}/status`, { method: 'PUT', token: sellerToken, body: { fulfillmentStatus: 'delivered' } });
    assert.equal(delivered.status, 200);
    assert.equal(delivered.data.subOrder.settlementStatus, 'unsettled');
    assert.equal(delivered.data.subOrder.codCollectionStatus, 'pending_collection');
    assert.equal((await app.mongo.collection('orders').findOne({ _id: order._id })).overallStatus, 'partially_shipped');
    for (const fulfillmentStatus of ['packed', 'shipped']) assert.equal((await request(`/seller/suborders/${second._id}/status`, { method: 'PUT', token: otherSellerToken, body: { fulfillmentStatus } })).status, 200);
    await request(`/seller/suborders/${second._id}/status`, { method: 'PUT', token: otherSellerToken, body: { fulfillmentStatus: 'delivered' } });
    assert.equal((await app.mongo.collection('orders').findOne({ _id: order._id })).overallStatus, 'delivered');
  });

  await t.test('admin payout reconciles the owning seller and cannot settle the same packages twice', async () => {
    const sub = subOrders.find((entry) => entry.sellerId === 'sel_test_pantry');
    const receipt = await request(`/admin/suborders/${sub._id}/cash/receipt`, { method: 'POST', token: adminToken, body: { bankReference: 'TEST-RECEIPT-1', amountLkr: sub.grossTotalLkr } });
    assert.equal(receipt.status, 201);
    const result = await request('/admin/settlements/payout', { method: 'POST', token: adminToken, body: { sellerId: 'sel_test_pantry', subOrderIds: [sub._id], amountLkr: 3800, bankReference: 'TEST-PAYOUT-1' } });
    assert.equal(result.status, 201);
    assert.equal(result.data.settledCount, 1);
    assert.equal(result.data.settlement.netPayoutLkr, 3800);
    assert.equal(result.data.settlement.platformCommissionLkr, 200);
    assert.equal((await request('/admin/settlements/payout', { method: 'POST', token: adminToken, body: { sellerId: 'sel_test_pantry' } })).status, 400);
    const logs = await request('/admin/audit-logs', { token: adminToken });
    assert.ok(logs.data.auditLogs.some((entry) => entry.action === 'seller_payout' && entry.adminEmail === accounts.admin));
  });

  await t.test('seller product CRUD and bulk import retain ownership and report invalid rows', async () => {
    const created = await request('/seller/products', { method: 'POST', token: sellerToken, body: {
      title: 'New Test Product', description: 'A test description', priceLkr: 1200, stock: 10
    } });
    assert.equal(created.status, 201);
    const id = created.data.product._id;
    assert.equal(created.data.product.sellerId, 'sel_test_pantry');
    assert.equal((await request(`/seller/products/${id}/stock`, { method: 'PATCH', token: sellerToken, body: { delta: 5 } })).data.stock, 15);
    assert.equal((await request(`/seller/products/${id}`, { method: 'PUT', token: sellerToken, body: { title: 'Updated Test Product' } })).status, 200);
    assert.equal((await request(`/seller/products/${id}`, { method: 'DELETE', token: otherSellerToken })).status, 403);
    assert.equal((await request(`/seller/products/${id}`, { method: 'DELETE', token: sellerToken })).status, 200);
    const imported = await request('/seller/products/bulk-import', { method: 'POST', token: sellerToken, body: { items: [
      { title: 'Valid import', priceLkr: 300, description: 'Valid row' }, { title: 'Invalid price', priceLkr: -1 }
    ] } });
    assert.equal(imported.data.importedCount, 1);
    assert.equal(imported.data.failedCount, 1);
  });

  await t.test('moderation controls public visibility and shipping configuration affects quotes', async () => {
    assert.equal((await request('/admin/products/prd_test_pending/moderation', { method: 'PUT', token: adminToken, body: { approvalStatus: 'approved' } })).status, 200);
    const visible = await request('/marketplace/products?q=Pending');
    assert.equal(visible.data.products.length, 1);
    await request('/admin/config/shipping-mode', { method: 'PUT', token: adminToken, body: { shippingMode: 'flat', flatShippingRateLkr: 150 } });
    const quote = await request('/orders/quote', { method: 'POST', body: { items: cart, destinationDistrict: 'Jaffna' } });
    assert.equal(quote.data.totalDeliveryFeeLkr, 300);
    await request('/admin/config/general', { method: 'PUT', token: adminToken, body: { codEnabledGlobally: false } });
    assert.equal((await request('/orders/checkout', { method: 'POST', body: { items: cart, shippingAddress, paymentMethod: 'COD', codConfirmedByCustomer: true } })).status, 400);
  });

  await t.test('accepted order and settlement documents reach the actual MongoDB collections', async () => {
    const storedOrder = await app.mongo.collection('orders').findOne({ _id: order._id });
    const storedSettlement = await app.mongo.collection('settlements').findOne({ bankReference: 'TEST-PAYOUT-1' });
    assert.equal(storedOrder.grandTotalLkr, 7200);
    assert.equal(storedSettlement.netPayoutLkr, 3800);
  });
});
