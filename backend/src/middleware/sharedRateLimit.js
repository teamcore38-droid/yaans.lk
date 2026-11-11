import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { getJwtSecret } from './auth.js';
import { httpError } from '../config/errors.js';

export async function consumeLimit(scope, identity, maximum, windowMs, now = Date.now()) {
  await connectDatabase();
  const bucket = Math.floor(now / windowMs);
  const digest = createHmac('sha256', getJwtSecret()).update(String(identity).slice(0, 512)).digest('hex');
  const expiresAt = new Date((bucket + 1) * windowMs);
  const options = { upsert: true, returnDocument: 'after', includeResultMetadata: false, maxTimeMS: 2000 };
  const update = [{ $set: { hits: { $min: [{ $add: [{ $ifNull: ['$hits', 0] }, 1] }, maximum + 1] }, expiresAt } }];
  let doc;
  try { doc = await mongoose.connection.db.collection('ratelimits').findOneAndUpdate({ _id: `${scope}:${bucket}:${digest}` }, update, options); }
  catch (error) {
    if (error.code !== 11000) throw error;
    doc = await mongoose.connection.db.collection('ratelimits').findOneAndUpdate({ _id: `${scope}:${bucket}:${digest}` }, update, { ...options, upsert: false });
  }
  return { allowed: doc.hits <= maximum, remaining: Math.max(0, maximum - doc.hits), retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) };
}

export function sharedRateLimit(scope, maximum, windowMs, identity = (req) => req.ip || req.socket?.remoteAddress || 'unknown') {
  return async (req, res, next) => {
    try {
      const limit = await consumeLimit(scope, identity(req), maximum, windowMs);
      if (!limit.allowed) {
        res.set('Retry-After', String(limit.retryAfter));
        return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' });
      }
      next();
    } catch { next(httpError(503, 'Request protection is temporarily unavailable. Please retry shortly.')); }
  };
}

export const loginIpLimit = sharedRateLimit('login-ip', 30, 15 * 60000);
export const loginAccountLimit = sharedRateLimit('login-account', 10, 15 * 60000, (req) => String(req.body?.email || '').trim().toLowerCase());
export const adminAccountLimit = sharedRateLimit('admin-account', 5, 15 * 60000, (req) => String(req.body?.email || '').trim().toLowerCase());
export const uploadLimit = sharedRateLimit('upload', 30, 15 * 60000, (req) => req.user?._id || req.ip);
