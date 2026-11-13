import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { MarketplaceProvider } from '../../src/context/MarketplaceContext.jsx';
import CartPage from '../../src/pages/CartPage.jsx';
import Navbar from '../../src/components/Navbar.jsx';

const item = { productId: 'spice', title: 'Ceylon Spice', variantLabel: 'Small', quantity: 2, image: '/spice.jpg' };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function quote(items, destinationDistrict) {
  const subtotal = items.reduce((sum, line) => sum + line.quantity * 1200, 0);
  return { destinationDistrict, sellerCount: 1, codAvailable: true, itemsSubtotalLkr: subtotal,
    totalDeliveryFeeLkr: 350, grandTotalLkr: subtotal + 350, sellerGroups: [{
      sellerId: 'seller', sellerName: 'Spice Store', sellerDistrict: 'Kandy', deliveryFeeLkr: 350,
      grossTotalLkr: subtotal + 350, items: items.map(line => ({ ...item, ...line, unitPriceLkr: 1200, lineTotalLkr: line.quantity * 1200 }))
    }] };
}
const quoteCalls = () => fetch.mock.calls.filter(([url]) => url === '/api/orders/quote');
function cart() {
  return render(<MemoryRouter initialEntries={['/cart']}><MarketplaceProvider><Navbar /><CartPage /></MarketplaceProvider></MemoryRouter>);
}
function expectBadge(quantity) {
  for (const link of screen.getAllByRole('link', { name: `Cart, ${quantity} ${quantity === 1 ? 'item' : 'items'}` })) {
    if (quantity) expect(within(link).getByText(String(quantity), { exact: true })).toBeInTheDocument();
    else expect(within(link).queryByText('0')).not.toBeInTheDocument();
  }
}

beforeEach(() => {
  localStorage.setItem('yaans_cart', JSON.stringify([item]));
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/orders/quote') {
      const { items, destinationDistrict } = JSON.parse(options.body);
      return response(quote(items, destinationDistrict));
    }
    return response({ categories: [] });
  }));
});

test.each([409, 503])('HTTP %i keeps counted items visible and removable without zero totals or a false loading state', async status => {
  fetch.mockImplementation(async url => url === '/api/orders/quote'
    ? response({ message: 'A product or seller in your cart is currently unavailable.' }, status)
    : response({ categories: [] }));
  cart();
  expect(await screen.findByRole('alert')).toHaveTextContent('currently unavailable');
  expectBadge(2);
  expect(screen.getByRole('link', { name: 'Ceylon Spice' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeDisabled();
  expect(screen.queryByText('Cash on Delivery (COD) Available')).not.toBeInTheDocument();
  expect(screen.getAllByText('Pending verification').length).toBeGreaterThan(0);
  expect(quoteCalls()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Ceylon Spice' }));
  expect(screen.getByRole('heading', { name: /Shopping Cart is Empty/ })).toBeInTheDocument();
  expectBadge(0);
  expect(JSON.parse(localStorage.getItem('yaans_cart'))).toEqual([]);
  expect(quoteCalls()).toHaveLength(1);
});

test('pending quote shows saved items; retry restores authoritative prices without changing the count', async () => {
  let resolve;
  fetch.mockImplementation((url) => url === '/api/orders/quote'
    ? new Promise(done => { resolve = done; }) : Promise.resolve(response({ categories: [] })));
  cart();
  expect(screen.getByRole('status')).toHaveTextContent('Checking prices');
  expect(screen.getByRole('link', { name: 'Ceylon Spice' })).toBeInTheDocument();
  expectBadge(2);
  expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeDisabled();
  await act(async () => resolve(response({ message: 'Try again later.' }, 503)));
  fireEvent.click(screen.getByRole('button', { name: 'Retry cart check' }));
  expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeDisabled();
  await act(async () => resolve(response(quote([item], 'Colombo'))));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getAllByText('Rs. 2,750')).toHaveLength(2);
  expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeEnabled();
  expectBadge(2);
  expect(quoteCalls()).toHaveLength(2);
  const payload = JSON.parse(quoteCalls()[1][1].body);
  expect(payload.items).toEqual([{ productId: 'spice', variantLabel: 'Small', quantity: 2 }]);
});

test('quantity changes invalidate old totals and update both badges, including after reload', async () => {
  const first = cart();
  await waitFor(() => expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeEnabled());
  let resolve;
  fetch.mockImplementation(url => url === '/api/orders/quote'
    ? new Promise(done => { resolve = done; }) : Promise.resolve(response({ categories: [] })));
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Ceylon Spice' }));
  expectBadge(3);
  expect(screen.queryByText('Rs. 2,750')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Proceed to Checkout/ })).toBeDisabled();
  await act(async () => resolve(response(quote([{ ...item, quantity: 3 }], 'Colombo'))));
  expect(screen.getAllByText('Rs. 3,950')).toHaveLength(2);
  first.unmount();
  cart();
  expectBadge(3);
  fireEvent.click(screen.getByRole('button', { name: 'Clear Entire Cart' }));
  expectBadge(0);
  await act(async () => resolve(response(quote([{ ...item, quantity: 3 }], 'Colombo'))));
  expect(screen.getByRole('heading', { name: /Shopping Cart is Empty/ })).toBeInTheDocument();
});
