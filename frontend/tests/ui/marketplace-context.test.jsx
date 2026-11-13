import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MarketplaceProvider, useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import { saveCheckoutDraft, readCheckoutDraft } from '../../src/utils/checkoutDraft.js';

const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const wrapper = ({ children }) => <MarketplaceProvider>{children}</MarketplaceProvider>;
const product = { _id: 'spice', title: 'Ceylon Spice', priceLkr: 1000,
  variants: [{ values: [{ label: 'Small', priceLkr: 1000 }, { label: 'Large', priceLkr: 2000 }] }] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/orders/quote') {
      const { destinationDistrict, items } = JSON.parse(options.body);
      return response({ destinationDistrict, grandTotalLkr: items.reduce((sum, item) => sum + item.quantity * 1000, 0) });
    }
    return response({ categories: [] });
  }));
});

test('corrupt saved user/cart/wishlist data falls back to an empty session', async () => {
  for (const key of ['yaans_user', 'yaans_cart', 'yaans_wishlist']) localStorage.setItem(key, '{broken');
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {});
  expect(result.current.user).toBeNull();
  expect(result.current.cartItems).toEqual([]);
  expect(result.current.wishlistIds).toEqual([]);
});

test('merges identical variants while retaining a separate price and row for other variants', async () => {
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {
    result.current.addToCart(product, 'Small', 1);
    result.current.addToCart(product, 'Small', 2);
    result.current.addToCart(product, 'Large', 1);
  });
  expect(result.current.totalCartItems).toBe(4);
  expect(result.current.cartItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ variantLabel: 'Small', quantity: 3, unitPriceLkr: 1000 }),
    expect.objectContaining({ variantLabel: 'Large', quantity: 1, unitPriceLkr: 2000 })
  ]));
  expect(JSON.parse(localStorage.getItem('yaans_cart'))).toHaveLength(2);
});

test('removing the last item clears the quote and persisted cart', async () => {
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => result.current.addToCart(product, 'Small'));
  await waitFor(() => expect(result.current.cartQuote).not.toBeNull());
  await act(async () => result.current.updateCartQuantity('spice', 'Small', 0));
  expect(result.current.cartItems).toEqual([]);
  expect(result.current.cartQuote).toBeNull();
  expect(JSON.parse(localStorage.getItem('yaans_cart'))).toEqual([]);
});

test('guest wishlists persist and toggle without an authenticated request', async () => {
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => result.current.toggleWishlist('spice'));
  expect(result.current.wishlistIds).toEqual(['spice']);
  expect(JSON.parse(localStorage.getItem('yaans_wishlist'))).toEqual(['spice']);
  await act(async () => result.current.toggleWishlist('spice'));
  expect(result.current.wishlistIds).toEqual([]);
  expect(fetch.mock.calls.some(([url]) => url.includes('/wishlist/'))).toBe(false);
});

test.each([401, 403, 503])('session refresh with HTTP %i clears credentials only for an invalid session', async (status) => {
  localStorage.setItem('yaans_token', 'session-token');
  document.cookie='yaans_csrf=synthetic-csrf; path=/';
  localStorage.setItem('yaans_user', JSON.stringify({ name: 'Saved Customer' }));
  fetch.mockImplementation(async (url) => url.endsWith('/auth/me')
    ? response({ message: 'Unavailable' }, status) : response({ categories: [] }));
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {});
  if (status === 503) {
    expect(localStorage.getItem('yaans_token')).toBeNull();
    expect(result.current.user.name).toBe('Saved Customer');
  } else {
    expect(localStorage.getItem('yaans_token')).toBeNull();
    expect(result.current.user).toBeNull();
  }
});

test('an older cart quote cannot overwrite the quote for the newly selected district', async () => {
  localStorage.setItem('yaans_cart', JSON.stringify([{ productId: 'spice', quantity: 1 }]));
  const pending = {};
  fetch.mockImplementation((url, options) => url.endsWith('/orders/quote')
    ? new Promise((resolve) => { pending[JSON.parse(options.body).destinationDistrict] = resolve; })
    : Promise.resolve(response({ categories: [] })));
  const { result } = renderHook(useMarketplace, { wrapper });
  await waitFor(() => expect(pending.Colombo).toBeTypeOf('function'));
  act(() => result.current.setSelectedDistrict('Kandy'));
  await waitFor(() => expect(pending.Kandy).toBeTypeOf('function'));
  await act(async () => pending.Kandy(response({ destinationDistrict: 'Kandy' })));
  await act(async () => pending.Colombo(response({ destinationDistrict: 'Colombo' })));
  expect(result.current.cartQuote.destinationDistrict).toBe('Kandy');
  expect(localStorage.getItem('yaans_district')).toBe('Kandy');
});

test('password login preserves the chosen shopping district and logout clears a pending checkout draft', async () => {
  const customer = { _id: 'customer', role: 'customer', name: 'Customer', defaultDistrict: 'Colombo' };
  localStorage.setItem('yaans_district', 'Galle');
  fetch.mockImplementation(async url => response(url.endsWith('/auth/login') ? { user: customer } : { categories: [] }));
  const { result } = renderHook(useMarketplace, { wrapper });
  saveCheckoutDraft([{ productId: 'spice', quantity: 1 }], null, { district: 'Galle' });
  await act(async () => { await result.current.login('customer@test.invalid', 'password'); });
  expect(result.current.selectedDistrict).toBe('Galle');
  expect(readCheckoutDraft([{ productId: 'spice', quantity: 1 }], customer)).not.toBeNull();
  await act(async () => { await result.current.logout(); });
  expect(readCheckoutDraft([{ productId: 'spice', quantity: 1 }], customer)).toBeNull();
});

