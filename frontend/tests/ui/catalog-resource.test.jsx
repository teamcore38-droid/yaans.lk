import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useCatalogResource } from '../../src/hooks/useCatalogResource.js';

const response = (body) => ({ ok: true, json: async () => body });

test('navigation clears the previous product and ignores its late network response', async () => {
  const pending = {};
  vi.stubGlobal('fetch', vi.fn((url) => new Promise((resolve) => { pending[url] = resolve; })));
  const { result, rerender } = renderHook(({ endpoint }) => useCatalogResource(endpoint), {
    initialProps: { endpoint: '/marketplace/products/first' }
  });
  rerender({ endpoint: '/marketplace/products/second' });
  expect(result.current.data).toBeNull();
  await act(async () => pending['/api/marketplace/products/second'](response({ product: { _id: 'second' } })));
  await act(async () => pending['/api/marketplace/products/first'](response({ product: { _id: 'first' } })));
  expect(result.current.data.product._id).toBe('second');
  expect(result.current.loading).toBe(false);
});

test('network failure ends loading so the page can show an empty/error state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
  const { result } = renderHook(() => useCatalogResource('/marketplace/products/missing'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toBeNull();
});

test('local updates modify the currently displayed resource', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({ product: { _id: 'one', reviewCount: 0 } })));
  const { result } = renderHook(() => useCatalogResource('/marketplace/products/one'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setData((previous) => ({ ...previous, product: { ...previous.product, reviewCount: 1 } })));
  expect(result.current.data.product.reviewCount).toBe(1);
});
