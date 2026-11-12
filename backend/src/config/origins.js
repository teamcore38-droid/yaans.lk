import { httpError } from './errors.js';
export function allowedOrigin(origin) {
  if (!origin) return true;
  let url;try {url=new URL(origin);}catch{return false;}
  if(url.origin!==origin||url.username||url.password)return false;
  const explicit=new Set(['https://yaans.lk','https://www.yaans.lk',...(process.env.CORS_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean)]);
  if(process.env.VERCEL_URL)explicit.add(`https://${process.env.VERCEL_URL}`);
  if(process.env.APP_ENV==='staging')explicit.add('https://yaans-lk-staging.vercel.app');
  if(explicit.has(origin))return true;
  return process.env.NODE_ENV!=='production'&&!['production','preview'].includes(process.env.VERCEL_ENV)&&
    ['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
}
export function corsOrigin(origin,callback) {
  if(!allowedOrigin(origin))return callback(httpError(403,'This request origin is not allowed.'));
  return callback(null,Boolean(origin));
}
