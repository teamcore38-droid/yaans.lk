import mongoose from 'mongoose';

const initializations = new WeakMap();
export function ensureOperationalIndexes(db) {
  if (!initializations.has(db)) initializations.set(db, (async () => {
    await db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_expiry' });
    await db.collection('operationalmetrics').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'operational_metric_expiry' });
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
  const alerts = [];
  if ((counts.checkout_failure || 0) >= 3) alerts.push('checkout_failures');
  if ((counts.database_error || 0) >= 3) alerts.push('database_errors');
  if ((counts.server_error || 0) >= 5) alerts.push('server_errors');
  return { status: alerts.length ? 'degraded' : 'ok', windowMinutes: 60, counts, alerts };
}
