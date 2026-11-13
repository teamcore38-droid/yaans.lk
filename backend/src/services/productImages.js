import { httpError } from '../config/errors.js';

export function validateProductImages(images, previous = []) {
  // Legacy galleries can be retained or reduced without silently losing photos.
  const legacy = Array.isArray(images) && images.length <= previous.length && images.every(url => previous.includes(url));
  if (!Array.isArray(images) || !images.length || (images.length > 8 && !legacy)) throw httpError(400, 'Provide between one and eight product images.');
  return images.map(url => {
    if (typeof url !== 'string' || url.length > 2048 || url !== url.trim()) throw httpError(400, 'Invalid product image URL.');
    if (/^\/(?!\/)[^\\\s]+$/.test(url)) return url;
    try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return url; } catch {}
    throw httpError(400, 'Product images must use HTTPS or an internal image path.');
  });
}

export async function prepareProductImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 4 * 1024 * 1024) throw httpError(415, 'Choose a JPG, PNG or WebP image up to 4 MB.');
  try {
    const { default: sharp } = await import('sharp');
    const image = sharp(buffer, { limitInputPixels: 25_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported image');
    // APNG animation is not exposed as pages by all libvips builds.
    if (metadata.format === 'png') {
      for (let offset = 8; offset + 12 <= buffer.length;) {
        const size = buffer.readUInt32BE(offset);
        if (buffer.toString('ascii', offset + 4, offset + 8) === 'acTL') throw new Error('Animated image');
        offset += size + 12;
      }
    }
    return await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw httpError(415, 'Choose a valid, non-animated JPG, PNG or WebP image with at most 25 megapixels.');
  }
}
