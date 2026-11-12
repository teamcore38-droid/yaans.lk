export function assessCapacitySample({ routes, statuses = {}, unexpectedErrors = 0, aborted = false }) {
  const breaches = [];
  if (!routes || !Object.values(routes).some((route) => route.requests > 0)) breaches.push('no_samples');
  if (unexpectedErrors) breaches.push('unexpected_errors');
  if (statuses['429']) breaches.push('rate_limited');
  if (aborted) breaches.push('stop_condition');
  for (const kind of ['catalog', 'search', 'home', 'detail', 'quote']) {
    if (routes?.[kind]?.requests > 0 && (!Number.isFinite(routes[kind].p95Ms) || routes[kind].p95Ms >= 1000)) breaches.push(`${kind}_p95`);
  }
  if (routes?.checkout?.requests > 0 && (!Number.isFinite(routes.checkout.p95Ms) || routes.checkout.p95Ms >= 2000)) breaches.push('checkout_p95');
  return { passed: breaches.length === 0, breaches };
}
