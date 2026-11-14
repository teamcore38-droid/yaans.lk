import { businessSettings, returnPolicy, sellerCommission } from '../../../shared/businessSettings.js';
import { calculateSellerDeliveryFee } from '../config/sriLankaDistricts.js';
import { httpError } from '../config/errors.js';

export function normalizeCartItems(items) {
  if (!Array.isArray(items) || items.length > 50) throw httpError(400, 'A cart may contain at most 50 product selections.');
  const lines = new Map();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId || item.productId.length > 128 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
        (item.variantLabel !== undefined && (typeof item.variantLabel !== 'string' || item.variantLabel.length > 120))) {
      throw httpError(400, 'Each cart item needs a product ID and an integer quantity between 1 and 99.');
    }
    const variantLabel = item.variantLabel || 'Standard';
    const key = JSON.stringify([item.productId, variantLabel]);
    const quantity = (lines.get(key)?.quantity || 0) + item.quantity;
    if (quantity > 99) throw httpError(400, 'The quantity for a product selection cannot exceed 99.');
    lines.set(key, { productId: item.productId, variantLabel, quantity });
  }
  return [...lines.values()].sort((a, b) => a.productId.localeCompare(b.productId) || a.variantLabel.localeCompare(b.variantLabel));
}

export function findVariant(product, label) {
  const groups = product.variants || [];
  if (!groups.length) {
    if (label !== 'Standard') throw httpError(409, 'The selected product option is unavailable.');
    return null;
  }
  const matches = groups.flatMap((group, groupIndex) => (group.values || []).flatMap((option, optionIndex) =>
    option.label === label ? [{ option, groupIndex, optionIndex }] : []));
  if (matches.length !== 1) throw httpError(409, 'Please select an available product option.');
  return matches[0];
}

export function buildMultiSellerCartBreakdown(items, destinationDistrict, store) {
  const cart = normalizeCartItems(items);
  const settings = businessSettings(store.platformConfig);
  const commissionConfig = { ...store.platformConfig, businessSettings: settings };
  if (cart.length > settings.pricing.maxCartSelections || cart.some(item => item.quantity > settings.pricing.maxQuantityPerSelection)) throw httpError(400, 'Cart exceeds the configured purchase limits.');
  if (!store.platformConfig?.districts?.some((district) => district.name === destinationDistrict)) {
    throw httpError(400, 'Please select a supported delivery district.');
  }
  const totals = new Map();
  for (const line of cart) totals.set(line.productId, (totals.get(line.productId) || 0) + line.quantity);
  const buckets = new Map();
  let codAvailable = Boolean(store.platformConfig.codEnabledGlobally);
  for (const line of cart) {
    const product = store.products.find((p) => p._id === line.productId);
    const seller = product && store.sellers.find((s) => s._id === product.sellerId);
    if (!product || product.approvalStatus !== 'approved' || !seller || seller.status !== 'approved' || seller.isVacationMode) {
      throw httpError(409, 'A product or seller in your cart is currently unavailable.');
    }
    const variant = findVariant(product, line.variantLabel);
    if (!Number.isSafeInteger(product.stock) || product.stock < totals.get(product._id) ||
        (variant && (!Number.isSafeInteger(variant.option.stock) || variant.option.stock < line.quantity))) {
      throw httpError(409, `There is not enough stock for ${product.title}. Please update your cart.`);
    }
    const unitPriceLkr = variant ? variant.option.priceLkr : product.priceLkr;
    if (!Number.isFinite(unitPriceLkr) || unitPriceLkr <= 0) throw httpError(409, 'A product price is unavailable.');
    if (product.codEligible === false) codAvailable = false;
    if (!buckets.has(seller._id)) buckets.set(seller._id, { seller, items: [], itemsSubtotalLkr: 0, totalQuantity: 0 });
    const bucket = buckets.get(seller._id);
    const lineTotalLkr = Math.round(unitPriceLkr * line.quantity * 100) / 100;
    bucket.items.push({ ...line, title: product.title, slug: product.slug, image: product.images?.[0] || '',
      sku: product.sku, unitPriceLkr, lineTotalLkr, sellerId: seller._id,
      sellerName: seller.storeName, sellerDistrict: seller.district });
    bucket.itemsSubtotalLkr += lineTotalLkr;
    bucket.totalQuantity += line.quantity;
  }
  const sellerGroups = [];
  for (const { seller, items: groupItems, itemsSubtotalLkr, totalQuantity } of buckets.values()) {
    const shipping = calculateSellerDeliveryFee({ sellerDistrict: seller.district, destinationDistrict,
      sellerSubtotalLkr: itemsSubtotalLkr, totalItemCount: totalQuantity, sellerShippingPolicy: seller.shippingPolicy || {},
      districtConfigs: store.platformConfig.districts, globalFreeShippingMinLkr: store.platformConfig.globalFreeShippingMinLkr,
      shippingMode: store.platformConfig.shippingMode || 'custom', flatShippingRateLkr: store.platformConfig.flatShippingRateLkr ?? 350, deliveryRules: settings.delivery });
    codAvailable &&= Boolean(shipping.codAvailable);
    const commissionRatePercent = Number(seller.commissionRateOverride ??
      sellerCommission(commissionConfig, seller.sellerType));
    if (!Number.isFinite(commissionRatePercent) || commissionRatePercent < 0 || commissionRatePercent > 100) {
      throw httpError(503, 'Seller commission settings require attention.');
    }
    const commissionAmountLkr = Math.round(itemsSubtotalLkr * commissionRatePercent) / 100;
    sellerGroups.push({ sellerId: seller._id, sellerName: seller.storeName, sellerSlug: seller.slug,
      sellerDistrict: seller.district, sellerType: seller.sellerType, items: groupItems, totalQuantity,
      itemsSubtotalLkr, deliveryFeeLkr: shipping.deliveryFeeLkr, shippingDetails: shipping, returnPolicies: groupItems.map(item => returnPolicy(settings, store.products.find(p => p._id === item.productId))),
      grossTotalLkr: itemsSubtotalLkr + shipping.deliveryFeeLkr, commissionRatePercent,
      commissionAmountLkr, netSellerEarningsLkr: itemsSubtotalLkr - commissionAmountLkr });
  }
  const itemsSubtotalLkr = sellerGroups.reduce((sum, group) => sum + group.itemsSubtotalLkr, 0);
  const totalDeliveryFeeLkr = sellerGroups.reduce((sum, group) => sum + group.deliveryFeeLkr, 0);
  const grandTotalLkr = itemsSubtotalLkr + totalDeliveryFeeLkr;
  const codMaxOrderLimitLkr = store.platformConfig.codMaxOrderLimitLkr ?? 75000;
  return { destinationDistrict, sellerCount: sellerGroups.length, sellerGroups, itemsSubtotalLkr,
    totalDeliveryFeeLkr, grandTotalLkr, codAvailable: codAvailable && grandTotalLkr <= codMaxOrderLimitLkr,
    codMaxOrderLimitLkr, policySnapshot: { version: store.platformConfig.businessVersion || 0, effectiveAt: store.platformConfig.businessEffectiveAt || null, cancelStatuses: settings.returns.cancelStatuses, cancelReasons: settings.returns.cancelReasons, returnReasons: settings.returns.returnReasons, refundMinDays: settings.returns.refundMinDays, refundMaxDays: settings.returns.refundMaxDays, taxMessage: settings.pricing.taxMessage } };
}
