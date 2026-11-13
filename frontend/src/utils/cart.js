// Browser storage is untrusted. Keep selections within the quote API's limits;
// prices and availability are always checked by the server.
export function normalizeSavedCart(value) {
  if (!Array.isArray(value)) return [];
  const lines = new Map();
  for (const item of value) {
    if (!item || typeof item.productId !== 'string' || !item.productId || item.productId.length > 128) continue;
    const quantity = typeof item.quantity === 'string' && /^\d{1,2}$/.test(item.quantity)
      ? Number(item.quantity) : item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) continue;
    if (item.variantLabel != null && (typeof item.variantLabel !== 'string' || item.variantLabel.length > 120)) continue;
    const variantLabel = item.variantLabel || 'Standard';
    const key = JSON.stringify([item.productId, variantLabel]);
    const existing = lines.get(key);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity);
    } else if (lines.size < 50) {
      const text = (field, fallback = '') => typeof item[field] === 'string' ? item[field] : fallback;
      lines.set(key, {
        productId: item.productId, variantLabel, quantity,
        title: text('title', 'Saved product'), slug: text('slug'), image: text('image'),
        sellerId: text('sellerId'), sellerName: text('sellerName'), sellerDistrict: text('sellerDistrict'),
        isHomemade: item.isHomemade === true,
        unitPriceLkr: Number.isFinite(item.unitPriceLkr) && item.unitPriceLkr > 0 ? item.unitPriceLkr : null
      });
    }
  }
  return [...lines.values()];
}
