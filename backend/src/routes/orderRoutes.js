import { createRouter } from '../config/router.js';
import { getStore, idFilter } from '../config/db.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { normalizeCartItems, buildMultiSellerCartBreakdown } from '../services/cart.js';
import { loadCartStore, checkout, checkoutResult, customerAction, assertOrderAccess, customerOrder, customerPackage } from '../services/orders.js';
import { httpError } from '../config/errors.js';

const router = createRouter();
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

router.post('/quote', async (req, res) => {
  const items = normalizeCartItems(req.body.items || []);
  const store = await loadCartStore(items);
  return res.json(buildMultiSellerCartBreakdown(items, req.body.destinationDistrict || 'Colombo', store));
});

router.post('/checkout', optionalAuthenticate, async (req, res) => {
  const result = await checkout(req.body, req.user, req.headers['idempotency-key']);
  return res.status(result.replayed ? 200 : 201).json(result);
});

router.post('/checkout-result', optionalAuthenticate, async (req, res) => {
  return res.json(await checkoutResult(req.user, req.headers['idempotency-key']));
});

router.get('/my-orders', authenticate, async (req, res) => {
  const store = await getStore({ orders: { userId: req.user._id } });
  const ids = store.orders.map((order) => order._id);
  const packages = await getStore({ subOrders: { parentOrderId: { $in: ids } } });
  return res.json({ orders: store.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((order) => ({ ...customerOrder(order), subOrders: packages.subOrders.filter((sub) => sub.parentOrderId === order._id).map(customerPackage) })) });
});

router.get('/track', optionalAuthenticate, async (req, res) => {
  const number = req.query.orderNumber;
  if (typeof number !== 'string' || !number.trim() || number.length > 100) throw httpError(400, 'Please enter your order number.');
  const store = await getStore({ orders: { $or: [idFilter(number.trim()), { orderNumber: number.trim().toUpperCase() }] } });
  const order = store.orders[0];
  if (!order) throw httpError(404, 'Order not found.');
  assertOrderAccess(order, req.user, req.headers['x-order-access-token']);
  const packages = await getStore({ subOrders: { parentOrderId: order._id } });
  return res.json({ order: customerOrder(order), subOrders: packages.subOrders.map(customerPackage) });
});

router.post('/suborders/:subOrderId/customer-action', optionalAuthenticate, async (req, res) => {
  const result = await customerAction(req.params.subOrderId, req.body, req.user, req.headers['x-order-access-token']);
  return res.json(result);
});

export default router;
