import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { prepareProductImage, validateProductImages } from '../src/services/productImages.js';

test('gallery validation bounds new galleries and preserves legacy photos without truncation', () => {
  const images = Array.from({length: 8}, (_, i) => `https://example.com/${i}.jpg`);
  assert.deepEqual(validateProductImages(images), images);
  for (const invalid of [[], null, 'https://example.com/a.jpg', [...images, '/extra.jpg'], ['javascript:alert(1)'], ['//example.com/a'], ['https://user:pass@example.com/a'], [4]]) {
    assert.throws(() => validateProductImages(invalid), {status: 400});
  }
  const legacy = [...images, '/nine.jpg', '/ten.jpg'];
  assert.deepEqual(validateProductImages(legacy, legacy), legacy);
  assert.deepEqual(validateProductImages([...legacy].reverse(), legacy), [...legacy].reverse());
  assert.throws(() => validateProductImages([...legacy.slice(0, 9), '/new.jpg'], legacy));
});

test('product uploads decode, orient, resize and strip metadata before storage', async () => {
  const original = await sharp({create:{width:2000,height:1000,channels:3,background:'red'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const result = await prepareProductImage(original);
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 800); assert.equal(metadata.height, 1600);
  assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
});

test('invalid, oversized, animated and excessive-pixel images are rejected', async () => {
  const excessive = await sharp({create:{width:5100,height:5000,channels:3,background:'white'}}).png().toBuffer();
  const animated = await sharp({create:{width:2,height:4,channels:3,background:'red'}}).raw().toBuffer();
  animated.fill(255, 12);
  const webp = await sharp(animated, {raw:{width:2,height:4,channels:3,pageHeight:2}}).webp({loop:0,delay:[100,100]}).toBuffer();
  for (const buffer of [Buffer.from('<svg/>'), Buffer.from([255,216,255,1]), Buffer.alloc(4*1024*1024+1), excessive, webp]) {
    await assert.rejects(prepareProductImage(buffer), {status:415});
  }
});
