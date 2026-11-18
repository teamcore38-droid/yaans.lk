// Checkout still quotes and validates every selection on the server. The URL only
// carries bounded product references, never prices or trusted product details.
export function buyNowPath(product, variantLabel = null, quantity = 1) {
  const selection = new URLSearchParams({
    buyNow: product._id,
    variant: variantLabel || product.variants?.[0]?.values?.[0]?.label || 'Standard',
    quantity: String(quantity)
  });
  return `/checkout?${selection.toString()}`;
}

export function readBuyNowSelection(search) {
  const params = new URLSearchParams(search);
  if (!params.has('buyNow')) return null;
  const productId = params.get('buyNow');
  const variantLabel = params.get('variant');
  const rawQuantity = params.get('quantity');
  const quantity = Number(rawQuantity);
  if (!productId || productId.length > 128 || !variantLabel || variantLabel.length > 120 ||
      !/^[1-9]\d?$/.test(rawQuantity || '') || !Number.isSafeInteger(quantity)) return [];
  return [{ productId, variantLabel, quantity }];
}
