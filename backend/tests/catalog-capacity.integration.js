import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { populateCapacityData } from '../../tests/performance/fixtures.mjs';

test('populated catalog reads stay bounded and preserve visibility, filters and pagination', { timeout: 120000 }, async (t) => {
  const app = await startIsolatedApp(0, { monitorCommands: true });
  t.after(() => app.close());
  const sizes = await populateCapacityData(app.mongo, { products: 500, sellers: 60, reviews: 2000, orders: 0 });
  const request = async (route) => { const response = await fetch(app.url + '/api/marketplace' + route); return { status: response.status, data: await response.json() }; };
  const client = app.mongo.client;
  const started = new Map();
  let returned = {};
  client.on('commandStarted', (event) => {
    started.set(event.requestId, event.command.find || event.command.aggregate || event.command.collection);
  });
  client.on('commandSucceeded', (event) => {
    const name = started.get(event.requestId); started.delete(event.requestId);
    if (typeof name === 'string') returned[name] = (returned[name] || 0) + (event.reply?.cursor?.firstBatch?.length || event.reply?.cursor?.nextBatch?.length || 0);
  });

  await t.test('combined filters and page totals match the visible catalog rather than just the selected page', async () => {
    const approved = new Set((await app.mongo.collection('sellers').find({ status: 'approved' }).toArray()).map((seller) => String(seller._id)));
    const all = await app.mongo.collection('products').find({}).toArray();
    const expected = all.filter((product) => product.approvalStatus === 'approved' && approved.has(product.sellerId) &&
      product.title.toLowerCase().includes('spice') && product.categorySlug === 'homemade-pantry' &&
      product.sellerDistrict.toLowerCase() === 'colombo' && product.stock > 0 && product.priceLkr >= 200 && product.priceLkr <= 3000)
      .sort((a, b) => b.priceLkr - a.priceLkr || String(b._id).localeCompare(String(a._id)));
    const result = await request('/products?q=spice&category=homemade-pantry&district=cOlOmBo&inStock=true&minPrice=200&maxPrice=3000&sort=price_desc&page=2&limit=7');
    assert.equal(result.status, 200); assert.equal(result.data.pagination.total, expected.length);
    assert.deepEqual(result.data.products.map((product) => product._id), expected.slice(7, 14).map((product) => String(product._id)));
    assert.ok(result.data.products.every((product) => product._writeVersion === undefined));
  });

  await t.test('a catalog page transfers only its selected products from MongoDB and uses an ordered index', async () => {
    returned = {};
    const result = await request('/products?limit=12');
    assert.equal(result.status, 200); assert.equal(result.data.products.length, 12);
    // countDocuments may return one aggregate count row in addition to the page.
    assert.ok(returned.products <= 13, `A 12-item page returned ${returned.products} database records.`);
    const ids = (await app.mongo.collection('sellers').find({ status: 'approved' }).toArray()).map((seller) => String(seller._id));
    const plan = await app.mongo.collection('products').find({ approvalStatus: 'approved', sellerId: { $in: ids } })
      .sort({ soldCount: -1, _id: 1 }).limit(12).explain('executionStats');
    assert.equal(plan.executionStats.nReturned, 12);
    assert.ok(plan.executionStats.totalDocsExamined < sizes.products / 2);
    assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /IXSCAN/);
  });

  await t.test('home cards are bounded and private seller fields are absent', async () => {
    returned = {};
    const result = await request('/home'); assert.equal(result.status, 200);
    assert.ok(returned.products <= 1, 'The home aggregation must not transfer the complete catalog.');
    for (const key of ['homemadeProducts', 'dealProducts', 'featuredProducts']) assert.ok(result.data[key].length <= 8);
    assert.ok(result.data.recommendedProducts.length <= 10);
    assert.ok(result.data.verifiedSellers.every((seller) => seller.bankDetails === undefined && seller.contactEmail === undefined));
  });

  await t.test('review pages preserve chronological order across BSON dates and strings without loading unrelated reviews', async () => {
    await app.mongo.collection('reviews').insertMany([
      { _id: 'rev_native_date', productId: 'prd_test_spice', customerName: 'Synthetic', rating: 4, comment: 'Native date review', createdAt: new Date('2027-01-01T00:00:00Z') },
      { _id: 'rev_string_date', productId: 'prd_test_spice', customerName: 'Synthetic', rating: 5, comment: 'String date review', createdAt: '2028-01-01T00:00:00Z' }
    ]);
    returned = {};
    const first = await request('/products/prd_test_spice?reviewLimit=17');
    assert.equal(first.status, 200); assert.equal(first.data.reviews.length, 17);
    assert.equal(first.data.reviewPagination.total, 1002);
    assert.deepEqual(first.data.reviews.slice(0, 2).map((review) => review._id), ['rev_string_date', 'rev_native_date']);
    assert.ok(returned.reviews <= 1, 'The review facet must return a bounded page, not all review records.');
    const second = await request('/products/prd_test_spice?reviewPage=2&reviewLimit=17');
    assert.equal(second.data.reviews.length, 17);
    const firstIds = new Set(first.data.reviews.map((review) => review._id));
    assert.ok(second.data.reviews.every((review) => !firstIds.has(review._id)));
  });

  await t.test('storefront products have complete totals and disjoint bounded pages', async () => {
    const first = await request('/sellers/synthetic-load-seller-1?limit=3');
    const second = await request('/sellers/synthetic-load-seller-1?page=2&limit=3');
    assert.equal(first.status, 200); assert.equal(first.data.products.length, 3);
    assert.ok(first.data.pagination.total > 3); assert.equal(second.data.products.length, 3);
    assert.ok(second.data.products.every((product) => !first.data.products.some((previous) => previous._id === product._id)));
    assert.equal((await request('/sellers/synthetic-load-seller-0')).status, 404);
  });

  await t.test('literal searches, malformed query values and unknown sort names cannot become database operators', async () => {
    assert.equal((await request('/products?q=.*')).data.pagination.total, 0);
    assert.equal((await request('/products?sort=constructor')).status, 200);
    assert.equal((await request('/products?q%5B%24ne%5D=value')).status, 400);
    assert.equal((await request('/products?q=' + 'x'.repeat(201))).status, 400);
    assert.equal((await request('/products?page%5B%5D=1')).status, 400);
  });

  await t.test('BSON identifiers remain accessible and the current product is excluded from related products', async () => {
    const { ObjectId } = app.db.MODEL_MAP.products.db.base.mongo;
    const id = new ObjectId(), sellerId = new ObjectId();
    const original = await app.mongo.collection('products').findOne({ _id: 'prd_test_lamp' });
    await app.mongo.collection('sellers').insertOne({ _id: sellerId, slug: 'native-id-store', storeName: 'Synthetic Native Store', status: 'approved', district: 'Colombo', shippingPolicy: {} });
    await app.mongo.collection('products').insertOne({ ...original, _id: id, slug: 'native-id-product', sellerId: String(sellerId), sellerSlug: 'native-id-store' });
    const result = await request('/products/' + id);
    assert.equal(result.status, 200); assert.equal(result.data.product._id, String(id));
    assert.equal(result.data.seller._id, String(sellerId));
    assert.ok(result.data.relatedProducts.every((product) => product._id !== String(id)));
    assert.equal((await request('/sellers/native-id-store')).data.products[0]._id, String(id));
    await app.mongo.collection('sellers').updateOne({ _id: sellerId }, { $set: { status: 'suspended' } });
    assert.equal((await request('/products/' + id)).status, 404);
    assert.equal((await request('/products?sellerId=native-id-store')).data.pagination.total, 0);
  });
});
