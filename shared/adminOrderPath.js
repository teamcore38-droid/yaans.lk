export function adminOrderPath(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    ? `/admin/orders/${id}`
    : null;
}
