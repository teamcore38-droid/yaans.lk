import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MarketplaceProvider, useMarketplace } from '../../src/context/MarketplaceContext.jsx';

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

test('sign-out waits for server revocation and keeps the session when the server fails',async()=>{
  document.cookie='yaans_csrf=synthetic-session; path=/';
  localStorage.setItem('yaans_user',JSON.stringify({name:'Saved Customer'}));
  let fail=true;
  fetch.mockImplementation(async url=>url.endsWith('/auth/me')?response({user:{name:'Saved Customer'}}):url.endsWith('/auth/logout')?response({message:'Unavailable'},fail?503:200):response({categories:[]}));
  const {result}=renderHook(useMarketplace,{wrapper});await act(async()=>{});
  await act(async()=>{expect(await result.current.logout()).toBe(false);});expect(result.current.user.name).toBe('Saved Customer');
  fail=false;await act(async()=>{expect(await result.current.logout()).toBe(true);});expect(result.current.user).toBeNull();expect(localStorage.getItem('yaans_token')).toBeNull();
});
