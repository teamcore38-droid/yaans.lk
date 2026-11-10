import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageLoaders, prefetchPage } from '../src/utils/navigation.js';

test('legal page loaders are defined as async loader functions', () => {
  assert.equal(typeof pageLoaders.privacy, 'function');
  assert.equal(typeof pageLoaders.terms, 'function');
  assert.equal(typeof pageLoaders.cookies, 'function');
});

test('prefetchPage handles legal route paths gracefully without throwing', () => {
  const storage = () => {
    const map = new Map();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k)
    };
  };

  globalThis.localStorage = storage();
  globalThis.window = {
    location: {
      origin: 'https://yaans.lk'
    }
  };

  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/privacy'));
  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/privacy-policy'));
  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/terms'));
  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/terms-and-conditions'));
  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/cookies'));
  assert.doesNotThrow(() => prefetchPage('https://yaans.lk/cookies-policy'));
});
