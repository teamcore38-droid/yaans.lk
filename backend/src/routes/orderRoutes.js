import express from 'express';
import { getStore, persistStore, generateId } from '../config/db.js';
import { calculateSellerDeliveryFee } from '../config/sriLankaDistricts.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper to group cart items by seller and calculate per-seller delivery fees and commission
 */
function buildMultiSellerCartBreakdown(cartItems = [], destinationDistrict = 'Colombo', store) {
  const sellerBuckets = new Map();

  for (const rawItem of cartItems) {
    const product = store.products.find((p) => p._id === rawItem.productId);
    if (!product) continue;

    const seller = store.sellers.find((s) => s._id === product.sellerId);
    const quantity = Math.max(1, parseInt(rawItem.quantity, 10) || 1);

    // Determine price based on variant if selected
    let unitPriceLkr = product.priceLkr;
    const variantLabel = rawItem.variantLabel || 'Standard';
    if (product.variants && product.variants.length > 0) {
      for (const vGroup of product.variants) {
        const matched = (vGroup.values || []).find((v) => v.label === variantLabel);
        if (matched && matched.priceLkr) {
          unitPriceLkr = matched.priceLkr;
        }
      }
    }

    const lineTotalLkr = unitPriceLkr * quantity;
    const sellerId = product.sellerId;

    if (!sellerBuckets.has(sellerId)) {
      sellerBuckets.set(sellerId, {
        sellerId,
        sellerName: seller ? seller.storeName : product.sellerName,
        sellerSlug: seller ? seller.slug : product.sellerSlug,
        sellerDistrict: seller ? seller.district : product.sellerDistrict,
        sellerType: seller ? seller.sellerType : product.sellerType,
        isHomemadeVendor: seller ? seller.isHomemadeVendor : product.isHomemade,
        seller,
        items: [],
        itemsSubtotalLkr: 0,
        totalQuantity: 0
      });
    }

    const bucket = sellerBuckets.get(sellerId);
    bucket.items.push({
      productId: product._id,
      title: product.title,
      slug: product.slug,
      image: product.images?.[0] || '',
      sku: product.sku,
      variantLabel,
      unitPriceLkr,
      quantity,
      lineTotalLkr,
      sellerId,
      sellerName: bucket.sellerName,
      sellerDistrict: bucket.sellerDistrict
    });
    bucket.itemsSubtotalLkr += lineTotalLkr;
    bucket.totalQuantity += quantity;
  }

  const sellerGroups = [];
  let itemsSubtotalLkr = 0;
  let totalDeliveryFeeLkr = 0;
  let codAvailableForAll = Boolean(store.platformConfig.codEnabledGlobally);

  for (const bucket of sellerBuckets.values()) {
    const shipping = calculateSellerDeliveryFee({
      sellerDistrict: bucket.sellerDistrict,
      destinationDistrict,
      sellerSubtotalLkr: bucket.itemsSubtotalLkr,
      totalItemCount: bucket.totalQuantity,
      sellerShippingPolicy: bucket.seller?.shippingPolicy || {},
      districtConfigs: store.platformConfig.districts,
      globalFreeShippingMinLkr: store.platformConfig.globalFreeShippingMinLkr,
      shippingMode: store.platformConfig.shippingMode || 'custom',
      flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350
    });

    if (!shipping.codAvailable) {
      codAvailableForAll = false;
    }

    const commissionRatePercent =
      bucket.seller?.commissionRateOverride !== null &&
      bucket.seller?.commissionRateOverride !== undefined
        ? Number(bucket.seller.commissionRateOverride)
        : bucket.isHomemadeVendor
        ? Number(store.platformConfig.homemadeCommissionPercent || 5)
        : Number(store.platformConfig.defaultCommissionPercent || 8);

    const commissionAmountLkr = Math.round((bucket.itemsSubtotalLkr * commissionRatePercent) / 100);
    const netSellerEarningsLkr = bucket.itemsSubtotalLkr - commissionAmountLkr;

    itemsSubtotalLkr += bucket.itemsSubtotalLkr;
    totalDeliveryFeeLkr += shipping.deliveryFeeLkr;

    sellerGroups.push({
      sellerId: bucket.sellerId,
      sellerName: bucket.sellerName,
      sellerSlug: bucket.sellerSlug,
      sellerDistrict: bucket.sellerDistrict,
      sellerType: bucket.sellerType,
      items: bucket.items,
      totalQuantity: bucket.totalQuantity,
      itemsSubtotalLkr: bucket.itemsSubtotalLkr,
      deliveryFeeLkr: shipping.deliveryFeeLkr,
      shippingDetails: shipping,
      grossTotalLkr: bucket.itemsSubtotalLkr + shipping.deliveryFeeLkr,
      commissionRatePercent,
      commissionAmountLkr,
      netSellerEarningsLkr
    });
  }

  const grandTotalLkr = itemsSubtotalLkr + totalDeliveryFeeLkr;
  if (grandTotalLkr > (store.platformConfig.codMaxOrderLimitLkr || 75000)) {
    codAvailableForAll = false;
  }

  return {
    destinationDistrict,
    sellerCount: sellerGroups.length,
    sellerGroups,
    itemsSubtotalLkr,
    totalDeliveryFeeLkr,
    grandTotalLkr, // No tax calculation required
    codAvailable: codAvailableForAll,
    codMaxOrderLimitLkr: store.platformConfig.codMaxOrderLimitLkr || 75000
  };
}

