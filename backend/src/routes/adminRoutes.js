import express from 'express';
import { getStore, persistStore, generateId } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadMiddleware, uploadToCloudinary } from '../config/cloudinary.js';

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/admin/overview
router.get('/overview', (_req, res) => {
  const store = getStore();

  const activeSubOrders = store.subOrders.filter(
    (s) => !['cancelled', 'returned'].includes(s.fulfillmentStatus)
  );
  const totalGmvLkr = store.orders
    .filter((o) => o.overallStatus !== 'cancelled')
    .reduce((sum, o) => sum + o.grandTotalLkr, 0);
  const totalItemsRevenueLkr = activeSubOrders.reduce((sum, s) => sum + s.itemsSubtotalLkr, 0);
  const totalCommissionEarnedLkr = activeSubOrders.reduce((sum, s) => sum + s.commissionAmountLkr, 0);
  const unsettledPayoutLiabilityLkr = store.subOrders
    .filter((s) => s.settlementStatus === 'eligible_for_payout')
    .reduce((sum, s) => sum + s.netSellerEarningsLkr, 0);
  const totalSettledPayoutsLkr = store.settlements.reduce((sum, st) => sum + st.netPayoutLkr, 0);

  return res.json({
    metrics: {
      totalGmvLkr,
      totalItemsRevenueLkr,
      totalCommissionEarnedLkr,
      unsettledPayoutLiabilityLkr,
      totalSettledPayoutsLkr,
      totalOrders: store.orders.length,
      totalSubOrders: store.subOrders.length,
      totalSellers: store.sellers.length,
      pendingSellersCount: store.sellers.filter((s) => s.status === 'pending').length,
      approvedSellersCount: store.sellers.filter((s) => s.status === 'approved').length,
      totalProducts: store.products.length,
      pendingProductsCount: store.products.filter((p) => p.approvalStatus === 'pending').length,
      totalCustomers: store.users.filter((u) => u.role === 'customer').length
    },
    sellers: store.sellers,
    products: store.products,
    orders: store.orders,
    subOrders: store.subOrders,
    settlements: store.settlements,
    categories: store.categories,
    platformConfig: store.platformConfig,
    users: store.users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      defaultDistrict: u.defaultDistrict,
      isActive: u.isActive,
      createdAt: u.createdAt
    }))
  });
});

// PUT /api/admin/sellers/:sellerId/status
router.put('/sellers/:sellerId/status', (req, res) => {
  const { sellerId } = req.params;
  const { status, rejectionReason = '', commissionRateOverride } = req.body;
  const store = getStore();

  const seller = store.sellers.find((s) => s._id === sellerId);
  if (!seller) {
    return res.status(404).json({ message: 'Seller not found.' });
  }

  if (status) {
    seller.status = status;
    seller.rejectionReason = status === 'rejected' ? rejectionReason : '';
  }

  if (commissionRateOverride !== undefined) {
    seller.commissionRateOverride =
      commissionRateOverride === '' || commissionRateOverride === null
        ? null
        : Number(commissionRateOverride);
  }

  persistStore();
  return res.json({
    seller,
    message: `Seller "${seller.storeName}" updated (${seller.status}).`
  });
});

