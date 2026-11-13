import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { getStore, persistStore, withTransaction, generateId, idFilter } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { stringField, validateNewPassword } from '../config/inputValidation.js';
import { readCookies, setSessionCookies, newCsrfToken } from '../config/sessionCookies.js';
import { getJwtSecret, signToken, credentialsRevoked, optionalAuthenticate } from '../middleware/auth.js';
import { sharedRateLimit, consumeLimit } from '../middleware/sharedRateLimit.js';
import { recordSecurityEvent } from '../config/securityEvents.js';
import { customerRedirect } from '../../../shared/customerRedirect.js';

const lifetime = 10 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
const deployed = () => process.env.NODE_ENV === 'production' || ['production', 'preview'].includes(process.env.VERCEL_ENV);
const cookieName = () => deployed() ? '__Host-yaans_google' : 'yaans_google';
const cookieOptions = () => ({ httpOnly: true, secure: deployed(), sameSite: 'lax', path: '/', maxAge: lifetime });
const clearGoogleCookie = res => { const { maxAge: _maxAge, ...options } = cookieOptions(); res.clearCookie(cookieName(), options); };
const challenges = () => mongoose.connection.db.collection('authchallenges');

export function googleConfiguration() {
  if (process.env.GOOGLE_LOGIN_ENABLED !== 'true') return null;
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_LOGIN_ORIGIN: origin } = process.env;
  try {
    const url = new URL(origin);
    const local = !deployed() && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.origin !== origin || url.username || url.password || (!local && url.protocol !== 'https:') ||
        !['https:', 'http:'].includes(url.protocol) || !clientId?.endsWith('.apps.googleusercontent.com') || !clientSecret) return null;
    return { clientId, clientSecret, origin, redirectUri: `${origin}/api/auth/google/callback` };
  } catch { return null; }
}

function configuration() {
  const config = googleConfiguration();
  if (!config) throw httpError(503, 'Google sign-in is not available. Please use email and password.');
  if (process.env.MAINTENANCE_READ_ONLY === 'true') throw httpError(503, 'Account changes are temporarily paused. Please try again later.');
  getJwtSecret();
  return config;
}

function sameOrigin(req, config) {
  if (req.headers.origin !== config.origin || req.headers['x-yaans-client'] !== 'browser') throw httpError(403, 'Start Google sign-in from the Yaans website.');
}

function browserProof(req) {
  const value = readCookies(req)[cookieName()];
  if (typeof value !== 'string' || !/^[\w-]{43}$/.test(value)) throw httpError(401, 'Google sign-in expired. Please start again.');
  return digest(value);
}

function allowedCustomer(user) {
  if (!user || user.role !== 'customer' || user.isActive !== true || credentialsRevoked(user)) throw httpError(403, 'This account cannot use customer Google sign-in. Use your usual login or contact support.');
}

export function validateGoogleIdentity(payload, nonce) {
  if (!payload || !equal(payload.nonce, nonce) || typeof payload.sub !== 'string' || !/^[\w-]{1,255}$/.test(payload.sub) ||
      payload.email_verified !== true || typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw httpError(401, 'Google could not verify this sign-in. Please start again.');
  }
  return { subject: payload.sub, email: payload.email.trim().toLowerCase(), name: typeof payload.name === 'string' ? payload.name.slice(0, 120).replace(/[\u0000-\u001f]/g, '').trim() : '' };
}

// Reuse the verification client (and Google's cached signing certificates), never user credentials.
let verifier;
export async function exchangeGoogleCode(config, code, attempt) {
  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri, transporterOptions: { timeout: 8000, retry: false } });
  const { tokens } = await client.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: config.redirectUri });
  if (!tokens.id_token) throw httpError(401, 'Google did not return proof of identity.');
  verifier ||= new OAuth2Client({ transporterOptions: { timeout: 8000, retry: false } });
  const ticket = await verifier.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  return validateGoogleIdentity(ticket.getPayload(), attempt.nonce);
}

async function pending(req) {
  const proof = browserProof(req);
  const record = await challenges().findOne({ _id: `google-pending:${proof}`, expiresAt: { $gt: new Date() } });
  if (!record) throw httpError(401, 'Google sign-in expired. Please start again.');
  return record;
}

