import mongoose from 'mongoose';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { connectDatabase, idFilter } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { sharedRateLimit } from '../middleware/sharedRateLimit.js';

const router = createRouter();
router.use(authenticate, requireRole('admin', 'seller'));
router.use(sharedRateLimit('order-notifications', 120, 60000));
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
async function recipient(req) {
  await connectDatabase();
  if (req.user.role === 'admin') return `admin:${req.user._id}`;
  const seller = await mongoose.connection.db.collection('sellers').findOne({ userId: req.user._id }, { projection: { _id: 1 } });
  if (!seller) throw httpError(403, 'Seller profile not found.');
  return `seller:${seller._id}`;
}
router.get('/', async (req, res) => {
  const scope = await recipient(req);
  const collection = mongoose.connection.db.collection('ordernotifications');
  const filter = { recipient: scope, readAt: null };
  const [notifications, unreadCount] = await Promise.all([
    collection.find(filter, { projection: { recipient: 0 }, maxTimeMS: 3000 }).sort({ createdAt: -1, _id: -1 }).limit(20).toArray(),
    collection.countDocuments(filter, { maxTimeMS: 3000 })
  ]);
  res.json({ notifications, unreadCount });
});
router.post('/:id/read', async (req, res) => {
  if (req.params.id.length > 200) throw httpError(400, 'Invalid notification.');
  const scope = await recipient(req);
  const result = await mongoose.connection.db.collection('ordernotifications').updateOne(
    { ...idFilter(req.params.id), recipient: scope }, { $set: { readAt: new Date() } }, { maxTimeMS: 3000 });
  if (!result.matchedCount) throw httpError(404, 'Notification not found.');
  res.json({ message: 'Notification marked as read.' });
});
export default router;
