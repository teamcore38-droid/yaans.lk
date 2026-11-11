import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { revokedCredentialDigests } from '../config/revokedCredentials.js';
import { findUserById } from '../config/db.js';
import { httpError } from '../config/errors.js';

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

export function signToken(user) {
  if (user.role === 'admin') return signAdminToken(user);
  return jwt.sign({ id: user._id, version: 2, tokenVersion: user.tokenVersion || 0 }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: '7d', issuer: 'yaans.lk', audience: 'yaans.lk'
  });
}

export function signAdminToken(user) {
  return jwt.sign({ id: user._id, version: 2, tokenVersion: user.tokenVersion || 0, isAdminSession: true }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: '6h', issuer: 'yaans.lk', audience: 'yaans.lk'
  });
}

async function resolveAuthentication(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw httpError(401, 'Please sign in.');
  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), getJwtSecret(), { algorithms: ['HS256'], issuer: 'yaans.lk', audience: 'yaans.lk' });
  } catch (error) {
    if (error.status === 503) throw error;
    throw httpError(401, 'Invalid or expired authentication token.');
  }
  if (decoded.version !== 2 || typeof decoded.id !== 'string') throw httpError(401, 'Please sign in again.');
  const user = await findUserById(decoded.id);
  if (!user || user.isActive === false || credentialsRevoked(user) || decoded.tokenVersion !== (user.tokenVersion || 0) ||
      (user.role === 'admin' && (!decoded.isAdminSession || await usesDefaultAdminPassword(user)))) {
    throw httpError(401, 'User account not found, inactive, or session expired.');
  }
  req.user = user;
}

export async function authenticate(req, _res, next) {
  try { await resolveAuthentication(req); next(); } catch (error) { next(error); }
}

export async function optionalAuthenticate(req, _res, next) {
  if (!req.headers.authorization) return next();
  try { await resolveAuthentication(req); next(); } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}.` });
    next();
  };
}
