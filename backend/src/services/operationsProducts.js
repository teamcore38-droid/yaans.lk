import { productRevision } from './staffProducts.js';

// Use the same HMAC and conflict semantics as staff editing, over the bounded
// operations projection. Inventory changes made after loading must be reviewed.
export const operationsProductFields = Object.fromEntries(['_id','title','sku','description','images','categorySlug','subCategorySlug','sellerName','approvalStatus','priceLkr','compareAtPriceLkr','stock','createdAt','highlights','tags','isHomemade','isFeatured','isDeal','codEligible','variants'].map(key => [key, 1]));
export function operationsProductRevision(product) {
  return productRevision(Object.fromEntries(Object.keys(operationsProductFields).map(key => [key, key === '_id' ? String(product[key]) : product[key]])));
}
export function assertOperationsProductRevision(req, product) {
  if (req.user.adminAccess === 'coadmin' && req.body.revision !== operationsProductRevision(product)) {
    const error = new Error('Product or inventory changed. Reload the module before saving.');
    error.status = 409; error.code = 'WRITE_CONFLICT'; throw error;
  }
}
