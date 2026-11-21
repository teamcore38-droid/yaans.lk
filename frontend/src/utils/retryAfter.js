export function retryAfterSeconds(value, now = Date.now()) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if(!/^\d+$/.test(text)&&!/^\w{3}, .+ GMT$/i.test(text))return null;
  const seconds = /^\d+$/.test(text) ? Number(text) : (Date.parse(text) - now) / 1000;
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(1, Math.ceil(seconds))) : null;
}

export function rateLimitFailure(seconds) {
  const error = new Error(`Too many requests. Try this action again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`);
  error.status = 429;
  error.code = 'RATE_LIMITED';
  error.retryAfter = seconds;
  error.retryAt = Date.now() + seconds * 1000;
  return error;
}

export function announceRateLimit(error) {
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('yaans:rate-limited', { detail: { retryAt:error.retryAt } }));
  }
}

export function apiFailure(response, data = {}) {
  if (response.status === 429) {
    const seconds = retryAfterSeconds(response.headers?.get?.('Retry-After')) ?? retryAfterSeconds(data.retryAfter) ?? 30;
    const error = rateLimitFailure(seconds);
    announceRateLimit(error);
    return error;
  }
  const error = new Error(data.message || `Request failed (${response.status})`);
  error.status = response.status;
  error.code = data.code;
  return error;
}