test('sign-out waits for server revocation and keeps the session when the server fails',async()=>{
  document.cookie='yaans_csrf=synthetic-session; path=/';
  localStorage.setItem('yaans_user',JSON.stringify({name:'Saved Customer'}));
  let fail=true;
  fetch.mockImplementation(async url=>url.endsWith('/auth/me')?response({user:{name:'Saved Customer'}}):url.endsWith('/auth/logout')?response({message:'Unavailable'},fail?503:200):response({categories:[]}));
  const {result}=renderHook(useMarketplace,{wrapper});await act(async()=>{});
  await act(async()=>{expect(await result.current.logout()).toBe(false);});expect(result.current.user.name).toBe('Saved Customer');
  fail=false;await act(async()=>{expect(await result.current.logout()).toBe(true);});expect(result.current.user).toBeNull();expect(localStorage.getItem('yaans_token')).toBeNull();
});

test.each([null, {}, 'invalid', 3])('non-array persisted carts (%j) are discarded safely', async saved => {
  localStorage.setItem('yaans_cart', JSON.stringify(saved));
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {});
  expect(result.current.cartItems).toEqual([]);
  expect(result.current.totalCartItems).toBe(0);
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/orders/quote'))).toBe(false);
});

test('saved quantities are numeric, duplicate variants merge, and malformed selections cannot inflate the badge', async () => {
  localStorage.setItem('yaans_cart', JSON.stringify([
    { productId: 'spice', quantity: '2' }, { productId: 'spice', quantity: 3 },
    null, {}, { productId: {}, quantity: 1 }, { productId: 'bad', quantity: -1 },
    { productId: 'bad', quantity: 1.5 }, { productId: 'bad', quantity: 100 },
    { productId: 'bad', quantity: '1e2' }, { productId: 'bad', quantity: 1, variantLabel: {} }
  ]));
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {});
  expect(result.current.cartItems).toHaveLength(1);
  expect(result.current.cartItems[0]).toMatchObject({ productId: 'spice', variantLabel: 'Standard', quantity: 5 });
  expect(result.current.totalCartItems).toBe(5);
  const call = fetch.mock.calls.find(([url]) => url.endsWith('/orders/quote'));
  expect(JSON.parse(call[1].body).items).toEqual([{ productId: 'spice', variantLabel: 'Standard', quantity: 5 }]);
});

test('cart quantity and selection limits match the API limits', async () => {
  localStorage.setItem('yaans_cart', JSON.stringify([
    { productId: 'spice', quantity: 98 }, { productId: 'spice', quantity: 3 },
    ...Array.from({ length: 55 }, (_, index) => ({ productId: `product-${index}`, quantity: 1 }))
  ]));
  const { result } = renderHook(useMarketplace, { wrapper });
  await act(async () => {});
  expect(result.current.cartItems).toHaveLength(50);
  expect(result.current.cartItems[0].quantity).toBe(99);
  act(() => result.current.updateCartQuantity('spice', 'Standard', 100));
  act(() => result.current.updateCartQuantity('spice', 'Standard', '4'));
  expect(result.current.cartItems[0].quantity).toBe(99);
  act(() => result.current.addToCart(product, 'Small', -1));
  expect(result.current.cartItems).toHaveLength(50);
  act(() => result.current.addToCart(product, 'Small', 1));
  expect(result.current.cartItems).toHaveLength(50);
  expect(result.current.toast.type).toBe('error');
  act(() => result.current.addToCart(product, 'Standard', 1));
  expect(result.current.cartItems[0].quantity).toBe(99);
  expect(result.current.toast.message).toContain('cannot exceed 99');
});

test('another tab updates or clears the cart without a redundant request for unchanged storage', async () => {
  const { result } = renderHook(useMarketplace, { wrapper });
  const next = JSON.stringify([{ productId: 'spice', quantity: 2 }]);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'yaans_cart', newValue: next, storageArea: localStorage })));
  await waitFor(() => expect(result.current.totalCartItems).toBe(2));
  await waitFor(() => expect(result.current.quoteLoading).toBe(false));
  const calls = fetch.mock.calls.length;
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'yaans_cart', newValue: next, storageArea: localStorage })));
  expect(fetch.mock.calls).toHaveLength(calls);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null, storageArea: localStorage })));
  expect(result.current.totalCartItems).toBe(0);
  expect(result.current.cartQuote).toBeNull();
  expect(result.current.quoteError).toBeNull();
});

test('a stale failed quote cannot erase a newer successful quote', async () => {
  localStorage.setItem('yaans_cart', JSON.stringify([{ productId: 'spice', quantity: 1 }]));
  const pending = [];
  fetch.mockImplementation((url) => url.endsWith('/orders/quote')
    ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(response({ categories: [] })));
  const { result } = renderHook(useMarketplace, { wrapper });
  await waitFor(() => expect(pending).toHaveLength(1));
  act(() => result.current.updateCartQuantity('spice', 'Standard', 2));
  expect(result.current.cartQuote).toBeNull();
  expect(result.current.quoteLoading).toBe(true);
  await act(async () => pending[1](response({ grandTotalLkr: 2000 })));
  await act(async () => pending[0](response({ message: 'Out of stock' }, 409)));
  expect(result.current.cartQuote.grandTotalLkr).toBe(2000);
  expect(result.current.quoteError).toBeNull();
  expect(result.current.quoteLoading).toBe(false);
});
