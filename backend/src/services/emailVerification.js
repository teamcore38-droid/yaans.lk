import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, getStore, persistStore, idFilter, withTransaction } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { sendSecurityEmail, emailOrigin, queueEmailChangeNotice, flushSecurityEmailNotices } from './securityEmail.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const invalid = () => httpError(400, 'This verification link is invalid, expired or already used. Request a new link.');
const challenges = () => mongoose.connection.db.collection('emailchallenges');
function challenge(purpose, fields) {
  const token = randomBytes(32).toString('base64url');
  return { token, doc: { _id: digest(token), purpose, ...fields, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) } };
}
async function deliver(token, doc, to) {
  await sendSecurityEmail({ to, subject: 'Confirm your Yaans.lk email address', idempotencyKey: `email-confirm-${doc._id}`,
    text: `Confirm your email address at:\n${emailOrigin()}/verify-email#token=${token}\n\nOpen this link and enter your Yaans.lk password to confirm. The link expires in one hour and can only be used once.\nIf you did not request this, ignore this email. No account or login email changes are made without confirmation.\nNever share your password or authenticator codes.` });
}

export async function beginRegistration(user, seller) {
  await connectDatabase();
  const { token, doc } = challenge('registration', { email: user.email, user, ...(seller ? { seller } : {}) });
  await challenges().insertOne(doc);
  try { await deliver(token, doc, user.email); }
  catch (error) { await challenges().deleteOne({ _id: doc._id }); throw error; }
  return { requiresEmailVerification: true, message: 'Check your inbox and spam folder. Confirm the email link with your password to finish registration. To request another link, submit this form again.' };
}

export async function requestCurrentEmailVerification(user) {
  if (user.emailVerifiedAt && user.verifiedEmail === user.email) return { message: 'This email address is already verified.' };
  const { token, doc } = challenge('current-email', { email: user.email, userId: user._id, tokenVersion: user.tokenVersion || 0, passwordHash: user.passwordHash });
  await challenges().insertOne(doc);
  try { await deliver(token, doc, user.email); }
  catch (error) { await challenges().deleteOne({ _id: doc._id }); throw error; }
  return { message: 'Check your inbox and spam folder for your verification link.' };
}

export async function beginEmailChange(user, newEmail, profile = {}) {
  const { token, doc } = challenge('email-change', { email: newEmail, oldEmail: user.email, userId: user._id, tokenVersion: user.tokenVersion || 0, passwordHash: user.passwordHash });
  const updated = await withTransaction(async session => {
    const store = await getStore({ users: idFilter(user._id) }, { session });
    const current = store.users[0];
    if (!current || current.email !== user.email || current.passwordHash !== user.passwordHash || (current.tokenVersion || 0) !== doc.tokenVersion) throw invalid();
    const taken = await mongoose.connection.db.collection('users').findOne({ email: newEmail }, { session, projection: { _id: 1 } });
    if (taken) throw httpError(409, 'Email / username is already in use by another account.');
    await challenges().insertOne(doc, { session });
    current.pendingEmail = newEmail;
    current.pendingEmailChallengeId = doc._id;
    if (profile.name) current.name = profile.name;
    if (profile.phone !== undefined) current.phone = profile.phone;
    await persistStore(store);
    await queueEmailChangeNotice({ userId: current._id, to: current.email, newEmail, completed: false }, session);
    return current;
  });
  // A delivery failure never replaces the active login address.
  try { await deliver(token, doc, newEmail); }
  finally { await flushSecurityEmailNotices(1); }
  return updated;
}

export async function confirmEmail(token, password) {
  if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token) || typeof password !== 'string' || !password) throw invalid();
  const _id = digest(token);
  const candidate = await challenges().findOne({ _id, expiresAt: { $gt: new Date() } });
  if (!candidate) throw invalid();
  const passwordHash = candidate.purpose === 'registration' ? candidate.user.passwordHash : candidate.passwordHash;
  if (!await bcrypt.compare(password, passwordHash)) throw httpError(401, 'The password does not match this verification request.');
  const result = await withTransaction(async session => {
    const doc = await challenges().findOneAndDelete({ _id, expiresAt: { $gt: new Date() } }, { session, includeResultMetadata: false });
    if (!doc) throw invalid();
    if (doc.purpose === 'registration') {
      const store = await getStore({ users: { email: doc.email }, ...(doc.seller ? { sellers: { _id: doc.seller._id } } : {}) }, { session });
      if (store.users.length) throw httpError(409, 'This email already has an account. Sign in instead.');
      const user = { ...doc.user, emailVerifiedAt: new Date(), verifiedEmail: doc.email };
      store.users.push(user);
      if (doc.seller) store.sellers.push(doc.seller);
      await persistStore(store);
      return { role: user.role, message: doc.seller ? 'Email verified. Your seller application is pending administrator review. Sign in to continue.' : 'Email verified and account created. Sign in to continue.' };
    }
    const store = await getStore({ users: idFilter(doc.userId) }, { session });
    const user = store.users[0];
    if (!user || !user.isActive || (user.tokenVersion || 0) !== doc.tokenVersion || user.passwordHash !== doc.passwordHash) throw invalid();
    if (doc.purpose === 'email-change') {
      if (user.email !== doc.oldEmail || user.pendingEmailChallengeId !== doc._id || user.pendingEmail !== doc.email) throw invalid();
      user.email = doc.email;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.pendingEmail = undefined;
      user.pendingEmailChallengeId = undefined;
      // Seller correspondence must follow the verified login address too.
      if (user.sellerId) {
        const sellerStore = await getStore({ sellers: { _id: user.sellerId } }, { session });
        if (sellerStore.sellers[0]) { sellerStore.sellers[0].contactEmail = doc.email; await persistStore(sellerStore); }
      }
      await queueEmailChangeNotice({ userId: user._id, to: doc.oldEmail, newEmail: doc.email, completed: true }, session);
    } else if (doc.purpose !== 'current-email' || user.email !== doc.email) throw invalid();
    user.verifiedEmail = doc.email;
    user.emailVerifiedAt = new Date();
    await persistStore(store);
    return { role: user.role, emailChanged: doc.purpose === 'email-change', message: doc.purpose === 'email-change' ? 'Email changed and earlier sessions ended. Sign in again using your new email address.' : 'Email address verified.' };
  });
  await flushSecurityEmailNotices(1);
  return result;
}
