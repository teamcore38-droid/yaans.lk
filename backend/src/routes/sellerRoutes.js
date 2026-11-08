import express from 'express';
import { getStore, persistStore, generateId } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadMiddleware, handleProductImageUpload } from '../config/cloudinary.js';

const router = express.Router();

router.use(authenticate, requireRole('seller', 'admin'));

function resolveSellerForRequest(req, store) {
  if (req.query.sellerId && req.user.role === 'admin') {
    return store.sellers.find((s) => s._id === req.query.sellerId);
  }
  return store.sellers.find(
    (s) => s._id === req.user.sellerId || s.userId === req.user._id
  );
}

// GET /api/seller/dashboard
router.get('/dashboard', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  if (!seller) {
    return res.status(404).json({ message: 'Seller profile not found.' });
  }

  const products = store.products.filter((p) => p.sellerId === seller._id);
  const subOrders = store.subOrders
    .filter((s) => s.sellerId === seller._id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const settlements = store.settlements
    .filter((st) => st.sellerId === seller._id)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  const validSubOrders = subOrders.filter(
    (s) => !['cancelled', 'returned'].includes(s.fulfillmentStatus)
  );

  const grossSalesLkr = validSubOrders.reduce((sum, s) => sum + s.itemsSubtotalLkr, 0);
  const totalCommissionLkr = validSubOrders.reduce((sum, s) => sum + s.commissionAmountLkr, 0);
  const netEarningsLkr = validSubOrders.reduce((sum, s) => sum + s.netSellerEarningsLkr, 0);

  const eligibleForPayoutLkr = subOrders
    .filter((s) => s.settlementStatus === 'eligible_for_payout')
    .reduce((sum, s) => sum + s.netSellerEarningsLkr, 0);

  const settledEarningsLkr = settlements.reduce((sum, st) => sum + st.netPayoutLkr, 0);
  const pendingDeliveryOrdersCount = subOrders.filter((s) =>
    ['confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(s.fulfillmentStatus)
  ).length;

  const effectiveCommissionRate =
    seller.commissionRateOverride !== null && seller.commissionRateOverride !== undefined
      ? seller.commissionRateOverride
      : seller.isHomemadeVendor
      ? store.platformConfig.homemadeCommissionPercent
      : store.platformConfig.defaultCommissionPercent;

  return res.json({
    seller,
    effectiveCommissionRate,
    metrics: {
      totalProducts: products.length,
      approvedProducts: products.filter((p) => p.approvalStatus === 'approved').length,
      pendingProducts: products.filter((p) => p.approvalStatus === 'pending').length,
      totalSubOrders: subOrders.length,
      pendingDeliveryOrdersCount,
      grossSalesLkr,
      totalCommissionLkr,
      netEarningsLkr,
      eligibleForPayoutLkr,
      settledEarningsLkr
    },
    products,
    subOrders,
    settlements,
    categories: store.categories,
    districts: store.platformConfig.districts
  });
});

// POST /api/seller/upload-image
router.post('/upload-image', uploadMiddleware.single('image'), async (req, res) => {
  try {
    const uploaded = await handleProductImageUpload(req);
    return res.status(201).json(uploaded);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Image upload failed.' });
  }
});

// POST /api/seller/products
router.post('/products', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  if (!seller) {
    return res.status(404).json({ message: 'Seller profile not found.' });
  }

  const {
    title,
    sku,
    categorySlug = 'homemade-pantry',
    subCategorySlug = '',
    description,
    highlights = [],
    priceLkr,
    compareAtPriceLkr = null,
    stock = 15,
    images = [],
    variants = [],
    isHomemade = seller.isHomemadeVendor,
    codEligible = true,
    tags = []
  } = req.body;

  if (!title || !priceLkr || !description) {
    return res.status(400).json({ message: 'Product title, description, and price in LKR (Rs.) are required.' });
  }

  const slugBase = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const newProduct = {
    _id: generateId('prd'),
    sellerId: seller._id,
    sellerName: seller.storeName,
    sellerSlug: seller.slug,
    sellerDistrict: seller.district,
    sellerType: seller.sellerType,
    title: title.trim(),
    slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
    sku: sku || `YLK-${Date.now().toString().slice(-5)}`,
    categorySlug,
    subCategorySlug,
    description: description.trim(),
    highlights: Array.isArray(highlights)
      ? highlights.filter(Boolean)
      : String(highlights)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
    priceLkr: Number(priceLkr),
    compareAtPriceLkr: compareAtPriceLkr ? Number(compareAtPriceLkr) : null,
    stock: Number(stock) || 0,
    images:
      images && images.length > 0
        ? images
        : ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80'],
    variants: Array.isArray(variants) ? variants : [],
    isHomemade: Boolean(isHomemade),
    isFeatured: false,
    isDeal: Boolean(compareAtPriceLkr && Number(compareAtPriceLkr) > Number(priceLkr)),
    codEligible: Boolean(codEligible),
    // Approved sellers have listings go live or pending based on seller status
    approvalStatus: seller.status === 'approved' ? 'approved' : 'pending',
    rating: 5.0,
    reviewCount: 0,
    soldCount: 0,
    tags: Array.isArray(tags)
      ? tags
      : String(tags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    createdAt: new Date().toISOString()
  };

  store.products.unshift(newProduct);
  persistStore();

  return res.status(201).json({
    product: newProduct,
    message:
      newProduct.approvalStatus === 'approved'
        ? 'Product published to Yaans.lk marketplace!'
        : 'Product created and queued for Admin approval.'
  });
});

// PUT /api/seller/products/:productId
router.put('/products/:productId', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  const product = store.products.find((p) => p._id === req.params.productId);

  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }
  if (req.user.role !== 'admin' && (!seller || product.sellerId !== seller._id)) {
    return res.status(403).json({ message: 'You can only edit your own products.' });
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
    codEligible
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
  if (priceLkr !== undefined) product.priceLkr = Number(priceLkr);
  if (compareAtPriceLkr !== undefined) {
    product.compareAtPriceLkr = compareAtPriceLkr ? Number(compareAtPriceLkr) : null;
  }
  if (stock !== undefined) product.stock = Math.max(0, Number(stock));
  if (images !== undefined && Array.isArray(images) && images.length > 0) {
    product.images = images;
  }
  if (variants !== undefined && Array.isArray(variants)) {
    product.variants = variants;
  }
  if (isHomemade !== undefined) product.isHomemade = Boolean(isHomemade);
  if (codEligible !== undefined) product.codEligible = Boolean(codEligible);

  persistStore();
  return res.json({ product, message: 'Product updated successfully.' });
});

