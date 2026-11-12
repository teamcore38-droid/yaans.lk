import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { getJwtSecret } from '../middleware/auth.js';
import { httpError } from '../config/errors.js';
import { stringField, sanitizeSlug, sanitizeHighlights } from '../config/inputValidation.js';
export const editableFields = ['title','sku','categorySlug','subCategorySlug','description','highlights','priceLkr','compareAtPriceLkr','stock','images','variants'];
export const productRevision = product => createHmac('sha256', getJwtSecret()).update(mongoose.mongo.BSON.EJSON.stringify(product)).digest('hex');
export function staffProduct(product) {
  return { _id: String(product._id), sellerName: product.sellerName, ...Object.fromEntries(editableFields.map(key => [key, product[key]])), variants: (product.variants || []).map(group => ({ name: group.name, values: group.values.map(({ label, priceLkr, stock }) => ({ label, priceLkr, stock })) })), revision: productRevision(product) };
}
const number = (value, name, integer = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (integer ? 0 : 0.01) || (integer && !Number.isSafeInteger(value))) throw httpError(400, `Invalid ${name}.`);
  return value;
};
export function productChanges(body, categories) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => ![...editableFields,'revision'].includes(key))) throw httpError(400, 'Unsupported product field.');
  if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) throw httpError(400, 'Reload the product before editing.');
  const patch = {};
  for (const [name, maximum] of Object.entries({ title: 200, sku: 120, description: 10000 })) if (body[name] !== undefined) patch[name] = stringField(body[name], name, { required: true, maximum });
  if (body.categorySlug !== undefined) {
    if (typeof body.categorySlug !== 'string' || !categories.some(category => category.slug === body.categorySlug)) throw httpError(400, 'Choose an existing category.');
    patch.categorySlug = body.categorySlug;
  }
  if (body.subCategorySlug !== undefined) {
    const slug = stringField(body.subCategorySlug, 'Subcategory', { maximum: 80 });
    if (slug && slug !== sanitizeSlug(slug)) throw httpError(400, 'Invalid subcategory.');
    patch.subCategorySlug = slug;
  }
  if (body.highlights !== undefined) {
    if (!Array.isArray(body.highlights) || body.highlights.length > 20 || body.highlights.some(value => typeof value !== 'string' || value.length > 300)) throw httpError(400, 'Invalid highlights.');
    patch.highlights = sanitizeHighlights(body.highlights);
  }
  for (const key of ['priceLkr','stock']) if (body[key] !== undefined) patch[key] = number(body[key], key, key === 'stock');
  if (body.compareAtPriceLkr !== undefined) patch.compareAtPriceLkr = body.compareAtPriceLkr === null ? null : number(body.compareAtPriceLkr, 'Compare price');
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || !body.images.length || body.images.length > 10) throw httpError(400, 'Provide between one and ten images.');
    patch.images = body.images.map(value => {
      const url = stringField(value, 'Image URL', { required: true, maximum: 2048 });
      if (/^\/(?!\/)[^\\\s]*$/.test(url)) return url;
      try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return url; } catch {}
      throw httpError(400, 'Images must use HTTPS or an internal image path.');
    });
  }
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length > 10) throw httpError(400, 'Invalid variants.');
    const labels = new Set();
    patch.variants = body.variants.map(group => {
      if (!group || typeof group !== 'object' || Object.keys(group).some(key => !['name','values'].includes(key)) || !Array.isArray(group.values) || !group.values.length || group.values.length > 50) throw httpError(400, 'Invalid variant group.');
      return { name: stringField(group.name, 'Variant name', { required: true, maximum: 120 }), values: group.values.map(option => {
        if (!option || typeof option !== 'object' || Object.keys(option).some(key => !['label','priceLkr','stock'].includes(key))) throw httpError(400, 'Invalid variant option.');
        const label = stringField(option.label, 'Variant label', { required: true, maximum: 120 });
        if (labels.has(label)) throw httpError(400, 'Variant labels must be unique.'); labels.add(label);
        return { label, priceLkr: number(option.priceLkr, 'Variant price'), stock: number(option.stock, 'Variant stock', true) };
      }) };
    });
  }
  return patch;
}
