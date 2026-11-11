import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import ProductCard from '../../src/components/ProductCard.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';

vi.mock('../../src/context/MarketplaceContext.jsx', () => ({ useMarketplace: vi.fn() }));
const product = { _id: 'spice', slug: 'ceylon-spice', title: 'Ceylon Spice',
  sellerName: 'Test Pantry', sellerDistrict: 'Kandy', priceLkr: 1000, compareAtPriceLkr: 2000,
  stock: 10, images: ['/brand/yaans-mark-dark.png'] };
let addToCart;
let toggleWishlist;
beforeEach(() => {
  addToCart = vi.fn(); toggleWishlist = vi.fn();
  useMarketplace.mockReturnValue({ addToCart, toggleWishlist, wishlistIds: [] });
});

test('out-of-stock products cannot be added to the cart', () => {
  render(<MemoryRouter><ProductCard product={{ ...product, stock: 0 }} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Out of Stock' })).toBeDisabled();
  expect(addToCart).not.toHaveBeenCalled();
});

test('cart and wishlist actions identify the selected product', async () => {
  render(<MemoryRouter><ProductCard product={product} /></MemoryRouter>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
  await user.click(screen.getByRole('button', { name: 'Toggle wishlist' }));
  expect(addToCart).toHaveBeenCalledWith(product);
  expect(toggleWishlist).toHaveBeenCalledWith('spice');
  expect(screen.getByText('-50% OFF')).toBeInTheDocument();
});

test('only priority product images request eager loading', () => {
  const { rerender } = render(<MemoryRouter><ProductCard product={product} /></MemoryRouter>);
  expect(screen.getByAltText('Ceylon Spice')).toHaveAttribute('loading', 'lazy');
  rerender(<MemoryRouter><ProductCard product={product} priority /></MemoryRouter>);
  expect(screen.getByAltText('Ceylon Spice')).toHaveAttribute('loading', 'eager');
});
