import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { consumeLimit } from '../middleware/sharedRateLimit.js';
import { httpError } from '../config/errors.js';

let testTransport;
// Isolated tests inject a local mailbox; no test environment can contact Resend.
export function setSecurityEmailTestTransport(transport) {
  if (process.env.NODE_ENV !== 'test' || process.env.APP_ENV !== 'test') throw new Error('Test mailbox is unavailable outside isolated tests.');
  testTransport = transport;
}

export function emailOrigin() {
  const origin = process.env.APP_ENV === 'test' ? 'http://127.0.0.1:4173' : process.env.APP_ENV === 'staging' ? 'https://yaans-lk-staging.vercel.app' : 'https://yaans.lk';
  return origin;
}

export async function sendSecurityEmail({ to, subject, text, idempotencyKey }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /[\r\n]/.test(to)) throw httpError(400, 'Enter a valid email address.');
  if (process.env.NODE_ENV === 'test' || process.env.APP_ENV === 'test') {
    if (!testTransport) throw httpError(503, 'The isolated test mailbox is unavailable.');
    return testTransport({ to, subject, text, idempotencyKey });
  }
  const key = process.env.RESEND_API_KEY;
  if (!key || process.env.RESEND_EMAIL_DOMAIN !== 'notify.yaans.lk') throw httpError(503, 'Email delivery is temporarily unavailable. Please try again later.');
  if (process.env.APP_ENV === 'staging') {
    const allowed = (process.env.EMAIL_ALLOWED_RECIPIENTS || '').toLowerCase().split(',').map(s => s.trim());
    if (!allowed.includes(to.toLowerCase())) throw httpError(503, 'Staging email is restricted to the approved test inbox.');
  }
  const quota = await consumeLimit('security-email-daily', 'all', 90, 86400000);
  if (!quota.allowed) throw httpError(503, 'Email delivery has reached its daily limit. Please try again later.');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: 'Yaans.lk Security <security@notify.yaans.lk>', to: [to], reply_to: 'yaanslk5@gmail.com', subject, text })
    });
    if (!response.ok) throw new Error('Email not accepted');
    const receipt = await response.json();
    if (typeof receipt.id !== 'string') throw new Error('Email not accepted');
    return { id: receipt.id };
  } catch {
    // Provider responses may contain addresses or credentials; never log them.
    throw httpError(503, 'Email delivery is temporarily unavailable. Please try again later.');
  }
}

export async function queueEmailChangeNotice({ userId, to, newEmail, completed }, session) {
  const entry = { _id: randomUUID(), userId: String(userId), to,
    subject: completed ? 'Your Yaans.lk login email was changed' : 'A change to your Yaans.lk login email was requested',
    text: `${completed ? 'Your login email has been changed to' : 'A request was made to change your login email to'} ${newEmail}.\n${completed ? 'All earlier sessions have been ended. Sign in again using your new email, password and authenticator if enabled.' : 'Your current login email stays active until the new address is confirmed.'}\nIf you did not request this, contact yaanslk5@gmail.com immediately and change your password at ${emailOrigin()}.\nYaans.lk will never ask for your password or authenticator codes by email.`,
    createdAt: new Date(), nextAttemptAt: new Date(), attempts: 0 };
  await mongoose.connection.db.collection('securityemailoutbox').insertOne(entry, { session });
  return entry._id;
}

export async function flushSecurityEmailNotices(maximum = 3) {
  if (process.env.MAINTENANCE_READ_ONLY === 'true') return { sent: 0 };
  await connectDatabase();
  const outbox = mongoose.connection.db.collection('securityemailoutbox');
  let sent = 0;
  for (let i = 0; i < Math.min(maximum, 5); i++) {
    const now = new Date();
    const entry = await outbox.findOneAndUpdate({ sentAt: { $exists: false }, nextAttemptAt: { $lte: now } },
      { $set: { nextAttemptAt: new Date(now.getTime() + 120000) }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after', includeResultMetadata: false });
    if (!entry) break;
    try {
      const receipt = await sendSecurityEmail({ ...entry, idempotencyKey: `security-notice-${entry._id}` });
      await outbox.updateOne({ _id: entry._id }, { $set: { sentAt: new Date(), providerId: receipt.id, expiresAt: new Date(Date.now() + 30 * 86400000) }, $unset: { text: '', to: '' } });
      sent++;
    } catch {
      await outbox.updateOne({ _id: entry._id }, { $set: { nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(entry.attempts, 6))) } });
    }
  }
  return { sent };
}
