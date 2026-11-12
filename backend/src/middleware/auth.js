import { verifyStaffSession, STAFF_SESSION_SECONDS } from '../services/staffSessions.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { revokedCredentialDigests } from '../config/revokedCredentials.js';
import { findUserById } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { readCookies, cookieNames, assertCsrf, newCsrfToken } from '../config/sessionCookies.js';
import { recordSecurityEvent } from '../config/securityEvents.js';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'yaans_lk_sri_lanka_marketplace_jwt_secret_2026') {
    throw httpError(503, 'Authentication is not configured securely.');
  }
  return secret;
}

export async function usesDefaultAdminPassword(user) {
  return credentialsRevoked(user) || (user?.role === 'admin' && await bcrypt.compare('Admin@123', user.passwordHash || ''));
}

export function credentialsRevoked(user) {
  return typeof user?.passwordHash === 'string' && revokedCredentialDigests.has(createHash('sha256').update(user.passwordHash).digest('hex'));
}

export function signToken(user, csrf = newCsrfToken(), staffSessionId) {
  if (user.role === 'admin') return signAdminToken(user, csrf);
  if (user.role === 'staff' && !staffSessionId) throw httpError(401, 'Staff session required.');
  return jwt.sign({ id: user._id, version: 3, tokenVersion: user.tokenVersion || 0, csrf,
    ...(user.role === 'staff' ? { isStaffSession: true, staffSessionId } : {}) }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: user.role === 'staff' ? STAFF_SESSION_SECONDS : '24h', issuer: 'yaans.lk', audience: 'yaans.lk'
  });
}

export function signAdminToken(user, csrf = newCsrfToken()) {
  return jwt.sign({ id: user._id, version: 3, tokenVersion: user.tokenVersion || 0, isAdminSession: true, csrf,
    mfa: Boolean(user.adminMfa?.enabled) }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: '1h', issuer: 'yaans.lk', audience: 'yaans.lk'
  });
}

async function resolveAuthentication(req) {
  const header = req.headers.authorization;
  const cookies = readCookies(req);
  const cookieToken = cookies[cookieNames().session];
  const isCookie = header === undefined && Boolean(cookieToken);
  if (!isCookie && (typeof header !== 'string' || !header.startsWith('Bearer '))) throw httpError(401, 'Please sign in.');
  let decoded;
  try {
    decoded = jwt.verify(isCookie ? cookieToken : header.slice(7), getJwtSecret(), { algorithms: ['HS256'], issuer: 'yaans.lk', audience: 'yaans.lk' });
  } catch (error) {
    if (error.status === 503) throw error;
    throw httpError(401, 'Invalid or expired authentication token.');
  }
  if (decoded.version !== 3 || typeof decoded.id !== 'string') throw httpError(401, 'Please sign in again.');
  if (isCookie) assertCsrf(req, decoded);
  const user = await findUserById(decoded.id);
  if (!user || user.isActive === false || credentialsRevoked(user) || decoded.tokenVersion !== (user.tokenVersion || 0) ||
      (user.role === 'admin' && (!decoded.isAdminSession || (user.adminMfa?.enabled && decoded.mfa !== true) || await usesDefaultAdminPassword(user)))) {
    throw httpError(401, 'User account not found, inactive, or session expired.');
  }
  if (user.role === 'staff') await verifyStaffSession(decoded, user, req);
  req.user = user;
}

export async function authenticate(req, _res, next) {
  try { await resolveAuthentication(req); next(); } catch (error) {
    await recordSecurityEvent('authentication_denied', { ip:req.ip, outcome:'denied' }); next(error);
  }
}

export async function optionalAuthenticate(req, _res, next) {
  if (!req.headers.authorization && !readCookies(req)[cookieNames().session]) return next();
  try { await resolveAuthentication(req); next(); } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      await recordSecurityEvent('authorization_denied', { userId:req.user._id, role:req.user.role, ip:req.ip, outcome:'denied' });
      return res.status(403).json({ message: 'Access denied.' });
    }
    next();
  };
}
