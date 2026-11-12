import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { apiRequest, getCachedApiResponse, invalidateCatalogCache } from '../src/utils/api.js';
import { imageUrl, imageSrcSet } from '../src/utils/images.js';

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const originalDocument = globalThis.document;
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  globalThis.document = {cookie:''};
  invalidateCatalogCache();
});
afterEach(() => { globalThis.fetch = originalFetch; Date.now = originalNow; globalThis.document=originalDocument; });

test('shares concurrent public requests and canonicalizes query ordering', async () => {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['Content-Type'], undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response({ products: [{ _id: 'one' }] });
  };
  localStorage.setItem('yaans_token', 'private-token');
  const results = await Promise.all([
    apiRequest('/marketplace/products?limit=12&page=1'),
    apiRequest('/marketplace/products?page=1&limit=12')
  ]);
  assert.deepEqual(results[0], results[1]);
  await apiRequest('/marketplace/products?page=1&limit=12');
  assert.equal(calls, 1);
});

test('expires catalog data and supports forced refresh', async () => {
  let now = 1000;
  Date.now = () => now;
  let calls = 0;
  globalThis.fetch = async () => response({ version: ++calls });
  assert.equal((await apiRequest('/marketplace/home')).version, 1);
  now += 15001;
  assert.equal(getCachedApiResponse('/marketplace/home'), null);
  assert.equal((await apiRequest('/marketplace/home')).version, 2);
  assert.equal((await apiRequest('/marketplace/home', { cache: 'reload' })).version, 3);
  assert.equal(getCachedApiResponse('/marketplace/home').version, 3);
});

test('home response also supplies categories without a second request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response({ categories: [{ slug: 'home' }] }); };
  await apiRequest('/marketplace/home');
  assert.deepEqual(await apiRequest('/marketplace/categories'), { categories: [{ slug: 'home' }] });
  assert.equal(calls, 1);
});

test('never caches account/order responses or reads persisted bearer tokens', async () => {
  const tokens = [];
  globalThis.fetch = async (_url, options) => {
    tokens.push(options.headers.Authorization);
    return response({ user: options.headers.Authorization });
  };
  localStorage.setItem('yaans_token', 'one');
  await apiRequest('/auth/me');
  await apiRequest('/auth/me');
  localStorage.setItem('yaans_token', 'two');
  await apiRequest('/auth/me');
  await apiRequest('/orders/my-orders');
  assert.deepEqual(tokens, [undefined, undefined, undefined, undefined]);
  assert.equal(getCachedApiResponse('/auth/me'), null);
  assert.equal(getCachedApiResponse('/orders/my-orders'), null);
});

test('cookie session changes isolate in-flight account reads and mutations carry CSRF proof',async()=>{
  const pending=[];
  globalThis.fetch=(_url,options)=>new Promise(resolve=>pending.push({resolve,options}));
  document.cookie='yaans_csrf=first-session';const first=apiRequest('/auth/me');
  document.cookie='yaans_csrf=second-session';const second=apiRequest('/auth/me');
  assert.equal(pending.length,2);
  pending[0].resolve(response({user:'first'}));pending[1].resolve(response({user:'second'}));
  assert.equal((await first).user,'first');assert.equal((await second).user,'second');
  let sent;globalThis.fetch=async(_url,options)=>{sent=options;return response({saved:true});};
  await apiRequest('/auth/profile',{method:'PUT',body:'{}'});
  assert.equal(sent.credentials,'same-origin');assert.equal(sent.headers['X-CSRF-Token'],'second-session');assert.equal(sent.headers.Authorization,undefined);
});

test('successful edits invalidate catalog data, while cart quotes retain it', async () => {
  globalThis.fetch = async () => response({ products: [] });
  await apiRequest('/marketplace/products');
  await apiRequest('/orders/quote', { method: 'POST', body: '{}' });
  assert.ok(getCachedApiResponse('/marketplace/products'));
  await apiRequest('/seller/products/one', { method: 'PUT', body: '{}' });
  assert.equal(getCachedApiResponse('/marketplace/products'), null);
});

test('an older in-flight response cannot repopulate the cache after an edit', async () => {
  let finishRead;
  globalThis.fetch = (_url, options) => options.method === 'PUT'
    ? Promise.resolve(response({ updated: true }))
    : new Promise((resolve) => { finishRead = () => resolve(response({ outdated: true })); });
  const oldRead = apiRequest('/marketplace/products');
  await apiRequest('/seller/products/one', { method: 'PUT', body: '{}' });
  finishRead();
  await oldRead;
  assert.equal(getCachedApiResponse('/marketplace/products'), null);
});

test('failed requests are retried and preserve their HTTP status', async () => {
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? response({ message: 'Unavailable' }, 503) : response({ products: [] });
  await assert.rejects(apiRequest('/marketplace/products'), (error) => error.status === 503);
  assert.deepEqual(await apiRequest('/marketplace/products'), { products: [] });
  assert.equal(calls, 2);
});

test('no-store bypasses both cache reads and writes', async () => {
  let calls = 0;
  globalThis.fetch = async () => response({ version: ++calls });
  await apiRequest('/marketplace/products', { cache: 'no-store' });
  assert.equal(getCachedApiResponse('/marketplace/products'), null);
  await apiRequest('/marketplace/products', { cache: 'no-store' });
  assert.equal(calls, 2);
});

test('image sizing preserves other hosts, existing crops and signed URLs', () => {
  const source = 'https://res.cloudinary.com/example/image/upload/v123/products/item.jpg';
  assert.equal(imageUrl(source, 640), 'https://res.cloudinary.com/example/image/upload/f_auto,q_auto:good,c_limit,w_640/v123/products/item.jpg');
  assert.match(imageSrcSet(source), /960w$/);
  for (const unchanged of ['/local.jpg', 'https://images.unsplash.com/photo?w=600', source.replace('/v123/', '/c_crop/v123/'), source.replace('/v123/', '/s--signature--/v123/')]) {
    assert.equal(imageUrl(unchanged, 640), unchanged);
    assert.equal(imageSrcSet(unchanged), undefined);
  }
});
