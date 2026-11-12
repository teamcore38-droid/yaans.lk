import { createRouter } from '../config/router.js';
import { getStore, persistStore, generateId, idFilter } from '../config/db.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { catalogHome, catalogSettings, catalogCategories, catalogProducts, catalogProduct, catalogSeller } from '../services/catalog.js';

const router = createRouter();

router.get('/home', async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json(await catalogHome());
});

router.get('/districts', async (_req, res) => {
  const config = await catalogSettings();
  res.json({ districts: config.districts, codEnabledGlobally: config.codEnabledGlobally,
    globalFreeShippingMinLkr: config.globalFreeShippingMinLkr,
    shippingMode: config.shippingMode || 'custom', flatShippingRateLkr: config.flatShippingRateLkr ?? 350 });
});

router.get('/categories', async (_req, res) => res.json({ categories: await catalogCategories() }));
router.get('/products', async (req, res) => res.json(await catalogProducts(req.query)));
router.get('/products/:idOrSlug', async (req, res) => res.json(await catalogProduct(req.params.idOrSlug, req.query)));

// POST /api/marketplace/products/:productId/reviews
router.post('/products/:productId/reviews', optionalAuthenticate, async (req, res) => {
  const { productId } = req.params;
  const { customerName, district = 'Colombo', rating = 5, title = '', comment } = req.body;
  if (!comment) {
    return res.status(400).json({ message: 'Please write a review comment.' });
  }

  const store = await getStore({ products: idFilter(productId), reviews: { productId } });
  const product = store.products.find((p) => p._id === productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
  const newReview = {
    _id: generateId('rev'),
    productId: product._id,
    userId: req.user ? req.user._id : null,
    customerName: (req.user ? req.user.name : customerName) || 'Verified Customer',
    district,
    rating: numericRating,
    title: title.trim(),
    comment: comment.trim(),
    verifiedPurchase: true,
    createdAt: new Date().toISOString()
  };

  store.reviews.unshift(newReview);

  // Recalculate product rating
  const prodReviews = store.reviews.filter((r) => r.productId === product._id);
  const avg = prodReviews.reduce((acc, r) => acc + r.rating, 0) / prodReviews.length;
  product.rating = Number(avg.toFixed(1));
  product.reviewCount = prodReviews.length;

  await persistStore(store);
  return res.status(201).json({
    review: newReview,
    productRating: product.rating,
    reviewCount: product.reviewCount
  });
});

router.get('/sellers/:slugOrId', async (req, res) => res.json(await catalogSeller(req.params.slugOrId, req.query)));

export default router;