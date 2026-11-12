import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { httpError } from '../config/errors.js';

export const STAFF_SESSION_SECONDS = 8 * 3600;
export const STAFF_IDLE_MS = 30 * 60000;
export async function createStaffSession(user) {
  const _id = randomUUID(), now = new Date();
  await mongoose.connection.db.collection('staffsessions').insertOne({ _id, userId: user._id,
    lastActiveAt: now, expiresAt: new Date(now.getTime() + STAFF_SESSION_SECONDS * 1000) });
  return _id;
}
export async function verifyStaffSession(decoded, user, req) {
  if (!decoded.isStaffSession || typeof decoded.staffSessionId !== 'string') throw httpError(401, 'Sign in through Staff Login.');
  const session = await mongoose.connection.db.collection('staffsessions').findOne({ _id: decoded.staffSessionId,
    userId: user._id, expiresAt: { $gt: new Date() }, lastActiveAt: { $gt: new Date(Date.now() - STAFF_IDLE_MS) } }, { maxTimeMS: 2000 });
  if (!session) throw httpError(401, 'Your staff session expired or locked after inactivity. Please sign in again.');
  const path = req.originalUrl.split('?')[0];
  const accountPaths = ['/api/auth/me', '/api/auth/logout', '/api/auth/staff/password'];
  if (user.staffMustChangePassword && !accountPaths.includes(path)) throw httpError(403, 'Change your temporary password before accessing orders.', 'STAFF_PASSWORD_REQUIRED');
  if (!accountPaths.includes(path) && path !== '/api/auth/staff/activity' &&
      !path.startsWith('/api/staff/') && !path.startsWith('/api/notifications')) throw httpError(403, 'Order Staff access only.');
  req.staffSessionId = decoded.staffSessionId;
}
export async function touchStaffSession(req) {
  const now = new Date();
  const result = await mongoose.connection.db.collection('staffsessions').updateOne({ _id: req.staffSessionId,
    userId: req.user._id, expiresAt: { $gt: now }, lastActiveAt: { $gt: new Date(now.getTime() - STAFF_IDLE_MS) } },
    { $max: { lastActiveAt: now } }, { maxTimeMS: 2000 });
  if (!result.matchedCount) throw httpError(401, 'Your staff session has expired. Please sign in again.');
}