// DELETE /api/seller/products/:productId
router.delete('/products/:productId', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  const idx = store.products.findIndex((p) => p._id === req.params.productId);

  if (idx === -1) {
    return res.status(404).json({ message: 'Product not found.' });
  }
  if (req.user.role !== 'admin' && (!seller || store.products[idx].sellerId !== seller._id)) {
    return res.status(403).json({ message: 'You can only delete your own products.' });
  }

  store.products.splice(idx, 1);
  persistStore();
  return res.json({ message: 'Product deleted.' });
});

// PUT /api/seller/suborders/:subOrderId/status
// Seller updates fulfillment status, tracking number, and COD cash collection status
router.put('/suborders/:subOrderId/status', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  const subOrder = store.subOrders.find((s) => s._id === req.params.subOrderId);

  if (!subOrder) {
    return res.status(404).json({ message: 'Sub-order not found.' });
  }
  if (req.user.role !== 'admin' && (!seller || subOrder.sellerId !== seller._id)) {
    return res.status(403).json({ message: 'Unauthorized to update this sub-order.' });
  }

  const { fulfillmentStatus, trackingCode, courierPartner, codCollectionStatus, note = '' } = req.body;

  if (trackingCode !== undefined) subOrder.trackingCode = trackingCode.trim();
  if (courierPartner !== undefined) subOrder.courierPartner = courierPartner.trim();

  if (fulfillmentStatus) {
    subOrder.fulfillmentStatus = fulfillmentStatus;

    if (fulfillmentStatus === 'delivered') {
      if (subOrder.paymentMethod === 'COD') {
        subOrder.codCollectionStatus = codCollectionStatus || 'remitted_to_platform';
        subOrder.codCollectedAt = new Date().toISOString();
      }
      if (subOrder.settlementStatus === 'unsettled') {
        subOrder.settlementStatus = 'eligible_for_payout';
      }
    } else if (fulfillmentStatus === 'cancelled' || fulfillmentStatus === 'returned') {
      subOrder.settlementStatus = 'voided';
      if (fulfillmentStatus === 'returned' && subOrder.paymentMethod === 'COD') {
        subOrder.codCollectionStatus = 'refunded';
      }
    }

    subOrder.statusHistory.push({
      status: fulfillmentStatus,
      note:
        note ||
        (fulfillmentStatus === 'delivered'
          ? `Package delivered & COD Rs. ${subOrder.grossTotalLkr.toLocaleString()} collected. Eligible for seller settlement.`
          : `Status updated to ${fulfillmentStatus.replace(/_/g, ' ')}.`),
      timestamp: new Date().toISOString()
    });
  }

  if (codCollectionStatus) {
    subOrder.codCollectionStatus = codCollectionStatus;
  }

  // Recompute Parent Order overallStatus based on all its split SubOrders
  const parentOrder = store.orders.find((o) => o._id === subOrder.parentOrderId);
  if (parentOrder) {
    const allSubs = store.subOrders.filter((s) => s.parentOrderId === parentOrder._id);
    if (allSubs.every((s) => s.fulfillmentStatus === 'delivered')) {
      parentOrder.overallStatus = 'delivered';
    } else if (allSubs.every((s) => s.fulfillmentStatus === 'cancelled')) {
      parentOrder.overallStatus = 'cancelled';
    } else if (
      allSubs.some((s) => ['shipped', 'out_for_delivery', 'delivered'].includes(s.fulfillmentStatus))
    ) {
      parentOrder.overallStatus = allSubs.every((s) =>
        ['shipped', 'out_for_delivery', 'delivered'].includes(s.fulfillmentStatus)
      )
        ? 'shipped'
        : 'partially_shipped';
    } else {
      parentOrder.overallStatus = 'processing';
    }
  }

  persistStore();
  return res.json({
    subOrder,
    message: `Order package ${subOrder.subOrderNumber} updated to "${subOrder.fulfillmentStatus}".`
  });
});

