import { connectDatabase, idFilter, MODEL_MAP } from '../config/db.js';
import { httpError } from '../config/errors.js';
import { calculateSellerDeliveryFee } from '../config/sriLankaDistricts.js';

const readOptions = { maxTimeMS: 3000 };
const projection = { _writeVersion: 0 };
const clean = (doc) => { if (!doc) return null; const { _writeVersion, _catalogDate, ...value } = doc; return { ...value, _id: String(doc._id) }; };
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const deals = { $or: [{ isDeal: true }, { $expr: { $gt: ['$compareAtPriceLkr', '$priceLkr'] } }] };
const dateSort = { $set: { _catalogDate: { $convert: { input: '$createdAt', to: 'date', onError: new Date(0), onNull: new Date(0) } } } };
const settingsProjection = { key: 1, districts: 1, codEnabledGlobally: 1, globalFreeShippingMinLkr: 1, shippingMode: 1, flatShippingRateLkr: 1, banners: 1 };
const sellerFields = ['_id', 'storeName', 'slug', 'sellerType', 'isHomemadeVendor', 'description', 'logoUrl', 'bannerUrl', 'district', 'city', 'rating', 'reviewCount', 'totalSalesCount', 'shippingPolicy', 'isVacationMode', 'vacationNotice', 'createdAt'];
const sellerProjection = Object.fromEntries(sellerFields.map((field) => [field, 1]));
const publicReview = doc => {
  const value=clean(doc);
  const {userId,purchaseOrderId,purchaseVerifiedAt,...view}=value;
  return {...view,verifiedPurchase:Boolean(value.verifiedPurchase&&userId&&purchaseOrderId&&purchaseVerifiedAt)};
};
const sellerView = (doc) => ({ ...Object.fromEntries(sellerFields.map((field) => [field, doc[field]])), _id: String(doc._id), isVacationMode: Boolean(doc.isVacationMode), vacationNotice: doc.vacationNotice || '' });

function text(query, key, fallback = '', maximum = 200) {
  const value = query[key] === undefined ? fallback : query[key];
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0')) throw httpError(400, `Invalid ${key} filter.`);
  return value;
}

