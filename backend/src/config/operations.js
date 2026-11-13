import mongoose from 'mongoose';

const initializations = new WeakMap();
export function ensureOperationalIndexes(db) {
  if (!initializations.has(db)) initializations.set(db, (async () => {
    await db.collection('users').createIndex({ googleSubject: 1 }, { unique: true, partialFilterExpression: { googleSubject: { $type: 'string' } }, name: 'google_identity_unique' });
    await db.collection('authchallenges').createIndex({ browser: 1 }, { sparse: true, name: 'google_browser_challenges' });
    await db.collection('suborders').createIndex({ 'items.productId': 1, 'items.variantLabel': 1, fulfillmentStatus: 1 }, { name: 'staff_variant_order_guard' });
    await db.collection('staffsessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'staff_session_expiry' });
    await db.collection('staffsessions').createIndex({ userId: 1 }, { name: 'staff_session_user' });
    await db.collection('users').createIndex({ role: 1, _id: 1 }, { name: 'staff_roster' });
    await db.collection('users').createIndex({ role: 1, isActive: 1, _id: 1 }, { name: 'staff_accounts' });
    await db.collection('orders').createIndex({ createdAt: -1, _id: -1 }, { name: 'staff_orders_recent' });
    await db.collection('ordernotifications').createIndex({ recipient: 1, readAt: 1, createdAt: -1, _id: -1 }, { name: 'order_notification_inbox' });
    await db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_expiry' });
    await db.collection('operationalmetrics').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'operational_metric_expiry' });
    await db.collection('securityevents').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'security_event_expiry' });
    await db.collection('securityevents').createIndex({ createdAt: -1 }, { name: 'security_event_recent' });
    await db.collection('authchallenges').createIndex({ expiresAt: 1 }, { expireAfterSeconds:0, name:'auth_challenge_expiry' });
  })().catch((error) => { initializations.delete(db); throw error; }));
  return initializations.get(db);
}

export async function recordOperationalEvent(name) {
  if (!['checkout_success', 'checkout_rejected', 'checkout_failure', 'database_error', 'server_error'].includes(name)) throw new Error('Unknown operational event');
  console.log('[Yaans operation]', { event: name });
  if (mongoose.connection.readyState !== 1) return;
  const bucket = Math.floor(Date.now() / 300000) * 300000;
  try {
    await mongoose.connection.db.collection('operationalmetrics').updateOne({ _id: `${name}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { name, bucket: new Date(bucket), expiresAt: new Date(bucket + 7 * 86400000) } },
      { upsert: true, maxTimeMS: 1000 });
  } catch { console.error('[Yaans operation]', { event: 'metric_write_failed', originalEvent: name }); }
}

export async function operationalStatus() {
  const since = new Date(Date.now() - 60 * 60000);
  const metrics = await mongoose.connection.db.collection('operationalmetrics').aggregate([
    { $match: { bucket: { $gte: since } } }, { $group: { _id: '$name', count: { $sum: '$count' } } }
  ], { maxTimeMS: 3000 }).toArray();
  const counts = Object.fromEntries(metrics.map(({ _id, count }) => [_id, count]));
  // Only the private monitoring endpoint receives these aggregate counts.
  const security = await mongoose.connection.db.collection('securityevents').aggregate([
    { $match: { createdAt: { $gte: since }, event: { $in: ['login_failed', 'admin_login_failed', 'admin_mfa_login_failed', 'authentication_denied', 'authorization_denied'] } } },
    { $group: { _id: '$event', count: { $sum: 1 } } }
  ], { maxTimeMS: 3000 }).toArray();
  const securityCounts = Object.fromEntries(security.map(({ _id, count }) => [_id, count]));
  const alerts = [];
  if ((counts.checkout_failure || 0) >= 3) alerts.push('checkout_failures');
  if ((counts.database_error || 0) >= 3) alerts.push('database_errors');
  if ((counts.server_error || 0) >= 5) alerts.push('server_errors');
  if ((securityCounts.admin_login_failed || 0) + (securityCounts.admin_mfa_login_failed || 0) >= 5) alerts.push('admin_authentication_failures');
  if ((securityCounts.login_failed || 0) >= 20) alerts.push('login_failures');
  if ((securityCounts.authentication_denied || 0) + (securityCounts.authorization_denied || 0) >= 30) alerts.push('access_denials');
  return { status: alerts.length ? 'degraded' : 'ok', windowMinutes: 60, counts, securityCounts, alerts };
}
