import { createHash, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { getStore, loadCollections, persistStore, withTransaction, idFilter, generateId, connectDatabase, MODEL_MAP } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { normalizeCartItems, buildMultiSellerCartBreakdown, findVariant } from './cart.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const empty = { _id: { $in: [] } };
const matchingIds = (ids) => ids.length ? { $or: [...new Set(ids)].map(idFilter) } : empty;

export async function loadCartStore(items, session) {
  const store = await getStore({ products: matchingIds(items.map((item) => item.productId)), platformConfig: true }, { session });
  await loadCollections(store, { sellers: matchingIds(store.products.map((product) => product.sellerId)) });
  return store;
}

function validateAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) throw httpError(400, 'A delivery address is required.');
  const clean = {};
  for (const [key, maximum] of Object.entries({ recipientName: 120, phone: 32, addressLine1: 256, addressLine2: 256,
    city: 120, district: 80, postalCode: 20, deliveryNotes: 500 })) {
    if (address[key] !== undefined && typeof address[key] !== 'string') throw httpError(400, 'Invalid delivery address.');
    clean[key] = (address[key] || '').trim();
    if (clean[key].length > maximum) throw httpError(400, 'A delivery address field is too long.');
  }
  if (!clean.recipientName || !clean.phone || !clean.addressLine1 || !clean.city || !clean.district) {
    throw httpError(400, 'Please complete the recipient, phone, address, city and district.');
  }
  if (!/^(?:0|\+?94)7\d{8}$/.test(clean.phone.replace(/[\s()-]/g, ''))) throw httpError(400, 'Please enter a valid Sri Lankan mobile number.');
  return clean;
}

export function customerOrder(order) {
  const { guestAccessTokenHash, _writeVersion, ...view } = order;
  return view;
}

export function customerPackage(subOrder) {
  const { _writeVersion, commissionRatePercent, commissionAmountLkr, netSellerEarningsLkr,
    settlementId, inventoryReleasedAt, inventoryReservedAt, paymentReceipt, sellerRecovery, refund, returnInspection, ...view } = subOrder;
  return { ...view, ...(refund ? { refund: { amountLkr: refund.amountLkr, confirmedAt: refund.confirmedAt } } : {}) };
}

function guestToken(key) {
  // The random checkout UUID is a secret capability. Domain separation avoids
  // storing either the checkout key or tracking token in the database.
  return createHash('sha256').update(`yaans-guest-tracking-v1:${key}`).digest('base64url');
}

function requireCheckoutKey(key) {
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw httpError(400, 'A valid checkout retry key is required. Refresh checkout and try again.');
  }
}

async function savedCheckout(record, key, session) {
  const order = await MODEL_MAP.orders.collection.findOne({ _id: record.orderId }, { session });
  if (!order) throw httpError(503, 'The saved checkout could not be retrieved.');
  if (order.isGuestOrder && (new Date(order.guestAccessExpiresAt).getTime() <= Date.now() ||
      hash(guestToken(key)) !== order.guestAccessTokenHash)) throw httpError(403, 'The guest access for this checkout has expired or was revoked.');
  const subOrders = await MODEL_MAP.subOrders.collection.find({ parentOrderId: order._id }, { session }).toArray();
  return { order: customerOrder(order), subOrders: subOrders.map(customerPackage),
    ...(order.isGuestOrder ? { guestAccessToken: guestToken(key) } : {}), replayed: true };
}

export async function checkoutResult(user, key) {
  requireCheckoutKey(key);
  await connectDatabase();
  const scope = user ? `user:${user._id}` : 'guest';
  const record = await mongoose.connection.db.collection('checkoutrequests').findOne({ _id: hash(`yaans-checkout-v1:${key}`) });
  if (!record) throw httpError(404, 'No completed checkout was found for this retry key.');
  if (record.scope !== scope && record.scope !== 'guest') throw httpError(403, 'Sign in to the account that started this checkout.');
  return savedCheckout(record, key);
}

export function assertOrderAccess(order, user, token) {
  if (user && String(order.userId) === user._id) return;
  if (order.isGuestOrder && typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) &&
      typeof order.guestAccessTokenHash === 'string' && new Date(order.guestAccessExpiresAt).getTime() > Date.now()) {
    const actual = Buffer.from(hash(token), 'hex');
    const expected = Buffer.from(order.guestAccessTokenHash, 'hex');
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return;
  }
  throw httpError(403, 'Sign in to the account that placed this order or provide its guest access code.');
}

