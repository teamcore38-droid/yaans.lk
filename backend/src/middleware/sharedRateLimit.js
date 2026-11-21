import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { getJwtSecret } from './auth.js';
import { httpError } from '../config/errors.js';
import { recordRateLimitRejection } from '../config/operations.js';

export async function consumeLimit(scope, identity, maximum, windowMs, now = Date.now()) {
  await connectDatabase();
  const bucket = Math.floor(now / windowMs);
  const digest = createHmac('sha256', getJwtSecret()).update(String(identity).slice(0, 512)).digest('hex');
  const expiresAt = new Date((bucket + 1) * windowMs);
  const options = { upsert: true, returnDocument: 'after', includeResultMetadata: false, maxTimeMS: 2000 };
  const update = [{ $set: {
    hits: { $min: [{ $add: [{ $ifNull: ['$hits', 0] }, 1] }, maximum + 1] },
    rejected: { $min: [{ $add: [{ $ifNull: ['$rejected', 0] }, { $cond:[{ $gte:[{ $ifNull:['$hits',0] }, maximum] },1,0] }] },1048577] },
    expiresAt
  } }];
  let doc;
  try { doc = await mongoose.connection.db.collection('ratelimits').findOneAndUpdate({ _id: `${scope}:${bucket}:${digest}` }, update, options); }
  catch (error) {
    if (error.code !== 11000) throw error;
    doc = await mongoose.connection.db.collection('ratelimits').findOneAndUpdate({ _id: `${scope}:${bucket}:${digest}` }, update, { ...options, upsert: false });
  }
  if (doc.hits > maximum) await recordRateLimitRejection(scope, doc.rejected);
  return { allowed: doc.hits <= maximum, remaining: Math.max(0, maximum - doc.hits), retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) };
}

export function rateLimitError(retryAfter) {
  const error = httpError(429, 'Too many requests. Please wait and try again.', 'RATE_LIMITED');
  error.retryAfter = Math.max(1, Math.ceil(retryAfter));
  return error;
}

export function sendRateLimited(res, retryAfter) {
  const seconds = Math.max(1, Math.ceil(retryAfter));
  res.set({ 'Retry-After':String(seconds), 'Cache-Control':'private, no-store' });
  return res.status(429).json({ code:'RATE_LIMITED', retryAfter:seconds, message:'Too many requests. Please wait and try again.' });
}

export function sharedRateLimit(scope, maximum, windowMs, identity = (req) => req.ip || req.socket?.remoteAddress || 'unknown') {
  return async (req, res, next) => {
    try {
      const limit = await consumeLimit(scope, identity(req), maximum, windowMs);
      if (!limit.allowed) {
        return sendRateLimited(res, limit.retryAfter);
      }
      next();
    } catch { next(httpError(503, 'Request protection is temporarily unavailable. Please retry shortly.')); }
  };
}

export const loginIpLimit = sharedRateLimit('login-ip', 30, 15 * 60000);
export const loginAccountLimit = sharedRateLimit('login-account', 10, 15 * 60000, (req) => String(req.body?.email || '').trim().toLowerCase());
export const adminAccountLimit = sharedRateLimit('admin-account', 5, 15 * 60000, (req) => String(req.body?.email || '').trim().toLowerCase());
export const uploadLimit = sharedRateLimit('upload', 30, 15 * 60000, (req) => req.user?._id || req.ip);

export const searchLimit = sharedRateLimit('catalog-search', 120, 60000);
export const quoteLimit = sharedRateLimit('cart-quote', 120, 60000);
export const bulkImportLimit = sharedRateLimit('seller-bulk-import', 5, 15 * 60000, req => req.user._id);
export const documentLimit = sharedRateLimit('order-documents', 60, 60000, req => req.user?._id || req.ip);
const credentialIpLimit = sharedRateLimit('credential-ip', 30, 15 * 60000);
const credentialAccountLimit = sharedRateLimit('credential-account', 5, 15 * 60000, req => req.user._id);
export function credentialChangeLimit(req, res, next) {
  const changingEmail = typeof req.body.newEmail === 'string' && req.body.newEmail.trim().toLowerCase() !== req.user.email.toLowerCase();
  if (!req.body.newPassword && !changingEmail) return next();
  return credentialIpLimit(req, res, error => error ? next(error) : credentialAccountLimit(req, res, next));
}
