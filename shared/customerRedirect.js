import { isSafeInternalLink } from './safeLinks.js';

// OAuth and password login may only return to customer-facing pages.
export function customerRedirect(value, fallback = '/account') {
  // Encoded spaces are ordinary search terms; keep strict path/control checks.
  const query = typeof value === 'string' ? value.indexOf('?') : -1;
  const checked = query < 0 ? value : value.slice(0, query) + value.slice(query).replace(/%20/gi, '+');
  if (!isSafeInternalLink(checked)) return fallback;
  const pathname = new URL(value, 'https://yaans.lk').pathname;
  return /^(?:\/$|\/(?:account|checkout|cart|wishlist|products)$|\/(?:product|store)\/[^/]+$)/.test(pathname) ? value : fallback;
}

export function customerAuthPath(page, returnTo) {
  const path = page === 'register' ? '/register' : '/login';
  return `${path}?redirect=${encodeURIComponent(customerRedirect(returnTo))}`;
}

export function customerReturnFromLocation({ pathname, search = '' }) {
  return customerRedirect(['/login', '/register'].includes(pathname)
    ? new URLSearchParams(search).get('redirect') : `${pathname}${search}`);
}
