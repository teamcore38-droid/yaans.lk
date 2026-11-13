const key = 'yaans_checkout_draft_v1';
const lifetime = 30 * 60000;
export const beforeCustomerAuth = 'yaans:before-customer-auth';
const limits = { recipientName: 120, phone: 32, customerEmail: 254, addressLine1: 256, addressLine2: 256, city: 120, postalCode: 20, deliveryNotes: 500, district: 80 };

function cartIdentity(items) {
  return JSON.stringify(items.map(item => [item.productId, item.variantLabel || '', item.quantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export function clearCheckoutDraft() {
  try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
}

function storedDraft() {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    if (raw.length > 6000) throw new Error('Oversized draft');
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== 1 || typeof draft.owner !== 'string' || typeof draft.cart !== 'string' ||
        !Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now() || draft.expiresAt > Date.now() + lifetime ||
        !draft.fields || typeof draft.fields !== 'object' || Array.isArray(draft.fields)) throw new Error('Invalid draft');
    for (const [field, maximum] of Object.entries(limits)) {
      if (typeof draft.fields[field] !== 'string' || draft.fields[field].length > maximum || /[\u0000-\u001f\u007f]/.test(draft.fields[field])) throw new Error('Invalid draft field');
    }
    return draft;
  } catch { clearCheckoutDraft(); return null; }
}

// Save only on an explicit auth navigation, never every keystroke or in localStorage.
export function saveCheckoutDraft(items, user, fields) {
  if (!items.length || (user && user.role !== 'customer')) return clearCheckoutDraft();
  const clean = Object.fromEntries(Object.entries(limits).map(([field, maximum]) => [field, String(fields[field] || '').slice(0, maximum).replace(/[\u0000-\u001f\u007f]/g, '')]));
  try { sessionStorage.setItem(key, JSON.stringify({ version: 1, owner: user?._id || 'guest', cart: cartIdentity(items), expiresAt: Date.now() + lifetime, fields: clean })); }
  catch { clearCheckoutDraft(); }
}

export function readCheckoutDraft(items, user) {
  const draft = storedDraft();
  if (!draft) return null;
  if (draft.cart !== cartIdentity(items) || (user && user.role !== 'customer') ||
      (draft.owner !== 'guest' && draft.owner !== user?._id)) return null;
  return draft.fields;
}

// A guest's explicit sign-in may resume checkout; one account's draft never transfers to another.
export function bindCheckoutDraft(user) {
  const draft = storedDraft();
  if (!draft) return;
  if (user?.role !== 'customer' || (draft.owner !== 'guest' && draft.owner !== user._id)) return clearCheckoutDraft();
  try { sessionStorage.setItem(key, JSON.stringify({ ...draft, owner: user._id })); } catch { clearCheckoutDraft(); }
}

export function prepareCustomerAuth() {
  window.dispatchEvent(new Event(beforeCustomerAuth));
}
