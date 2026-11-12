import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { httpError } from './errors.js';

const secure = () => ['production','preview'].includes(process.env.VERCEL_ENV) || process.env.NODE_ENV === 'production';
export const cookieNames = () => secure() ? { session:'__Host-yaans_session', csrf:'__Host-yaans_csrf' } : { session:'yaans_session', csrf:'yaans_csrf' };
export function readCookies(req) {
  const result = Object.create(null);
  for (const entry of String(req.headers.cookie || '').split(';')) {
    const index=entry.indexOf('='); if(index<0)continue;
    const name=entry.slice(0,index).trim(); if(Object.hasOwn(result,name)) throw httpError(401, 'Ambiguous session cookies. Sign in again.');
    try { result[name]=decodeURIComponent(entry.slice(index+1).trim()); } catch { throw httpError(400,'Invalid session cookie.'); }
  }
  return result;
}
export const newCsrfToken = () => randomBytes(24).toString('base64url');
export function assertCsrf(req, decoded) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return;
  const actual = req.headers['x-csrf-token'];
  if (typeof actual !== 'string' || actual.length > 128 || typeof decoded.csrf !== 'string' ||
    !timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(decoded.csrf).digest())) throw httpError(403,'Refresh this page before making changes.');
}
export function setSessionCookies(res, token, csrf, administrator) {
  const names=cookieNames(), options={ secure:secure(), sameSite:'lax', path:'/', maxAge:(administrator?3600:86400)*1000 };
  res.cookie(names.session,token,{...options,httpOnly:true});
  res.cookie(names.csrf,csrf,{...options,httpOnly:false});
  res.set('Cache-Control','private, no-store');
}
export function clearSessionCookies(res) {
  const names=cookieNames();
  for(const name of Object.values(names))res.clearCookie(name,{secure:secure(),sameSite:'lax',path:'/'});
}
