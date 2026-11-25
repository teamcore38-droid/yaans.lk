import { adminOrderPath } from '../../../shared/adminOrderPath.js';

export function adminOrderUrl(orderId, env = process.env) {
  const path = adminOrderPath(orderId);
  if (!path) return null;
  // Vercel provides this hostname for the deployment. Request headers and
  // customer data must never determine where a printed code sends an admin.
  if (env.VERCEL_ENV === 'preview') {
    if (!/^[a-z0-9-]{1,63}\.vercel\.app$/i.test(env.VERCEL_URL || '')) return null;
    return `https://${env.VERCEL_URL}${path}`;
  }
  if (env.APP_ENV === 'staging') return `https://yaans-lk-staging.vercel.app${path}`;
  if (env.APP_ENV === 'test') return `http://127.0.0.1:4173${path}`;
  if (env.NODE_ENV !== 'production' && env.VERCEL_ENV !== 'production') return `http://localhost:5173${path}`;
  return `https://yaans.lk${path}`;
}

export async function orderQr(url, format) {
  const { default: encodeQR } = await import('qr');
  return encodeQR(url, format, { ecc: 'medium', border: 4, scale: format === 'raw' ? 1 : 5 });
}
