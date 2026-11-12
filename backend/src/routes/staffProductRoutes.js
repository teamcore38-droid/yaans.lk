import mongoose from 'mongoose';
import { createRouter } from '../config/router.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getStore, persistStore, idFilter, withTransaction } from '../config/db.js';
import { stringField } from '../config/inputValidation.js';
import { httpError } from '../config/errors.js';
import { sharedRateLimit, uploadLimit } from '../middleware/sharedRateLimit.js';
import { uploadMiddleware, handleProductImageUpload } from '../config/cloudinary.js';
import { productRevision, productChanges, staffProduct } from '../services/staffProducts.js';
const router = createRouter();
router.use(authenticate, requireRole('staff'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (req.user.canEditProducts !== true) return next(httpError(403, 'Product editing permission required.'));
  next();
});
router.use(sharedRateLimit('staff-products', 60, 60000, req => req.user._id));
router.get('/', async (req, res) => {
  const before = stringField(req.query.before, 'Cursor', { maximum: 128 });
  const collection = mongoose.connection.db.collection('products');
  let filter = {};
  if (before) {
    const cursor = await collection.findOne(idFilter(before), { projection: { _id: 1 }, maxTimeMS: 2000 });
    if (!cursor) throw httpError(404, 'Product cursor not found.');
    filter = typeof cursor._id === 'string'
      ? { $or: [{ _id: { $gt: cursor._id } }, { _id: { $type: 'objectId' } }] }
      : { _id: { $gt: cursor._id } };
  }
  const products = await collection.find(filter, { projection: { _id: 1, title: 1, sellerName: 1, sku: 1, priceLkr: 1, stock: 1 }, maxTimeMS: 3000 }).sort({ _id: 1 }).limit(26).toArray();
  res.json({ products: products.slice(0,25), nextCursor: products.length > 25 ? String(products[24]._id) : null });
});
router.post('/upload-image', uploadLimit, uploadMiddleware.single('image'), async (req, res) => res.json(await handleProductImageUpload(req)));
router.get('/:id', async (req, res) => {
  stringField(req.params.id, 'Product ID', { maximum: 128, required: true });
  const product = await mongoose.connection.db.collection('products').findOne(idFilter(req.params.id), { maxTimeMS: 3000 });
  if (!product) throw httpError(404, 'Product not found.');
  const categories = await mongoose.connection.db.collection('categories').find({}, { projection: { slug: 1, name: 1, subCategories: 1 }, maxTimeMS: 3000 }).limit(100).toArray();
  res.json({ product: staffProduct(product), categories });
});
router.put('/:id', async (req, res) => {
  stringField(req.params.id, 'Product ID', { maximum: 128, required: true });
  await withTransaction(async session => {
    const user = await mongoose.connection.db.collection('users').findOne(idFilter(req.user._id), { session });
    if (!user || user.role !== 'staff' || !user.isActive || user.canEditProducts !== true || user.tokenVersion !== req.user.tokenVersion) throw httpError(403, 'Staff permission changed. Sign in again.');
    const raw = await mongoose.connection.db.collection('products').findOne(idFilter(req.params.id), { session });
    if (!raw) throw httpError(404, 'Product not found.');
    if (req.body.revision !== productRevision(raw)) throw httpError(409, 'Product or inventory changed. Reload before saving.', 'WRITE_CONFLICT');
    const store = await getStore({ products: idFilter(req.params.id), categories: true }, { session });
    const patch = productChanges(req.body, store.categories);
    const product = store.products[0];
    if (patch.variants) {
      const labels = patch.variants.flatMap(group => group.values.map(option => option.label));
      const previousLabels = product.variants?.length ? product.variants.flatMap(group => group.values.map(option => option.label)) : ['Standard'];
      const nextLabels = patch.variants.length ? labels : ['Standard'];
      const removed = previousLabels.filter(label => !nextLabels.includes(label));
      if (removed.length && await mongoose.connection.db.collection('suborders').findOne({
        items: { $elemMatch: { productId: product._id, variantLabel: { $in: removed } } },
        fulfillmentStatus: { $nin: ['cancelled','returned'] }
      }, { session, projection: { _id: 1 }, maxTimeMS: 3000 })) throw httpError(409, 'An existing order uses a variant you removed or renamed. Keep that option to preserve returns and inventory.');
    }

    Object.assign(product, patch, { lastEditedBy: 'staff', lastEditedById: req.user._id, lastEditedAt: new Date().toISOString() });
    await persistStore(store);
    await mongoose.connection.db.collection('securityevents').insertOne({ event: 'STAFF_PRODUCT_EDITED', userId: req.user._id,
      metadata: { productId: product._id, fields: Object.keys(patch) }, outcome: 'success', createdAt: new Date(), expiresAt: new Date(Date.now()+30*86400000) }, { session });
  });
  res.json({ message: 'Product updated. Reload to edit it again.' });
});
export default router;
