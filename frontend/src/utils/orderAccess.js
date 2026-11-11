const pendingName = 'yaans_checkout_pending_v1';
const guestPrefix = 'yaans_guest_order_access_v1:';
const fallbackKeys = new Map();

export function checkoutKey() {
  const name = pendingName;
  let existing;
  try { existing = sessionStorage.getItem(name) || fallbackKeys.get(name); } catch { existing = fallbackKeys.get(name); }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || '')) return existing;
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(name, key); } catch { fallbackKeys.set(name, key); }
  return key;
}

export function clearCheckoutKey() {
  const name = pendingName;
  try { sessionStorage.removeItem(name); } catch { /* In-memory fallback below. */ }
  fallbackKeys.delete(name);
}

export function rememberGuestAccess(orderNumber, token) {
  if (!orderNumber || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) return;
  try { sessionStorage.setItem(`${guestPrefix}${orderNumber}`, token); } catch { /* Confirmation still displays the code. */ }
}

export function guestAccess(orderNumber) {
  try { return sessionStorage.getItem(`${guestPrefix}${orderNumber}`) || ''; } catch { return ''; }
}