// PUT /api/seller/profile
router.put('/profile', (req, res) => {
  const store = getStore();
  const seller = resolveSellerForRequest(req, store);
  if (!seller) {
    return res.status(404).json({ message: 'Seller profile not found.' });
  }

  const {
    storeName,
    sellerType,
    description,
    contactPhone,
    district,
    city,
    businessAddress,
    logoUrl,
    bannerUrl,
    shippingPolicy,
    bankDetails
  } = req.body;

  if (storeName) seller.storeName = storeName.trim();
  if (sellerType) {
    seller.sellerType = sellerType;
    seller.isHomemadeVendor = sellerType === 'Homemade & Cottage' || sellerType === 'Artisan & Craft';
  }
  if (description) seller.description = description.trim();
  if (contactPhone) seller.contactPhone = contactPhone.trim();
  if (district) seller.district = district;
  if (city) seller.city = city.trim();
  if (businessAddress) seller.businessAddress = businessAddress.trim();
  if (logoUrl) seller.logoUrl = logoUrl;
  if (bannerUrl) seller.bannerUrl = bannerUrl;
  if (shippingPolicy) {
    seller.shippingPolicy = {
      ...seller.shippingPolicy,
      ...shippingPolicy
    };
  }
  if (bankDetails) {
    seller.bankDetails = {
      ...seller.bankDetails,
      ...bankDetails
    };
  }

  persistStore();
  return res.json({ seller, message: 'Seller storefront & shipping settings updated.' });
});

export default router;
