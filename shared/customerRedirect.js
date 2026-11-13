import { isSafeInternalLink } from './safeLinks.js';

// OAuth and password login may only return to customer-facing pages.
export function customerRedirect(value, fallback = '/account') {
  if (!isSafeInternalLink(value)) return fallback;
  const pathname = new URL(value, 'https://yaans.lk').pathname;
  return /^(?:\/$|\/(?:account|checkout|cart|wishlist|products)$|\/(?:product|store)\/[^/]+$)/.test(pathname) ? value : fallback;
}