// PUT /api/admin/products/:productId/moderation
router.put('/products/:productId/moderation', (req, res) => {
  const { productId } = req.params;
  const { approvalStatus, isFeatured, isDeal } = req.body;
  const store = getStore();

  const product = store.products.find((p) => p._id === productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  if (approvalStatus) product.approvalStatus = approvalStatus;
  if (isFeatured !== undefined) product.isFeatured = Boolean(isFeatured);
  if (isDeal !== undefined) product.isDeal = Boolean(isDeal);

  persistStore();
  return res.json({
    product,
    message: `Product "${product.title}" updated.`
  });
});

// PUT /api/admin/products/:productId (Full Admin Product Edit Override)
router.put('/products/:productId', (req, res) => {
  const { productId } = req.params;
  const store = getStore();

  const product = store.products.find((p) => p._id === productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const {
    title,
    sku,
    categorySlug,
    subCategorySlug,
    description,
    highlights,
    priceLkr,
    compareAtPriceLkr,
    stock,
    images,
    variants,
    isHomemade,
    isFeatured,
    isDeal,
    codEligible,
    approvalStatus,
    adminNote,
    tags
  } = req.body;

  if (title !== undefined) product.title = title.trim();
  if (sku !== undefined) product.sku = sku.trim();
  if (categorySlug !== undefined) product.categorySlug = categorySlug;
  if (subCategorySlug !== undefined) product.subCategorySlug = subCategorySlug;
  if (description !== undefined) product.description = description.trim();
  if (highlights !== undefined) {
    product.highlights = Array.isArray(highlights)
      ? highlights
      : String(highlights)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
  }
  if (priceLkr !== undefined) product.priceLkr = Math.max(0, Number(priceLkr));
  if (compareAtPriceLkr !== undefined) {
    product.compareAtPriceLkr =
      compareAtPriceLkr === '' || compareAtPriceLkr === null ? null : Number(compareAtPriceLkr);
  }
  if (stock !== undefined) product.stock = Math.max(0, Number(stock));
  if (images !== undefined && Array.isArray(images) && images.length > 0) {
    product.images = images;
  }
  if (variants !== undefined && Array.isArray(variants)) {
    product.variants = variants;
  }
  if (isHomemade !== undefined) product.isHomemade = Boolean(isHomemade);
  if (isFeatured !== undefined) product.isFeatured = Boolean(isFeatured);
  if (isDeal !== undefined) product.isDeal = Boolean(isDeal);
  if (codEligible !== undefined) product.codEligible = Boolean(codEligible);
  if (approvalStatus !== undefined) product.approvalStatus = approvalStatus;
  if (adminNote !== undefined) product.adminNote = adminNote.trim();
  if (tags !== undefined) {
    product.tags = Array.isArray(tags)
      ? tags
      : String(tags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
  }

  // Audit trail
  product.lastEditedBy = 'admin';
  product.lastEditedAt = new Date().toISOString();

  persistStore();
  return res.json({
    product,
    message: `Product "${product.title}" updated by Marketplace Admin.`
  });
});

// DELETE /api/admin/products/:productId (Admin Delist/Delete Product)
router.delete('/products/:productId', (req, res) => {
  const { productId } = req.params;
  const store = getStore();

  const idx = store.products.findIndex((p) => p._id === productId);
  if (idx === -1) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const removed = store.products.splice(idx, 1)[0];
  persistStore();
  return res.json({
    message: `Product "${removed.title}" removed from Yaans.lk marketplace by Admin.`,
    productId
  });
});

// PUT /api/admin/config/districts
// Updates 25-district matrix as well as active shipping strategy (flat vs custom)
router.put('/config/districts', (req, res) => {
  const { districts, shippingMode, flatShippingRateLkr } = req.body;
  const store = getStore();

  if (Array.isArray(districts)) {
    store.platformConfig.districts = districts.map((d) => ({
      code: d.code,
      name: d.name,
      province: d.province,
      intraDistrictFee: Number(d.intraDistrictFee) || 280,
      standardFee: Number(d.standardFee) || 350,
      outstationFee: Number(d.outstationFee) || 450,
      codAvailable: Boolean(d.codAvailable),
      estimatedDays: d.estimatedDays || '2-3 business days'
    }));
  }

  if (shippingMode === 'flat' || shippingMode === 'custom') {
    store.platformConfig.shippingMode = shippingMode;
  }

  if (flatShippingRateLkr !== undefined) {
    store.platformConfig.flatShippingRateLkr = Math.max(0, Number(flatShippingRateLkr) || 0);
  }

  persistStore();
  return res.json({
    districts: store.platformConfig.districts,
    shippingMode: store.platformConfig.shippingMode || 'custom',
    flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350,
    platformConfig: store.platformConfig,
    message:
      store.platformConfig.shippingMode === 'flat'
        ? `Flat Islandwide Shipping active at Rs. ${store.platformConfig.flatShippingRateLkr} for all places.`
        : 'Custom 25-district delivery fee matrix active and saved.'
  });
});

// PUT /api/admin/config/shipping-mode
// Instant switch between Flat Islandwide Shipping and Custom 25-District Matrix
router.put('/config/shipping-mode', (req, res) => {
  const { shippingMode, flatShippingRateLkr } = req.body;
  const store = getStore();

  if (shippingMode === 'flat' || shippingMode === 'custom') {
    store.platformConfig.shippingMode = shippingMode;
  }

  if (flatShippingRateLkr !== undefined) {
    store.platformConfig.flatShippingRateLkr = Math.max(0, Number(flatShippingRateLkr) || 0);
  }

  persistStore();
  return res.json({
    shippingMode: store.platformConfig.shippingMode || 'custom',
    flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350,
    platformConfig: store.platformConfig,
    message:
      store.platformConfig.shippingMode === 'flat'
        ? `Flat Islandwide Shipping activated at Rs. ${store.platformConfig.flatShippingRateLkr} for all places. Custom district fees disabled.`
        : 'Custom 25-District Matrix re-activated. District-specific rates are now active.'
  });
});

// PUT /api/admin/config/general
router.put('/config/general', (req, res) => {
  const {
    defaultCommissionPercent,
    homemadeCommissionPercent,
    codEnabledGlobally,
    codMaxOrderLimitLkr,
    globalFreeShippingMinLkr,
    banners
  } = req.body;

  const store = getStore();
  const cfg = store.platformConfig;

  if (defaultCommissionPercent !== undefined) {
    cfg.defaultCommissionPercent = Number(defaultCommissionPercent);
  }
  if (homemadeCommissionPercent !== undefined) {
    cfg.homemadeCommissionPercent = Number(homemadeCommissionPercent);
  }
  if (codEnabledGlobally !== undefined) {
    cfg.codEnabledGlobally = Boolean(codEnabledGlobally);
  }
  if (codMaxOrderLimitLkr !== undefined) {
    cfg.codMaxOrderLimitLkr = Number(codMaxOrderLimitLkr);
  }
  if (globalFreeShippingMinLkr !== undefined) {
    cfg.globalFreeShippingMinLkr = Number(globalFreeShippingMinLkr);
  }
  if (Array.isArray(banners)) {
    cfg.banners = banners;
  }

  persistStore();
  return res.json({
    platformConfig: cfg,
    message: 'Marketplace commission, COD rules, and promotional banners updated.'
  });
});

// POST /api/admin/categories
router.post('/categories', (req, res) => {
  const { name, quadHeadline, description, imageUrl, subCategories = [] } = req.body;
  if (!name || !quadHeadline) {
    return res.status(400).json({ message: 'Category name and 2x2 quad card headline are required.' });
  }
  const store = getStore();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const newCat = {
    _id: generateId('cat'),
    name: name.trim(),
    slug,
    quadHeadline: quadHeadline.trim(),
    description: description || '',
    imageUrl:
      imageUrl ||
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    displayOrder: store.categories.length + 1,
    showInQuadGrid: true,
    subCategories:
      subCategories.length === 4
        ? subCategories
        : [
            {
              name: `${name} Picks`,
              slug: `${slug}-picks`,
              imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
              bgTint: '#F3F4F6'
            },
            {
              name: 'Best Sellers',
              slug: `${slug}-best`,
              imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
              bgTint: '#F3F4F6'
            },
            {
              name: 'New Arrivals',
              slug: `${slug}-new`,
              imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
              bgTint: '#F3F4F6'
            },
            {
              name: 'Value Deals',
              slug: `${slug}-deals`,
              imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=400&q=80',
              bgTint: '#F3F4F6'
            }
          ]
  };

  store.categories.push(newCat);
  persistStore();
  return res.status(201).json({ category: newCat, message: 'Category created.' });
});

// PUT /api/admin/categories/:categoryId
router.put('/categories/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const store = getStore();

  const category = store.categories.find(
    (c) => c._id === categoryId || c.slug === categoryId
  );
  if (!category) {
    return res.status(404).json({ message: 'Category not found.' });
  }

  const {
    name,
    quadHeadline,
    description,
    imageUrl,
    displayOrder,
    showInQuadGrid,
    subCategories
  } = req.body;

  if (name !== undefined) category.name = name.trim();
  if (quadHeadline !== undefined) category.quadHeadline = quadHeadline.trim();
  if (description !== undefined) category.description = description.trim();
  if (imageUrl !== undefined) category.imageUrl = imageUrl.trim();
  if (displayOrder !== undefined) category.displayOrder = Number(displayOrder);
  if (showInQuadGrid !== undefined) category.showInQuadGrid = Boolean(showInQuadGrid);
  if (Array.isArray(subCategories) && subCategories.length > 0) {
    category.subCategories = subCategories.map((s, idx) => ({
      name: s.name?.trim() || `Tile ${idx + 1}`,
      slug: (s.slug || s.name || `tile-${idx + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      imageUrl:
        s.imageUrl ||
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
      bgTint: s.bgTint || '#F3F4F6'
    }));
  }

  persistStore();
  return res.json({
    category,
    message: `Department "${category.name}" updated successfully.`
  });
});

// DELETE /api/admin/categories/:categoryId
router.delete('/categories/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const store = getStore();

  const idx = store.categories.findIndex(
    (c) => c._id === categoryId || c.slug === categoryId
  );
  if (idx === -1) {
    return res.status(404).json({ message: 'Category not found.' });
  }

  const cat = store.categories[idx];
  const assignedProducts = store.products.filter(
    (p) => p.categorySlug === cat.slug
  );

  // Reassign products to fallback category if any were assigned
  if (assignedProducts.length > 0) {
    const fallbackCategory = store.categories.find((c) => c.slug !== cat.slug) || {
      slug: 'homemade-pantry'
    };
    for (const prod of assignedProducts) {
      prod.categorySlug = fallbackCategory.slug;
      prod.subCategorySlug = '';
    }
  }

  store.categories.splice(idx, 1);
  persistStore();
  return res.json({
    message: `Department "${cat.name}" removed.${
      assignedProducts.length > 0
        ? ` Reassigned ${assignedProducts.length} listing(s) safely.`
        : ''
    }`,
    categoryId
  });
});

// POST /api/admin/upload-image
// Uploads category cover or general admin media to Cloudinary CDN
router.post('/upload-image', uploadMiddleware.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file was provided.' });
    }
    const uploaded = await uploadToCloudinary(req.file.buffer, {
      folder: 'yaans_lk/categories',
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      req
    });
    return res.status(201).json(uploaded);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Image upload failed.' });
  }
});

// GET /api/admin/banners
// List all homepage banner cards
router.get('/banners', (_req, res) => {
  const store = getStore();
  const banners = [...(store.platformConfig.banners || [])].sort(
    (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
  );
  return res.json({ banners });
});

// POST /api/admin/banners
// Add a new homepage banner card attached to a category or all products
router.post('/banners', (req, res) => {
  const { title, imageUrl, categorySlug = '', ctaLink = '', active = true, displayOrder } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ message: 'Banner image is required.' });
  }

  const store = getStore();
  if (!Array.isArray(store.platformConfig.banners)) {
    store.platformConfig.banners = [];
  }

  const resolvedLink =
    ctaLink || (categorySlug ? `/products?category=${categorySlug}` : '/products');

  const newBanner = {
    id: generateId('bnr'),
    title: title?.trim() || 'Homepage Banner Card',
    imageUrl: imageUrl.trim(),
    categorySlug: categorySlug ? categorySlug.trim() : '',
    ctaLink: resolvedLink.trim(),
    active: active !== false,
    displayOrder:
      displayOrder !== undefined
        ? Number(displayOrder)
        : store.platformConfig.banners.length + 1
  };

  store.platformConfig.banners.push(newBanner);
  persistStore();
  return res.status(201).json({ banner: newBanner, message: 'Homepage banner card created.' });
});

// PUT /api/admin/banners/:bannerId
// Update an existing homepage banner card
router.put('/banners/:bannerId', (req, res) => {
  const { bannerId } = req.params;
  const { title, imageUrl, categorySlug, ctaLink, active, displayOrder } = req.body;

  const store = getStore();
  if (!Array.isArray(store.platformConfig.banners)) {
    store.platformConfig.banners = [];
  }

  const banner = store.platformConfig.banners.find((b) => b.id === bannerId);
  if (!banner) {
    return res.status(404).json({ message: 'Banner card not found.' });
  }

  if (title !== undefined) banner.title = title.trim();
  if (imageUrl !== undefined) banner.imageUrl = imageUrl.trim();
  if (categorySlug !== undefined) {
    banner.categorySlug = categorySlug ? categorySlug.trim() : '';
    if (!ctaLink) {
      banner.ctaLink = banner.categorySlug
        ? `/products?category=${banner.categorySlug}`
        : '/products';
    }
  }
  if (ctaLink !== undefined) banner.ctaLink = ctaLink.trim();
  if (active !== undefined) banner.active = Boolean(active);
  if (displayOrder !== undefined) banner.displayOrder = Number(displayOrder);

  persistStore();
  return res.json({ banner, message: 'Homepage banner card updated.' });
});

// DELETE /api/admin/banners/:bannerId
// Remove a homepage banner card
router.delete('/banners/:bannerId', (req, res) => {
  const { bannerId } = req.params;
  const store = getStore();
  if (!Array.isArray(store.platformConfig.banners)) {
    store.platformConfig.banners = [];
  }

  const idx = store.platformConfig.banners.findIndex((b) => b.id === bannerId);
  if (idx === -1) {
    return res.status(404).json({ message: 'Banner card not found.' });
  }

  store.platformConfig.banners.splice(idx, 1);
  persistStore();
  return res.json({ message: 'Banner card removed from homepage.' });
});

// PUT /api/admin/config/banners
// Batch update or reorder banners
router.put('/config/banners', (req, res) => {
  const { banners } = req.body;
  if (!Array.isArray(banners)) {
    return res.status(400).json({ message: 'banners array is required.' });
  }
  const store = getStore();
  store.platformConfig.banners = banners;
  persistStore();
  return res.json({
    banners: store.platformConfig.banners,
    message: 'Homepage banners successfully updated.'
  });
});

// POST /api/admin/settlements/payout
// Reconciles and settles all eligible_for_payout SubOrders for a given seller
router.post('/settlements/payout', (req, res) => {
  const { sellerId, bankReference = '', notes = '' } = req.body;
  if (!sellerId) {
    return res.status(400).json({ message: 'sellerId is required to execute settlement.' });
  }

  const store = getStore();
  const seller = store.sellers.find((s) => s._id === sellerId);
  if (!seller) {
    return res.status(404).json({ message: 'Seller not found.' });
  }

  const eligibleSubs = store.subOrders.filter(
    (s) => s.sellerId === sellerId && s.settlementStatus === 'eligible_for_payout'
  );

  if (eligibleSubs.length === 0) {
    return res.status(400).json({
      message: 'No delivered & COD-collected orders are currently waiting for settlement for this seller.'
    });
  }

  const grossOrderItemsLkr = eligibleSubs.reduce((sum, s) => sum + s.itemsSubtotalLkr, 0);
  const platformCommissionLkr = eligibleSubs.reduce((sum, s) => sum + s.commissionAmountLkr, 0);
  const netPayoutLkr = eligibleSubs.reduce((sum, s) => sum + s.netSellerEarningsLkr, 0);

  const settlementId = generateId('stl');
  const seq = String(store.settlements.length + 1).padStart(3, '0');
  const settlementReference = `STL-YLK-2026-${seq}`;

  const newSettlement = {
    _id: settlementId,
    settlementReference,
    sellerId: seller._id,
    sellerName: seller.storeName,
    subOrderIds: eligibleSubs.map((s) => s._id),
    grossOrderItemsLkr,
    platformCommissionLkr,
    netPayoutLkr,
    bankReference: bankReference || `CEFT-SL-${Math.floor(1000000 + Math.random() * 9000000)}`,
    status: 'paid',
    paidAt: new Date().toISOString(),
    notes:
      notes ||
      `Settled ${eligibleSubs.length} delivered sub-order(s) to ${seller.bankDetails?.bankName || 'Seller Bank'}.`
  };

  eligibleSubs.forEach((s) => {
    s.settlementStatus = 'settled';
    s.settlementId = settlementId;
    s.statusHistory.push({
      status: 'settled',
      note: `Seller payout settled via ${settlementReference} (Net Rs. ${s.netSellerEarningsLkr.toLocaleString()})`,
      timestamp: new Date().toISOString()
    });
  });

  store.settlements.unshift(newSettlement);
  persistStore();

  return res.status(201).json({
    settlement: newSettlement,
    settledCount: eligibleSubs.length,
    message: `Settlement ${settlementReference} for Rs. ${netPayoutLkr.toLocaleString()} paid to ${seller.storeName}!`
  });
});

export default router;
