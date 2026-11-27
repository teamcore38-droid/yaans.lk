import { isSafeInternalLink } from '../../../shared/safeLinks.js';

// Preserve the original artwork and crop; ask Cloudinary only for a bounded
// resolution and its delivery format/quality optimizations. Other hosts and
// signed/transformed Cloudinary URLs pass through unchanged.
export function isSafeImageUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[\u0000-\u0020\u007f]/.test(trimmed)) return false;
  if (isSafeInternalLink(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function imageUrl(source, width) {
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/v\d+\//.test(source || '')) return source;
  if (source.includes('__cld_token__')) return source;
  return source.replace('/image/upload/', `/image/upload/f_auto,q_auto:good,c_limit,w_${width}/`);
}

export function imageSrcSet(source, widths = [320, 480, 640, 960]) {
  if (imageUrl(source, widths[0]) === source) return undefined;
  return widths.map((width) => `${imageUrl(source, width)} ${width}w`).join(', ');
}
