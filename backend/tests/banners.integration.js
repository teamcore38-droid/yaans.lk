import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { startIsolatedApp } from './helpers/isolated-app.js';
import { accounts, TEST_PASSWORD } from '../../tests/support/fixtures.js';

test('banner images persist independently through secured API writes and storefront fallbacks', { timeout: 180000 }, async t => {
  const app = await startIsolatedApp();
  t.after(() => app.close());
  async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
    const response = await fetch(app.url + '/api' + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const login = await request('/auth/admin/login', { method: 'POST', body: { email: accounts.admin, password: TEST_PASSWORD }, headers: { 'X-Yaans-Client': 'browser' } });
  assert.equal(login.status, 200);
  const cookies = login.headers.getSetCookie();
  const cookie = cookies.map(value => value.split(';')[0]).join('; ');
  const csrf = cookies.find(value => value.startsWith('yaans_csrf=')).split(';')[0].slice('yaans_csrf='.length);
  const browser = { Cookie: cookie, 'X-CSRF-Token': csrf, 'X-Yaans-Client': 'browser' };

  await t.test('authorization and CSRF remain required for image writes', async () => {
    const body = { imageUrl: '/banners/desktop.webp' };
    assert.equal((await request('/admin/banners/bnr_test', { method: 'PUT', body })).status, 401);
    assert.equal((await request('/admin/banners/bnr_test', { method: 'PUT', body, headers: { Cookie: cookie } })).status, 403);
    const seller = await request('/auth/login', { method: 'POST', body: { email: accounts.seller, password: TEST_PASSWORD } });
    assert.equal((await request('/admin/banners/bnr_test', { method: 'PUT', body, token: seller.data.token })).status, 403);
    assert.equal((await request('/admin/banners/bnr_test', { method: 'PUT', body: { ctaLink: '//external.invalid' }, headers: browser })).status, 400);
    assert.equal((await request('/admin/banners/bnr_test', { method: 'PUT', body: { mobileImageUrl: { invalid: true } }, headers: browser })).status, 400);
  });

  for (const device of ['imageUrl', 'mobileImageUrl']) {
    await t.test(`creating with only ${device} keeps the other saved field empty`, async () => {
      const other = device === 'imageUrl' ? 'mobileImageUrl' : 'imageUrl';
      const source = `/banners/${device}.webp`;
      const result = await request('/admin/banners', { method: 'POST', body: { title: device, [device]: source }, headers: browser });
      assert.equal(result.status, 201);
      assert.equal(result.data.banner[device], source);
      assert.equal(result.data.banner[other], '');
      const stored = await app.mongo.collection('platformconfigs').findOne({ key: 'main_config' });
      assert.equal(stored.banners.find(banner => banner.id === result.data.banner.id)[other], '');
      const home = await request('/marketplace/home');
      const displayed = home.data.banners.find(banner => banner.id === result.data.banner.id);
      assert.equal(displayed[device], source);
      assert.equal(displayed[other], source, 'display fallback does not rewrite saved fields');
    });
  }

  await t.test('partial updates preserve the opposite image and existing legacy references', async () => {
    const path = '/admin/banners/bnr_test';
    assert.equal((await request(path, { method: 'PUT', body: { imageUrl: '/banners/desktop.webp', mobileImageUrl: '/mobile_hero_banner.jpg' }, headers: browser })).status, 200);
    const desktop = await request(path, { method: 'PUT', body: { imageUrl: '/banners/new-desktop.webp' }, headers: browser });
    assert.equal(desktop.data.banner.mobileImageUrl, '/mobile_hero_banner.jpg');
    const mobile = await request(path, { method: 'PUT', body: { mobileImageUrl: '/banners/new-mobile.webp' }, headers: browser });
    assert.equal(mobile.data.banner.imageUrl, '/banners/new-desktop.webp');
    const cleared = await request(path, { method: 'PUT', body: { mobileImageUrl: '' }, headers: browser });
    assert.equal(cleared.data.banner.mobileImageUrl, '');
    const home = await request('/marketplace/home');
    assert.equal(home.data.banners.find(banner => banner.id === 'bnr_test').mobileImageUrl, '/banners/new-desktop.webp');
    const listed = await request('/admin/banners', { headers: browser });
    assert.equal(listed.data.banners.find(banner => banner.id === 'bnr_test').mobileImageUrl, '');
    assert.equal((await request('/admin/banners', { method: 'POST', body: { imageUrl: ' ', mobileImageUrl: ' ' }, headers: browser })).status, 400);
  });

  await t.test('multipart uploads retain byte/type limits and use the existing CDN endpoint', async () => {
    const original = cloudinary.uploader.upload_stream;
    const originalUrl = process.env.CLOUDINARY_URL;
    let uploads = 0;
    process.env.CLOUDINARY_URL = 'cloudinary://test:test@isolated-banner-test';
    cloudinary.uploader.upload_stream = (options, callback) => {
      uploads++;
      assert.equal(options.overwrite, false);
      assert.equal(options.folder, 'yaans_lk/banners');
      return new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) {
        callback(null, { secure_url: `https://res.cloudinary.com/isolated-banner-test/image/upload/v1/${uploads}.png`, public_id: options.public_id });
        done();
      } });
    };
    async function upload(bytes, type, headers = browser) {
      const body = new FormData();
      body.append('image', new Blob([bytes], { type }), 'banner.png');
      const response = await fetch(app.url + '/api/admin/upload-image', { method: 'POST', body, headers });
      return { status: response.status, data: await response.json() };
    }
    try {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
      assert.equal((await upload(png, 'image/png', {})).status, 401);
      assert.equal((await upload(png, 'image/png', { Cookie: cookie })).status, 403);
      assert.equal((await upload(Buffer.from('not an image'), 'image/png')).status, 415);
      assert.equal((await upload(Buffer.alloc(4 * 1024 * 1024 + 1), 'image/png')).status, 413);
      const uploaded = await upload(png, 'image/png');
      assert.equal(uploaded.status, 201);
      assert.equal(uploaded.data.provider, 'cloudinary');
      assert.equal(uploads, 1, 'rejected files never reach Cloudinary');
      const saved = await request('/admin/banners/bnr_test', { method: 'PUT', body: { mobileImageUrl: uploaded.data.url }, headers: browser });
      assert.equal(saved.data.banner.imageUrl, '/banners/new-desktop.webp');
      assert.equal(saved.data.banner.mobileImageUrl, uploaded.data.url);
    } finally {
      cloudinary.uploader.upload_stream = original;
      process.env.CLOUDINARY_URL = originalUrl;
    }
  });
});