async function ensureOrderCounter(year) {
  const db = mongoose.connection.db;
  const id = `order:${year}`;
  if (await db.collection('counters').findOne({ _id: id })) return;
  const [latest] = await db.collection('orders').aggregate([
    { $match: { orderNumber: { $regex: `^YLK-${year}-[0-9]+$` } } },
    { $project: { sequence: { $convert: { input: { $arrayElemAt: [{ $split: ['$orderNumber', '-'] }, -1] }, to: 'long', onError: 1000, onNull: 1000 } } } },
    { $group: { _id: null, maximum: { $max: '$sequence' } } }
  ]).toArray();
  try { await db.collection('counters').updateOne({ _id: id }, { $setOnInsert: { sequence: Math.max(1000, Number(latest?.maximum || 0)) } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
}

export async function checkout(body, user, key) {
  requireCheckoutKey(key);
  const items = normalizeCartItems(body.items);
  if (!items.length) throw httpError(400, 'Your shopping cart is empty.');
  const shippingAddress = validateAddress(body.shippingAddress);
  if (body.paymentMethod !== 'COD' || body.codConfirmedByCustomer !== true) {
    throw httpError(400, 'Cash on Delivery and your explicit COD agreement are required.');
  }
  if (body.customerEmail !== undefined && (typeof body.customerEmail !== 'string' || body.customerEmail.length > 254)) {
    throw httpError(400, 'Invalid customer email.');
  }
  const customerEmail = (body.customerEmail || user?.email || 'guest@yaans.lk').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw httpError(400, 'Please enter a valid email address.');
  const scope = user ? `user:${user._id}` : 'guest';
  const requestId = hash(`yaans-checkout-v1:${key}`);
  const fingerprint = hash(JSON.stringify({ items, shippingAddress, customerEmail, paymentMethod: 'COD' }));
  await connectDatabase();
  const year = new Date().getUTCFullYear();
  await ensureOrderCounter(year);
  const requests = mongoose.connection.db.collection('checkoutrequests');
  const replay = async (record, session) => {
    if (record.scope !== scope && record.scope !== 'guest') throw httpError(403, 'Sign in to the account that started this checkout.');
    if (record.fingerprint !== fingerprint) throw httpError(409, 'Your earlier checkout has already completed. Review that order before placing another.', 'IDEMPOTENCY_CONFLICT');
    return savedCheckout(record, key, session);
  };
  try {
    return await withTransaction(async (session) => {
      const existing = await requests.findOne({ _id: requestId }, { session });
      if (existing) return replay(existing, session);
      const store = await loadCartStore(items, session);
      const breakdown = buildMultiSellerCartBreakdown(items, shippingAddress.district, store);
      if (!breakdown.codAvailable) throw httpError(400, 'Cash on Delivery is unavailable for this cart or district.');
      await loadCollections(store, { orders: empty, subOrders: empty });
      const now = new Date().toISOString();
      const parentOrderId = generateId('ord');
      await requests.insertOne({ _id: requestId, scope, fingerprint, orderId: parentOrderId, createdAt: new Date() }, { session });
      const counter = await mongoose.connection.db.collection('counters').findOneAndUpdate(
        { _id: `order:${year}` }, { $inc: { sequence: 1 } }, { session, returnDocument: 'after' });
      const orderNumber = `YLK-${year}-${counter.sequence}`;
      const subOrders = breakdown.sellerGroups.map((group, index) => {
        for (const line of group.items) {
          const product = store.products.find((p) => p._id === line.productId);
          product.stock -= line.quantity;
          product.soldCount = (product.soldCount || 0) + line.quantity;
          const variant = findVariant(product, line.variantLabel);
          if (variant) variant.option.stock -= line.quantity;
          const seller = store.sellers.find((s) => s._id === group.sellerId);
          seller.totalSalesCount = (seller.totalSalesCount || 0) + line.quantity;
        }
        return { _id: generateId('sub'), subOrderNumber: `${orderNumber}-S${index + 1}`,
          parentOrderId, parentOrderNumber: orderNumber, sellerId: group.sellerId, sellerName: group.sellerName,
          sellerDistrict: group.sellerDistrict, customerName: shippingAddress.recipientName, customerPhone: shippingAddress.phone,
          shippingAddress, items: group.items, itemsSubtotalLkr: group.itemsSubtotalLkr, deliveryFeeLkr: group.deliveryFeeLkr,
          grossTotalLkr: group.grossTotalLkr, commissionRatePercent: group.commissionRatePercent,
          commissionAmountLkr: group.commissionAmountLkr, netSellerEarningsLkr: group.netSellerEarningsLkr,
          paymentMethod: 'COD', codCollectionStatus: 'pending_collection', fulfillmentStatus: 'confirmed',
          trackingCode: '', courierPartner: 'Awaiting courier assignment', settlementStatus: 'unsettled', settlementId: null,
          inventoryReservedAt: now, statusHistory: [{ status: 'confirmed', note: 'Order confirmed; inventory reserved.', timestamp: now }], createdAt: now };
      });
      const token = user ? null : guestToken(key);
      const order = { _id: parentOrderId, orderNumber, userId: user?._id || null, isGuestOrder: !user,
        ...(token ? { guestAccessTokenHash: hash(token), guestAccessExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString() } : {}), customerEmail, customerPhone: shippingAddress.phone,
        shippingAddress, items: breakdown.sellerGroups.flatMap((group) => group.items), subOrderIds: subOrders.map((s) => s._id),
        sellerCount: subOrders.length, itemsSubtotalLkr: breakdown.itemsSubtotalLkr, totalDeliveryFeeLkr: breakdown.totalDeliveryFeeLkr,
        grandTotalLkr: breakdown.grandTotalLkr, paymentMethod: 'COD', codConfirmedByCustomer: true, overallStatus: 'processing', createdAt: now };
      store.orders.push(order);
      store.subOrders.push(...subOrders);
      await persistStore(store);
      return { order: customerOrder(order), subOrders: subOrders.map(customerPackage),
        ...(token ? { guestAccessToken: token } : {}), replayed: false, message: `Order ${orderNumber} placed successfully!` };
    });
  } catch (error) {
    // A concurrent identical request may win the unique key before this snapshot.
    if (error.code === 11000) {
      const existing = await requests.findOne({ _id: requestId });
      if (existing) return replay(existing);
    }
    throw error;
  }
}

export function releaseInventory(store, target) {
  if (target.inventoryReleasedAt) throw httpError(409, 'This package inventory has already been released.');
  for (const item of target.items) {
    const product = store.products.find((p) => p._id === item.productId);
    if (!product) throw httpError(409, 'Inventory requires review before this cancellation can complete.');
    product.stock += item.quantity;
    product.soldCount = Math.max(0, (product.soldCount || 0) - item.quantity);
    const variant = findVariant(product, item.variantLabel || 'Standard');
    if (variant) variant.option.stock += item.quantity;
  }
  const seller = store.sellers.find((item) => item._id === target.sellerId);
  if (seller) seller.totalSalesCount = Math.max(0, (seller.totalSalesCount || 0) - target.items.reduce((sum, item) => sum + item.quantity, 0));
  target.inventoryReleasedAt = new Date().toISOString();
}

export async function customerAction(subOrderId, body, user, token) {
  if (!['cancel', 'request_return'].includes(body.action) || (body.reason !== undefined &&
      (typeof body.reason !== 'string' || body.reason.length > 500))) throw httpError(400, 'Invalid order action or reason.');
  return withTransaction(async (session) => {
    const sub = await MODEL_MAP.subOrders.collection.findOne({ $or: [idFilter(subOrderId), { subOrderNumber: subOrderId }] }, { session });
    if (!sub) throw httpError(404, 'Order package not found.');
    const store = await getStore({ orders: idFilter(sub.parentOrderId), subOrders: { parentOrderId: sub.parentOrderId } }, { session });
    const order = store.orders[0];
    if (!order) throw httpError(404, 'Order not found.');
    assertOrderAccess(order, user, token);
    const target = store.subOrders.find((item) => item._id === String(sub._id));
    if (body.action === 'cancel') {
      if (target.fulfillmentStatus === 'cancelled') return { subOrder: customerPackage(target), message: 'Package already cancelled.' };
      if (!['pending_confirmation', 'confirmed', 'packed'].includes(target.fulfillmentStatus)) throw httpError(409, 'This package can no longer be cancelled.');
      await loadCollections(store, { products: matchingIds(target.items.map((item) => item.productId)), sellers: idFilter(target.sellerId) });
      releaseInventory(store, target);
      target.fulfillmentStatus = 'cancelled'; target.codCollectionStatus = 'not_applicable'; target.settlementStatus = 'voided';
    } else {
      if (target.fulfillmentStatus === 'return_requested') return { subOrder: customerPackage(target), message: 'Return already requested.' };
      if (target.fulfillmentStatus !== 'delivered') throw httpError(409, 'Only delivered packages can be returned.');
      target.fulfillmentStatus = 'return_requested';
      target.payoutHoldReason = 'return_requested';
      if (!target.settlementId) target.settlementStatus = 'held_for_return';
    }
    target.statusHistory.push({ status: target.fulfillmentStatus, note: body.reason || 'Customer requested this action.', timestamp: new Date().toISOString() });
    if (store.subOrders.every((item) => item.fulfillmentStatus === 'cancelled')) order.overallStatus = 'cancelled';
    else if (store.subOrders.some((item) => ['returned', 'return_requested'].includes(item.fulfillmentStatus))) order.overallStatus = 'returned';
    await persistStore(store);
    return { subOrder: customerPackage(target), message: 'Package status updated.' };
  });
}