function establishSession(res, user) {
  const csrf = newCsrfToken();
  setSessionCookies(res, signToken(user, csrf), csrf, false);
}

export function mountGoogleLogin(router, issueSession) {
  router.get('/google/config', (_req, res) => res.json({ enabled: Boolean(googleConfiguration()) && process.env.MAINTENANCE_READ_ONLY !== 'true', origin: googleConfiguration()?.origin || null }));

  router.post('/google/start', sharedRateLimit('google-start-ip', 30, 15 * 60000), optionalAuthenticate, async (req, res) => {
    const config = configuration(); sameOrigin(req, config);
    const purpose = req.body.purpose === 'set-password' ? 'set-password' : 'login';
    if (req.user) allowedCustomer(req.user);
    if (purpose === 'set-password' && (!req.user?.googleSubject || req.user.passwordHash)) throw httpError(403, 'A Google-only customer account is required.');
    const { OAuth2Client, CodeChallengeMethod } = await import('google-auth-library');
    const client = new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = random(), proof = random(), nonce = random();
    // Starting again invalidates this browser's previous pending flow.
    const old = readCookies(req)[cookieName()];
    if (typeof old === 'string') await challenges().deleteMany({ browser: digest(old) });
    await challenges().insertOne({ _id: `google-state:${digest(state)}`, browser: digest(proof), nonce, codeVerifier,
      purpose, userId: req.user?._id || null, tokenVersion: req.user?.tokenVersion || 0,
      returnTo: customerRedirect(req.body.returnTo), expiresAt: new Date(Date.now() + lifetime) });
    res.cookie(cookieName(), proof, cookieOptions());
    const url = client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], access_type: 'online', prompt: 'select_account', state, nonce,
      code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256 });
    return res.json({ url });
  });

  router.get('/google/callback', sharedRateLimit('google-callback-ip', 30, 15 * 60000), async (req, res) => {
    const config = configuration();
    res.set('Referrer-Policy', 'no-referrer');
    try {
      const proof = browserProof(req);
      const state = stringField(req.query.state, 'state', { required: true, maximum: 128 });
      const attempt = await challenges().findOneAndDelete({ _id: `google-state:${digest(state)}`, browser: proof, expiresAt: { $gt: new Date() } });
      if (!attempt) throw httpError(401, 'Google sign-in expired.');
      if (req.query.error) throw httpError(401, 'Google sign-in was cancelled.');
      const code = stringField(req.query.code, 'code', { required: true, maximum: 4096 });
      const identity = await exchangeGoogleCode(config, code, attempt);
      const store = await getStore({ users: { $or: [{ googleSubject: identity.subject }, { email: identity.email }] } });
      const linked = store.users.find(user => user.googleSubject === identity.subject);
      const existing = linked || store.users.find(user => user.email === identity.email);
      if (existing) allowedCustomer(existing);
      if (attempt.userId && (existing?._id !== attempt.userId || (existing.tokenVersion || 0) !== attempt.tokenVersion)) throw httpError(403, 'Sign in with the Google account linked to your current Yaans account.');
      if (linked && attempt.purpose === 'login') {
        establishSession(res, linked);
        clearGoogleCookie(res);
        await recordSecurityEvent('google_login_success', { userId: linked._id, role: linked.role, ip: req.ip });
        return res.redirect(303, `${config.origin}${attempt.returnTo}`);
      }
      if (existing?.googleSubject && !linked) throw httpError(409, 'A different Google account is already linked.');
      if (attempt.purpose === 'set-password' && (!linked || linked.passwordHash)) throw httpError(403, 'This account cannot set a password through this flow.');
      const token = random();
      await challenges().insertOne({ _id: `google-pending:${digest(token)}`, browser: digest(token), csrf: random(), identity,
        mode: attempt.purpose === 'set-password' ? 'set-password' : existing ? 'link' : 'register',
        userId: existing?._id || null, tokenVersion: existing?.tokenVersion || 0,
        // Bind linking to the existing credentials as well as the verified Google identity.
        passwordHash: existing?.passwordHash || null,
        returnTo: attempt.returnTo, expiresAt: new Date(Date.now() + lifetime) });
      res.cookie(cookieName(), token, cookieOptions());
      return res.redirect(303, `${config.origin}/login?google=complete`);
    } catch {
      clearGoogleCookie(res);
      await recordSecurityEvent('google_login_failed', { ip: req.ip, outcome: 'denied' });
      return res.redirect(303, `${config.origin}/login?google=failed`);
    }
  });

  router.get('/google/pending', async (req, res) => {
    configuration();
    const record = await pending(req);
    return res.json({ mode: record.mode, email: record.identity.email, name: record.identity.name, csrf: record.csrf });
  });

  router.post('/google/complete', sharedRateLimit('google-complete-ip', 30, 15 * 60000), sharedRateLimit('google-complete', 10, 15 * 60000, req => readCookies(req)[cookieName()] || req.ip), async (req, res) => {
    const config = configuration(); sameOrigin(req, config);
    const record = await pending(req);
    if (!equal(req.headers['x-google-csrf'], record.csrf)) throw httpError(403, 'Refresh this sign-in page and try again.');
    const accountLimit = await consumeLimit('google-account', record.identity.subject, 10, 15 * 60000);
    if (!accountLimit.allowed) { res.set('Retry-After', String(accountLimit.retryAfter)); throw httpError(429, 'Too many sign-in attempts. Please try again later.'); }
    let name, passwordHash;
    if (record.mode === 'link') {
      if (!record.passwordHash || !req.body.currentPassword || !await bcrypt.compare(req.body.currentPassword, record.passwordHash)) {
        await recordSecurityEvent('google_link_failed', { identity: record.identity.email, ip: req.ip, outcome: 'denied' });
        throw httpError(401, 'Your current Yaans password is required to link this account.');
      }
    } else if (record.mode === 'register') {
      name = stringField(req.body.name, 'Name', { required: true, maximum: 120 });
      if (req.body.acceptTerms !== true) throw httpError(400, 'Accept the Terms and acknowledge the Privacy Policy to create your account.');
    } else if (record.mode === 'set-password') {
      validateNewPassword(req.body.newPassword);
      passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    } else throw httpError(400, 'Invalid sign-in step.');

    const user = await withTransaction(async session => {
      const consumed = await challenges().findOneAndDelete({ _id: record._id, expiresAt: { $gt: new Date() } }, { session });
      if (!consumed) throw httpError(401, 'Google sign-in expired or was already completed.');
      const store = await getStore({ users: { $or: [{ googleSubject: record.identity.subject }, { email: record.identity.email }, ...(record.userId ? [idFilter(record.userId)] : [])] } }, { session });
      if (record.mode === 'register') {
        if (store.users.length) throw httpError(409, 'An account was created during sign-in. Please start again to link it securely.');
        const created = { _id: generateId('usr_cust'), name, email: record.identity.email, phone: '', passwordHash: null,
          googleSubject: record.identity.subject, googleLinkedAt: new Date(), role: 'customer', sellerId: null, defaultDistrict: null,
          addresses: [], wishlist: [], isActive: true, tokenVersion: 0, termsAcceptedAt: new Date(), createdAt: new Date().toISOString() };
        store.users.push(created); await persistStore(store); return created;
      }
      const target = store.users.find(user => user._id === record.userId);
      allowedCustomer(target);
      if ((target.tokenVersion || 0) !== record.tokenVersion || (target.passwordHash || null) !== record.passwordHash) throw httpError(409, 'Your account changed. Please start Google sign-in again.');
      if (record.mode === 'link') {
        if (target.email !== record.identity.email || target.googleSubject || store.users.some(user => user._id !== target._id && user.googleSubject === record.identity.subject)) throw httpError(409, 'This Google account cannot be linked. Please start again.');
        target.googleSubject = record.identity.subject; target.googleLinkedAt = new Date();
      } else {
        if (target.googleSubject !== record.identity.subject || target.passwordHash) throw httpError(409, 'Your account changed. Please start again.');
        target.passwordHash = passwordHash; target.credentialsUpdatedAt = new Date();
      }
      target.tokenVersion = (target.tokenVersion || 0) + 1;
      await persistStore(store); return target;
    });
    clearGoogleCookie(res);
    await recordSecurityEvent(record.mode === 'register' ? 'google_customer_registered' : record.mode === 'link' ? 'google_account_linked' : 'google_password_created', { userId: user._id, role: user.role, ip: req.ip });
    return issueSession(req, res, user, { sellers: [] }, { returnTo: record.returnTo }, record.mode === 'register' ? 201 : 200);
  });
}
