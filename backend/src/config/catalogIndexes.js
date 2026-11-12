// Installed explicitly during deployment preparation, never on a customer request.
export const catalogIndexes = [
  { key: { approvalStatus: 1, soldCount: -1, _id: 1 }, name: 'catalog_popular' },
  { key: { approvalStatus: 1, categorySlug: 1, soldCount: -1, _id: 1 }, name: 'catalog_category_popular' },
  { key: { approvalStatus: 1, priceLkr: 1, _id: 1 }, name: 'catalog_price' },
  { key: { approvalStatus: 1, rating: -1, _id: 1 }, name: 'catalog_rating' },
  { key: { approvalStatus: 1, sellerId: 1 }, name: 'catalog_seller' }
];

export async function ensureCatalogIndexes(db) {
  for (const { key, name } of catalogIndexes) await db.collection('products').createIndex(key, { name });
  return catalogIndexes.map(({ name }) => name);
}
