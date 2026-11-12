import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import ProductDetailPage from '../../src/pages/ProductDetailPage.jsx';
import SellerStorefrontPage from '../../src/pages/SellerStorefrontPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';

vi.mock('../../src/context/MarketplaceContext.jsx', async (original) => ({ ...await original(), useMarketplace: vi.fn() }));
const product = { _id: 'spice', title: 'Synthetic Spice', slug: 'synthetic-spice', sellerId: 'seller',
  sellerName: 'Synthetic Pantry', sellerSlug: 'synthetic-pantry', sellerDistrict: 'Kandy', priceLkr: 1000,
  stock: 100, images: [], description: 'Synthetic item', highlights: [], rating: 5, reviewCount: 21,
  variants: [{ name: 'Weight', values: [{ label: '100 g', priceLkr: 1000, stock: 50 }, { label: '250 g', priceLkr: 2000, stock: 50 }] }] };
const seller = { _id: 'seller', storeName: 'Synthetic Pantry', slug: 'synthetic-pantry', shippingPolicy: {}, rating: 5 };
const response = (data) => ({ ok: true, status: 200, json: async () => data });
let addToCart;
beforeEach(() => {
  addToCart = vi.fn();
  useMarketplace.mockReturnValue({ user: null, selectedDistrict: 'Colombo', wishlistIds: [], addToCart,
    toggleWishlist: vi.fn(), setSelectedDistrict: vi.fn(), showToast: vi.fn() });
});

test('review navigation fetches the next page and preserves the chosen product variant', async () => {
  vi.stubGlobal('fetch', vi.fn(async (raw) => {
    const url = new URL(raw, 'http://test.local'); const page = Number(url.searchParams.get('reviewPage') || 1);
    return response({ product, seller, relatedProducts: [], shippingEstimate: { deliveryFeeLkr: 350 },
      reviews: [{ _id: `review-${page}`, customerName: 'Synthetic Reviewer', rating: 5, comment: `Review page ${page}` }],
      reviewPagination: { page, limit: 20, total: 21, totalPages: 2 } });
  }));
  render(<MemoryRouter initialEntries={['/products/spice']}><Routes><Route path="/products/:idOrSlug" element={<ProductDetailPage />} /></Routes></MemoryRouter>);
  const user = userEvent.setup();
  await screen.findByText('Review page 1');
  await user.click(screen.getByRole('button', { name: /^250 g/ }));
  await user.click(screen.getByRole('button', { name: 'Next reviews' }));
  await screen.findByText('Review page 2');
  expect(screen.queryByText('Review page 1')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next reviews' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: /Add to Cart/i }));
  expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ _id: 'spice' }), '250 g', 1);
  await user.click(screen.getByRole('button', { name: 'Previous reviews' }));
  await screen.findByText('Review page 1');
});

test('storefront pagination shows complete totals and makes all pages reachable', async () => {
  vi.stubGlobal('fetch', vi.fn(async (raw) => {
    const url = new URL(raw, 'http://test.local'); const page = Number(url.searchParams.get('page') || 1);
    return response({ seller, products: [{ ...product, _id: `product-${page}`, title: `Store product page ${page}`, variants: [] }],
      pagination: { page, limit: 12, total: 13, totalPages: 2 } });
  }));
  render(<MemoryRouter initialEntries={['/seller/synthetic-pantry']}><Routes><Route path="/seller/:slugOrId" element={<SellerStorefrontPage />} /></Routes></MemoryRouter>);
  const user = userEvent.setup();
  await screen.findByText('Store product page 1');
  expect(screen.getByText('Products from Synthetic Pantry (13)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous products' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next products' }));
  await screen.findByText('Store product page 2');
  expect(screen.queryByText('Store product page 1')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next products' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Previous products' }));
  await waitFor(() => expect(screen.getByText('Store product page 1')).toBeInTheDocument());
});
