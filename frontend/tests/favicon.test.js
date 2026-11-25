import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import sharp from 'sharp';

const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);

async function assertIcon(file, size) {
  const { data, info } = await sharp(file).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size);
  assert.equal(info.height, size);
  let redPixels = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = 4 * (y * size + x);
      const red = data[offset] - Math.max(data[offset + 1], data[offset + 2]) > 50;
      assert.equal(data[offset + 3], 255, 'The background must be opaque.');
      if (red) redPixels++;
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
        assert.ok(data.subarray(offset, offset + 3).every(channel => channel >= 240), 'Keep white space around the entire Y.');
      }
    }
  }
  assert.ok(redPixels > size ** 2 * 0.15, 'The favicon should use the red artwork.');
}

test('favicon files contain the full red mark on white at each declared size', async () => {
  const ico = await readFile(publicFile('favicon.ico'));
  assert.deepEqual([...ico.subarray(0, 6)], [0, 0, 1, 0, 3, 0]);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + 16 * index;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.deepEqual([...ico.subarray(entry, entry + 2)], [size, size]);
    assert.ok(offset >= 54 && offset + length <= ico.length);
    await assertIcon(ico.subarray(offset, offset + length), size);
  }
  await assertIcon(await readFile(publicFile('favicon.png')), 96);
  await assertIcon(await readFile(publicFile('brand/apple-touch-icon.png')), 180);
});

test('Vercel serves icon files outside the app rewrite and keeps admin routes inside it', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const { source } = config.rewrites.find(rule => rule.destination === '/index.html');
  const appRoute = new RegExp(`^${source}$`);
  for (const path of ['/favicon.ico', '/favicon.png', '/brand/apple-touch-icon.png', '/assets/app.js', '/api/health']) {
    assert.equal(appRoute.test(path), false, path);
  }
  for (const path of ['/', '/admin', '/admin/login', '/staff/login', '/products']) {
    assert.equal(appRoute.test(path), true, path);
  }
});
