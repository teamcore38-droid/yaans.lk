import mongoose from 'mongoose';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { idFilter } from '../config/db.js';
import { stringField } from '../config/inputValidation.js';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { httpError } from '../config/errors.js';

const router = createRouter();
router.use(authenticate, requireRole('staff'));
router.use(sharedRateLimit('staff-orders', 60, 60000, req => req.user._id));
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/orders', async (req, res) => {
  const before = stringField(req.query.before, 'Cursor', { maximum: 128 });
  const collection = mongoose.connection.db.collection('orders');
  let filter = {};
  if (before) {
    const cursor = await collection.findOne(idFilter(before), { projection: { _id: 1, createdAt: 1 }, maxTimeMS: 2000 });
    if (!cursor) throw httpError(404, 'Order cursor not found.');
    filter = { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }] };
  }
  const rows = await collection.find(filter, { projection: { _id: 1, orderNumber: 1, createdAt: 1, overallStatus: 1, grandTotalLkr: 1, sellerCount: 1 }, maxTimeMS: 3000 })
    .sort({ createdAt: -1, _id: -1 }).limit(26).toArray();
  res.json({ orders: rows.slice(0, 25), nextCursor: rows.length > 25 ? String(rows[24]._id) : null });
});
router.get('/orders/:id', async (req, res) => {
  stringField(req.params.id, 'Order ID', { required: true, maximum: 128 });
  const db = mongoose.connection.db;
  const order = await db.collection('orders').findOne(idFilter(req.params.id), { projection: {
    _id: 1, orderNumber: 1, createdAt: 1, overallStatus: 1, grandTotalLkr: 1, shippingAddress: 1, paymentMethod: 1
  }, maxTimeMS: 3000 });
  if (!order) throw httpError(404, 'Order not found.');
  const packages = await db.collection('suborders').find({ parentOrderId: String(order._id) }, { projection: {
    _id: 1, subOrderNumber: 1, sellerName: 1, items: 1, fulfillmentStatus: 1, courierPartner: 1, trackingCode: 1
  }, maxTimeMS: 3000 }).limit(50).toArray();
  // Whitelist item fields too; future finance additions must not expand staff access.
  order.packages = packages.map(sub => ({ ...sub, items: sub.items.map(({ title, quantity, variantLabel }) => ({ title, quantity, variantLabel })) }));
  await recordSecurityEvent('staff_order_view', { userId: req.user._id, role: 'staff', ip: req.ip });
  res.json({ order });
});
export default router;
