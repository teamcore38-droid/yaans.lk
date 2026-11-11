import express from 'express';
import { getStore, persistStore, generateId } from '../config/db.js';
import { calculateSellerDeliveryFee } from '../config/sriLankaDistricts.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/marketplace/home
// Returns categories (with 2x2 quad cards), active banners, homemade showcase, daily deals, featured products, and districts
router.get('/home', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const store = getStore();
  const approvedSellerIds = new Set(
    store.sellers.filter((s) => s.status === 'approved').map((s) => s._id)
  );
  const liveProducts = store.products.filter(
    (p) => p.approvalStatus === 'approved' && approvedSellerIds.has(p.sellerId)
  );

  const categories = [...store.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  const banners = [...(store.platformConfig?.banners || [])]
    .map((b, idx) => ({
      ...b,
      id: b.id || (b._id ? String(b._id) : `bnr_${idx + 1}`),
      imageUrl: b.imageUrl || b.mobileImageUrl || '',
      mobileImageUrl: b.mobileImageUrl || b.imageUrl || ''
    }))
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const homemadeProducts = liveProducts.filter((p) => p.isHomemade).slice(0, 8);
  const dealProducts = liveProducts
    .filter((p) => p.isDeal || (p.compareAtPriceLkr && p.compareAtPriceLkr > p.priceLkr))
    .slice(0, 8);
  const featuredProducts = liveProducts.filter((p) => p.isFeatured).slice(0, 8);
  const recommendedProducts = [...liveProducts]
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 10);

  const verifiedSellers = store.sellers
    .filter((s) => s.status === 'approved')
    .map((s) => ({
      _id: s._id,
      storeName: s.storeName,
      slug: s.slug,
      sellerType: s.sellerType,
      isHomemadeVendor: s.isHomemadeVendor,
      district: s.district,
      city: s.city,
      logoUrl: s.logoUrl,
      rating: s.rating,
      reviewCount: s.reviewCount
    }));

  return res.json({
    categories,
    banners,
    homemadeProducts,
    dealProducts,
    featuredProducts,
    recommendedProducts,
    verifiedSellers,
    districts: store.platformConfig.districts,
    codEnabledGlobally: store.platformConfig.codEnabledGlobally,
    shippingMode: store.platformConfig.shippingMode || 'custom',
    flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350
  });
});

// GET /api/marketplace/districts
router.get('/districts', (_req, res) => {
  const store = getStore();
  return res.json({
    districts: store.platformConfig.districts,
    codEnabledGlobally: store.platformConfig.codEnabledGlobally,
    globalFreeShippingMinLkr: store.platformConfig.globalFreeShippingMinLkr,
    shippingMode: store.platformConfig.shippingMode || 'custom',
    flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350
  });
});

// GET /api/marketplace/categories
router.get('/categories', (_req, res) => {
  const store = getStore();
  const categories = [...store.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  return res.json({ categories });
});

// GET /api/marketplace/products
// Supports search, category, subcategory, sellerId, district, homemade, deals, minPrice, maxPrice, inStock, sort, page, limit
router.get('/products', (req, res) => {
  const store = getStore();
  const {
    q = '',
    category = '',
    subCategory = '',
    sellerId = '',
    district = '',
    homemade = '',
    deals = '',
    minPrice = '',
    maxPrice = '',
    inStock = '',
    sort = 'popular',
    page = '1',
    limit = '12'
  } = req.query;

  const approvedSellerIds = new Set(
    store.sellers.filter((s) => s.status === 'approved').map((s) => s._id)
  );

  let results = store.products.filter(
    (p) => p.approvalStatus === 'approved' && approvedSellerIds.has(p.sellerId)
  );

  if (q && String(q).trim()) {
    const query = String(q).toLowerCase().trim();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.sellerName.toLowerCase().includes(query) ||
        p.sellerDistrict.toLowerCase().includes(query) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(query))
    );
  }

  if (category) {
    results = results.filter((p) => p.categorySlug === category);
  }

  if (subCategory) {
    results = results.filter((p) => p.subCategorySlug === subCategory);
  }

  if (sellerId) {
    results = results.filter((p) => p.sellerId === sellerId || p.sellerSlug === sellerId);
  }

  if (district) {
    results = results.filter(
      (p) => p.sellerDistrict.toLowerCase() === String(district).toLowerCase()
    );
  }

  if (homemade === 'true') {
    results = results.filter((p) => p.isHomemade === true);
  }

  if (deals === 'true') {
    results = results.filter(
      (p) => p.isDeal === true || (p.compareAtPriceLkr && p.compareAtPriceLkr > p.priceLkr)
    );
  }

  if (minPrice !== '' && !Number.isNaN(Number(minPrice))) {
    results = results.filter((p) => p.priceLkr >= Number(minPrice));
  }

  if (maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
    results = results.filter((p) => p.priceLkr <= Number(maxPrice));
  }

  if (inStock === 'true') {
    results = results.filter((p) => p.stock > 0);
  }

  // Sorting
  if (sort === 'price_asc') {
    results.sort((a, b) => a.priceLkr - b.priceLkr);
  } else if (sort === 'price_desc') {
    results.sort((a, b) => b.priceLkr - a.priceLkr);
  } else if (sort === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'newest') {
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    // popular
    results.sort((a, b) => b.soldCount - a.soldCount);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(48, Math.max(1, parseInt(limit, 10) || 12));
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / limitNum));
  const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  return res.json({
    products: paginated,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  });
});

