const API_BASE = import.meta.env?.VITE_API_URL || '/api';
const responses = new Map();
const pendingRequests = new Map();
const STORAGE_PREFIX = 'yaans_catalog_v1:';
const MAX_CACHE_ENTRIES = 40;
let cacheGeneration = 0;

function catalogKey(endpoint) {
  const url = new URL(endpoint, 'http://catalog.local');
  if (!/^\/marketplace\/(home|categories|districts|products(?:\/[^/]+)?|sellers\/[^/]+)$/.test(url.pathname)) {
    return null;
  }
  url.searchParams.sort();
  return `${url.pathname}${url.search}`;
}

export function getCachedApiResponse(endpoint) {
  const key = catalogKey(endpoint);
  if (!key) return null;
  let entry = responses.get(key);
  // Keep the first screen warm across reloads, without storing account/order data.
  if (!entry && (key === '/marketplace/home' || key === '/marketplace/categories')) {
    try {
      entry = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}${key}`));
    } catch { /* Storage can be unavailable or full. */ }
  }
  if (!entry || entry.expiresAt <= Date.now()) {
    responses.delete(key);
    try { sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`); } catch { /* Storage is optional. */ }
    return null;
  }
  if (!responses.has(key)) {
    responses.set(key, entry);
    if (responses.size > MAX_CACHE_ENTRIES) responses.delete(responses.keys().next().value);
  }
  return entry.data;
}

function cacheResponse(key, data) {
  const ttl = key === '/marketplace/categories' ? 60000 : 15000;
  const entry = { data, expiresAt: Date.now() + ttl };
  responses.delete(key);
  responses.set(key, entry);
  if (responses.size > MAX_CACHE_ENTRIES) responses.delete(responses.keys().next().value);
  if (key === '/marketplace/home' || key === '/marketplace/categories') {
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length < 128000) sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
      else sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch { /* Caching must never prevent navigation. */ }
  }
}

export function invalidateCatalogCache() {
  cacheGeneration++;
  responses.clear();
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}/marketplace/home`);
    sessionStorage.removeItem(`${STORAGE_PREFIX}/marketplace/categories`);
  } catch { /* Storage can be unavailable. */ }
}

export function formatLkr(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString('en-LK')}`;
}

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const publicKey = method === 'GET' && !options.headers ? catalogKey(endpoint) : null;
  const canCache = publicKey && options.cache !== 'no-store' && options.cache !== 'reload';
  if (canCache) {
    const cached = getCachedApiResponse(endpoint);
    if (cached) return cached;
  }
  // Public catalog responses are identical for guests and signed-in users.
  const token = publicKey ? null : localStorage.getItem('yaans_token');
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const generation = cacheGeneration;
  const requestKey = `${generation}:${publicKey || endpoint}:${token || ''}`;
  const canShare = method === 'GET' && !options.signal && !options.headers && options.cache !== 'no-store' && options.cache !== 'reload';
  if (canShare && pendingRequests.has(requestKey)) return pendingRequests.get(requestKey);

  const request = (async () => {
    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.code = data.code;
      throw error;
    }
    if (publicKey && options.cache !== 'no-store' && generation === cacheGeneration) {
      cacheResponse(publicKey, data);
      if (publicKey === '/marketplace/home' && data.categories) {
        cacheResponse('/marketplace/categories', { categories: data.categories });
      }
    }
    if (method !== 'GET' && method !== 'HEAD' && endpoint !== '/orders/quote' && endpoint !== '/auth/login') {
      invalidateCatalogCache();
    }
    return data;
  })();
  if (canShare) pendingRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (canShare && pendingRequests.get(requestKey) === request) pendingRequests.delete(requestKey);
  }
}