export function catalogPagination(query, defaultLimit = 12, maximum = 48) {
  const page = Math.min(10000, Math.max(1, parseInt(text(query, 'page', '1', 12), 10) || 1));
  const limit = Math.min(maximum, Math.max(1, parseInt(text(query, 'limit', String(defaultLimit), 12), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
const paginationView = ({ page, limit }, total) => ({ total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });

async function approvedSellerIds() {
  return (await MODEL_MAP.sellers.collection.find({ status: 'approved' }, { ...readOptions, projection: { _id: 1 } }).toArray()).map(({ _id }) => String(_id));
}

export async function catalogSettings() {
  await connectDatabase();
  const config = await MODEL_MAP.platformConfig.collection.findOne({ key: 'main_config' }, { ...readOptions, projection: settingsProjection });
  if (!config) throw httpError(503, 'Marketplace settings are not configured.');
  return config;
}

export async function catalogCategories() {
  await connectDatabase();
  return (await MODEL_MAP.categories.collection.find({}, { ...readOptions, projection }).sort({ displayOrder: 1, _id: 1 }).toArray()).map(clean);
}

export async function catalogHome() {
  await connectDatabase();
  const [categories, sellers, config] = await Promise.all([
    catalogCategories(), MODEL_MAP.sellers.collection.find({ status: 'approved' }, { ...readOptions, projection: sellerProjection }).toArray(), catalogSettings()
  ]);
  const [groups] = await MODEL_MAP.products.collection.aggregate([
    { $match: { approvalStatus: 'approved', sellerId: { $in: sellers.map(({ _id }) => String(_id)) } } },
    { $project: projection },
    { $facet: {
      homemadeProducts: [{ $match: { isHomemade: true } }, { $limit: 8 }],
      dealProducts: [{ $match: deals }, { $limit: 8 }],
      featuredProducts: [{ $match: { isFeatured: true } }, { $limit: 8 }],
      recommendedProducts: [{ $sort: { soldCount: -1, _id: 1 } }, { $limit: 10 }]
    } }
  ], readOptions).toArray();
  return { categories, banners: (config.banners || []).map((banner, i) => ({ ...banner,
    id: banner.id || (banner._id ? String(banner._id) : `bnr_${i + 1}`), imageUrl: banner.imageUrl || banner.mobileImageUrl || '', mobileImageUrl: banner.mobileImageUrl || banner.imageUrl || ''
  })).filter((banner) => banner.active !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
  ...Object.fromEntries(['homemadeProducts', 'dealProducts', 'featuredProducts', 'recommendedProducts'].map((key) => [key, (groups?.[key] || []).map(clean)])),
  verifiedSellers: sellers.map((seller) => {
    const view = sellerView(seller);
    return Object.fromEntries(['_id', 'storeName', 'slug', 'sellerType', 'isHomemadeVendor', 'district', 'city', 'logoUrl', 'rating', 'reviewCount'].map((field) => [field, view[field]]));
  }), districts: config.districts, codEnabledGlobally: config.codEnabledGlobally, shippingMode: config.shippingMode || 'custom', flatShippingRateLkr: config.flatShippingRateLkr ?? 350 };
}

export async function catalogProducts(query = {}, restrictedSellerId) {
  await connectDatabase();
  const ids = restrictedSellerId ? [restrictedSellerId] : await approvedSellerIds();
  const filters = [{ approvalStatus: 'approved', sellerId: { $in: ids } }];
  const q = text(query, 'q').toLowerCase().trim();
  if (q) filters.push({ $or: ['title', 'description', 'sellerName', 'sellerDistrict', 'tags'].map((field) => ({ [field]: { $regex: escaped(q), $options: 'i' } })) });
  for (const [key, field] of [['category', 'categorySlug'], ['subCategory', 'subCategorySlug']]) {
    const value = text(query, key); if (value) filters.push({ [field]: value });
  }
  const seller = text(query, 'sellerId');
  if (seller) filters.push({ $or: [{ sellerId: seller }, { sellerSlug: seller }] });
  const district = text(query, 'district', '', 80);
  if (district) filters.push({ sellerDistrict: { $regex: `^${escaped(district)}$`, $options: 'i' } });
  if (text(query, 'homemade') === 'true') filters.push({ isHomemade: true });
  if (text(query, 'deals') === 'true') filters.push(deals);
  if (text(query, 'inStock') === 'true') filters.push({ stock: { $gt: 0 } });
  for (const [key, operator] of [['minPrice', '$gte'], ['maxPrice', '$lte']]) {
    const value = text(query, key, '', 32); if (value !== '' && Number.isFinite(Number(value))) filters.push({ priceLkr: { [operator]: Number(value) } });
  }
  const sortKey = text(query, 'sort', 'popular', 30);
  const sorts = { price_asc: { priceLkr: 1, _id: 1 }, price_desc: { priceLkr: -1, _id: -1 }, rating: { rating: -1, _id: 1 }, popular: { soldCount: -1, _id: 1 } };
  const order = Object.hasOwn(sorts, sortKey) ? sorts[sortKey] : sorts.popular;
  const page = catalogPagination(query), filter = { $and: filters };
  const rows = sortKey === 'newest'
    ? MODEL_MAP.products.collection.aggregate([{ $match: filter }, dateSort, { $sort: { _catalogDate: -1, _id: 1 } }, { $skip: page.skip }, { $limit: page.limit }, { $project: { ...projection, _catalogDate: 0 } }], readOptions).toArray()
    : MODEL_MAP.products.collection.find(filter, { ...readOptions, projection }).sort(order).skip(page.skip).limit(page.limit).toArray();
  const [products, total] = await Promise.all([rows, MODEL_MAP.products.collection.countDocuments(filter, readOptions)]);
  return { products: products.map(clean), pagination: paginationView(page, total) };
}

export async function catalogProduct(idOrSlug, query = {}) {
  await connectDatabase();
  const key = text({ key: idOrSlug }, 'key');
  const product = clean(await MODEL_MAP.products.collection.findOne({ approvalStatus: 'approved', $or: [idFilter(key), { slug: key }] }, { ...readOptions, projection }));
  if (!product) throw httpError(404, 'Product not found.');
  const page = catalogPagination({ page: query.reviewPage, limit: query.reviewLimit }, 20, 50);
  const reviewFilter = { productId: product._id };
  const [seller, config, ids, reviewResult] = await Promise.all([
    MODEL_MAP.sellers.collection.findOne({ status: 'approved', ...idFilter(String(product.sellerId)) }, { ...readOptions, projection: sellerProjection }),
    catalogSettings(), approvedSellerIds(),
    MODEL_MAP.reviews.collection.aggregate([{ $match: reviewFilter }, { $facet: {
      rows: [dateSort, { $sort: { _catalogDate: -1, _id: 1 } }, { $skip: page.skip }, { $limit: page.limit }, { $project: { ...projection, _catalogDate: 0 } }],
      count: [{ $count: 'total' }]
    } }], readOptions).toArray()
  ]);
  if (!seller) throw httpError(404, 'Product not found.');
  const relatedProducts = await MODEL_MAP.products.collection.find({
    $nor: [idFilter(product._id)], approvalStatus: 'approved', sellerId: { $in: ids },
    $or: [{ categorySlug: product.categorySlug }, { sellerId: product.sellerId }]
  }, { ...readOptions, projection }).limit(6).toArray();
  const reviews = reviewResult[0] || { rows: [], count: [] };
  return { product, seller: sellerView(seller), reviews: reviews.rows.map(publicReview), relatedProducts: relatedProducts.map(clean),
    reviewPagination: paginationView(page, reviews.count[0]?.total || 0),
    shippingEstimate: calculateSellerDeliveryFee({ sellerDistrict: seller.district, destinationDistrict: text(query, 'destinationDistrict', 'Colombo', 80),
      sellerSubtotalLkr: product.priceLkr, totalItemCount: 1, sellerShippingPolicy: seller.shippingPolicy || {}, districtConfigs: config.districts,
      globalFreeShippingMinLkr: config.globalFreeShippingMinLkr, shippingMode: config.shippingMode || 'custom', flatShippingRateLkr: config.flatShippingRateLkr ?? 350 }) };
}

export async function catalogSeller(slugOrId, query = {}) {
  await connectDatabase();
  const key = text({ key: slugOrId }, 'key');
  const seller = await MODEL_MAP.sellers.collection.findOne({ status: 'approved', $or: [idFilter(key), { slug: key }] }, { ...readOptions, projection: sellerProjection });
  if (!seller) throw httpError(404, 'Seller storefront not found.');
  const page = await catalogProducts(query, String(seller._id));
  return { seller: sellerView(seller), ...page };
}