// GET /api/marketplace/products/:idOrSlug
router.get('/products/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const { destinationDistrict = 'Colombo' } = req.query;
  const store = getStore();

  const product = store.products.find(
    (p) => p._id === idOrSlug || p.slug === idOrSlug
  );
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const seller = store.sellers.find((s) => s._id === product.sellerId);
  const reviews = store.reviews
    .filter((r) => r.productId === product._id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const relatedProducts = store.products
    .filter(
      (p) =>
        p._id !== product._id &&
        p.approvalStatus === 'approved' &&
        (p.categorySlug === product.categorySlug || p.sellerId === product.sellerId)
    )
    .slice(0, 6);

  const shippingEstimate = calculateSellerDeliveryFee({
    sellerDistrict: seller ? seller.district : product.sellerDistrict,
    destinationDistrict,
    sellerSubtotalLkr: product.priceLkr,
    totalItemCount: 1,
    sellerShippingPolicy: seller ? seller.shippingPolicy : {},
    districtConfigs: store.platformConfig.districts,
    globalFreeShippingMinLkr: store.platformConfig.globalFreeShippingMinLkr,
    shippingMode: store.platformConfig.shippingMode || 'custom',
    flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350
  });

  return res.json({
    product,
    seller: seller
      ? {
          _id: seller._id,
          storeName: seller.storeName,
          slug: seller.slug,
          sellerType: seller.sellerType,
          isHomemadeVendor: seller.isHomemadeVendor,
          description: seller.description,
          logoUrl: seller.logoUrl,
          district: seller.district,
          city: seller.city,
          rating: seller.rating,
          reviewCount: seller.reviewCount,
          shippingPolicy: seller.shippingPolicy,
          isVacationMode: Boolean(seller.isVacationMode),
          vacationNotice: seller.vacationNotice || ''
        }
      : null,
    reviews,
    relatedProducts,
    shippingEstimate
  });
});

// POST /api/marketplace/products/:productId/reviews
router.post('/products/:productId/reviews', optionalAuthenticate, (req, res) => {
  const { productId } = req.params;
  const { customerName, district = 'Colombo', rating = 5, title = '', comment } = req.body;
  if (!comment) {
    return res.status(400).json({ message: 'Please write a review comment.' });
  }

  const store = getStore();
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

  persistStore();
  return res.status(201).json({
    review: newReview,
    productRating: product.rating,
    reviewCount: product.reviewCount
  });
});

// GET /api/marketplace/sellers/:slugOrId
router.get('/sellers/:slugOrId', (req, res) => {
  const { slugOrId } = req.params;
  const store = getStore();
  const seller = store.sellers.find(
    (s) => s._id === slugOrId || s.slug === slugOrId
  );

  if (!seller || seller.status !== 'approved') {
    return res.status(404).json({ message: 'Seller storefront not found.' });
  }

  const sellerProducts = store.products.filter(
    (p) => p.sellerId === seller._id && p.approvalStatus === 'approved'
  );

  return res.json({
    seller: {
      _id: seller._id,
      storeName: seller.storeName,
      slug: seller.slug,
      sellerType: seller.sellerType,
      isHomemadeVendor: seller.isHomemadeVendor,
      description: seller.description,
      logoUrl: seller.logoUrl,
      bannerUrl: seller.bannerUrl,
      district: seller.district,
      city: seller.city,
      rating: seller.rating,
      reviewCount: seller.reviewCount,
      totalSalesCount: seller.totalSalesCount,
      shippingPolicy: seller.shippingPolicy,
      isVacationMode: Boolean(seller.isVacationMode),
      vacationNotice: seller.vacationNotice || '',
      createdAt: seller.createdAt
    },
    products: sellerProducts
  });
});

export default router;