// POST /api/orders/quote
router.post('/quote', (req, res) => {
  const { items = [], destinationDistrict = 'Colombo' } = req.body;
  const store = getStore();
  const quote = buildMultiSellerCartBreakdown(items, destinationDistrict, store);
  return res.json(quote);
});

// POST /api/orders/checkout
// Supports both Guest Checkout and Registered User Checkout; splits multi-seller cart into SubOrders
router.post('/checkout', optionalAuthenticate, (req, res) => {
  const {
    items = [],
    customerEmail = '',
    shippingAddress = {},
    paymentMethod = 'COD',
    codConfirmedByCustomer = true
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Your shopping cart is empty.' });
  }

  const {
    recipientName,
    phone,
    addressLine1,
    addressLine2 = '',
    city,
    district = 'Colombo',
    postalCode = '',
    deliveryNotes = ''
  } = shippingAddress;

  if (!recipientName || !phone || !addressLine1 || !city || !district) {
    return res.status(400).json({
      message: 'Please provide Recipient Name, Sri Lankan Mobile Number, Street Address, Town/City, and District.'
    });
  }

  const store = getStore();
  const breakdown = buildMultiSellerCartBreakdown(items, district, store);

  if (breakdown.sellerGroups.length === 0) {
    return res.status(400).json({ message: 'No valid products found in cart.' });
  }

  if (paymentMethod === 'COD' && !breakdown.codAvailable) {
    return res.status(400).json({
      message: 'Cash on Delivery (COD) is not available for this district or exceeds the COD order limit.'
    });
  }

  // Generate sequential readable Sri Lankan Order Number
  const nextSeq = 1001 + store.orders.length;
  const orderNumber = `YLK-2026-${nextSeq}`;
  const parentOrderId = generateId('ord');
  const createdSubOrders = [];
  const allOrderItems = [];

  breakdown.sellerGroups.forEach((group, idx) => {
    const subId = generateId('sub');
    const subOrderNumber = `${orderNumber}-S${idx + 1}`;

    // Update product inventory & soldCount
    for (const line of group.items) {
      allOrderItems.push(line);
      const prod = store.products.find((p) => p._id === line.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - line.quantity);
        prod.soldCount = (prod.soldCount || 0) + line.quantity;
      }
      const sellerDoc = store.sellers.find((s) => s._id === group.sellerId);
      if (sellerDoc) {
        sellerDoc.totalSalesCount = (sellerDoc.totalSalesCount || 0) + line.quantity;
      }
    }

    const subOrderDoc = {
      _id: subId,
      subOrderNumber,
      parentOrderId,
      parentOrderNumber: orderNumber,
      sellerId: group.sellerId,
      sellerName: group.sellerName,
      sellerDistrict: group.sellerDistrict,
      customerName: recipientName.trim(),
      customerPhone: phone.trim(),
      shippingAddress: {
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        district,
        postalCode: postalCode.trim(),
        deliveryNotes: deliveryNotes.trim()
      },
      items: group.items,
      itemsSubtotalLkr: group.itemsSubtotalLkr,
      deliveryFeeLkr: group.deliveryFeeLkr,
      grossTotalLkr: group.grossTotalLkr,
      commissionRatePercent: group.commissionRatePercent,
      commissionAmountLkr: group.commissionAmountLkr,
      netSellerEarningsLkr: group.netSellerEarningsLkr,
      paymentMethod,
      codCollectionStatus: paymentMethod === 'COD' ? 'pending_collection' : 'not_applicable',
      codCollectedAt: null,
      fulfillmentStatus: 'confirmed',
      trackingCode: `PXP-${group.sellerDistrict.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      courierPartner: 'Prompt Xpress SL',
      settlementStatus: 'unsettled',
      settlementId: null,
      statusHistory: [
        {
          status: 'confirmed',
          note:
            paymentMethod === 'COD'
              ? `Cash on Delivery (COD) order confirmed for Rs. ${group.grossTotalLkr.toLocaleString()}. Assigned to seller ${group.sellerName} (${group.sellerDistrict}).`
              : `Order confirmed and assigned to seller ${group.sellerName}.`,
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString()
    };

    store.subOrders.unshift(subOrderDoc);
    createdSubOrders.push(subOrderDoc);
  });

  const masterOrder = {
    _id: parentOrderId,
    orderNumber,
    userId: req.user ? req.user._id : null,
    isGuestOrder: !req.user,
    customerEmail: (req.user ? req.user.email : customerEmail) || 'guest@yaans.lk',
    customerPhone: phone.trim(),
    shippingAddress: {
      recipientName: recipientName.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      district,
      postalCode: postalCode.trim(),
      deliveryNotes: deliveryNotes.trim()
    },
    items: allOrderItems,
    subOrderIds: createdSubOrders.map((s) => s._id),
    sellerCount: createdSubOrders.length,
    itemsSubtotalLkr: breakdown.itemsSubtotalLkr,
    totalDeliveryFeeLkr: breakdown.totalDeliveryFeeLkr,
    grandTotalLkr: breakdown.grandTotalLkr,
    paymentMethod,
    codConfirmedByCustomer: Boolean(codConfirmedByCustomer),
    overallStatus: 'processing',
    createdAt: new Date().toISOString()
  };

  store.orders.unshift(masterOrder);
  persistStore();

  return res.status(201).json({
    order: masterOrder,
    subOrders: createdSubOrders,
    message: `Order ${orderNumber} placed successfully! Split across ${createdSubOrders.length} seller shipment(s).`
  });
});

// GET /api/orders/my-orders
router.get('/my-orders', authenticate, (req, res) => {
  const store = getStore();
  const userOrders = store.orders
    .filter(
      (o) =>
        o.userId === req.user._id ||
        o.customerEmail.toLowerCase() === req.user.email.toLowerCase()
    )
    .map((order) => ({
      ...order,
      subOrders: store.subOrders.filter((s) => s.parentOrderId === order._id)
    }));

  return res.json({ orders: userOrders });
});

// GET /api/orders/track?orderNumber=YLK-2026-1001&phone=0774123987
router.get('/track', (req, res) => {
  const { orderNumber = '', phone = '' } = req.query;
  if (!orderNumber) {
    return res.status(400).json({ message: 'Please enter an Order Number (e.g., YLK-2026-1001).' });
  }

  const store = getStore();
  const cleanOrderNum = String(orderNumber).trim().toUpperCase();
  const order = store.orders.find(
    (o) =>
      o.orderNumber.toUpperCase() === cleanOrderNum ||
      o._id === orderNumber
  );

  if (!order) {
    return res.status(404).json({
      message: `No order found matching "${orderNumber}". Try sample order YLK-2026-1001 or YLK-2026-1002.`
    });
  }

  // If phone is supplied, verify last 6 digits match
  if (phone && String(phone).trim().length >= 6) {
    const cleanInputPhone = String(phone).replace(/\D/g, '').slice(-7);
    const cleanOrderPhone = String(order.customerPhone).replace(/\D/g, '').slice(-7);
    if (cleanInputPhone && cleanOrderPhone && cleanInputPhone !== cleanOrderPhone) {
      return res.status(403).json({
        message: 'Phone number does not match the recipient phone number for this order.'
      });
    }
  }

  const subOrders = store.subOrders.filter((s) => s.parentOrderId === order._id);
  return res.json({ order, subOrders });
});

// POST /api/orders/suborders/:subOrderId/customer-action
// Supports COD cancellation (before shipping) or return request (after delivery)
router.post('/suborders/:subOrderId/customer-action', (req, res) => {
  const { subOrderId } = req.params;
  const { action, reason = '' } = req.body; // action: 'cancel' | 'request_return'
  const store = getStore();

  const subOrder = store.subOrders.find((s) => s._id === subOrderId || s.subOrderNumber === subOrderId);
  if (!subOrder) {
    return res.status(404).json({ message: 'Seller package not found.' });
  }

  if (action === 'cancel') {
    if (['shipped', 'out_for_delivery', 'delivered'].includes(subOrder.fulfillmentStatus)) {
      return res.status(400).json({
        message: 'Cannot cancel a package that has already been dispatched. You may request a return after delivery.'
      });
    }
    subOrder.fulfillmentStatus = 'cancelled';
    subOrder.codCollectionStatus = 'not_applicable';
    subOrder.settlementStatus = 'voided';
    subOrder.statusHistory.push({
      status: 'cancelled',
      note: `Cancelled by customer: ${reason || 'Customer requested cancellation'}`,
      timestamp: new Date().toISOString()
    });
  } else if (action === 'request_return') {
    if (subOrder.fulfillmentStatus !== 'delivered') {
      return res.status(400).json({ message: 'Returns can only be requested for delivered packages.' });
    }
    subOrder.fulfillmentStatus = 'return_requested';
    subOrder.statusHistory.push({
      status: 'return_requested',
      note: `Return requested by customer: ${reason || 'Item return requested'}`,
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  // Sync parent order overallStatus
  const parentOrder = store.orders.find((o) => o._id === subOrder.parentOrderId);
  if (parentOrder) {
    const siblingSubs = store.subOrders.filter((s) => s.parentOrderId === parentOrder._id);
    if (siblingSubs.every((s) => s.fulfillmentStatus === 'cancelled')) {
      parentOrder.overallStatus = 'cancelled';
    } else if (siblingSubs.some((s) => s.fulfillmentStatus === 'return_requested' || s.fulfillmentStatus === 'returned')) {
      parentOrder.overallStatus = 'returned';
    }
  }

  persistStore();
  return res.json({ subOrder, message: `Package ${subOrder.subOrderNumber} updated.` });
});

export default router;
