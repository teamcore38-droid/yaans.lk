export function packageReceiptPath(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    ? `/package-receipt/${id}`
    : null;
}
