import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import CheckoutPage from '../../src/pages/CheckoutPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import * as api from '../../src/utils/api.js';

vi.mock('../../src/context/MarketplaceContext.jsx', async (importOriginal) => ({
  ...await importOriginal(), useMarketplace: vi.fn()
}));

let marketplace;
beforeEach(() => {
  marketplace = {
    user: null, cartItems: [{ productId: 'spice', variantLabel: '100 g', quantity: 2 }],
    cartQuote: { codAvailable: true, sellerGroups: [], grandTotalLkr: 2420 },
    selectedDistrict: 'Colombo', setSelectedDistrict: vi.fn(), clearCart: vi.fn(), showToast: vi.fn()
  };
  useMarketplace.mockReturnValue(marketplace);
});

function checkout() {
  return render(<MemoryRouter><CheckoutPage /></MemoryRouter>);
}

async function fillAddress() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('e.g., Kasun Perera'), 'Test Customer');
  await user.type(screen.getByPlaceholderText('e.g., 077 412 3987'), '0771234567');
  await user.type(screen.getByPlaceholderText('e.g., kasun@gmail.com'), 'customer@test.invalid');
  await user.type(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya'), '42 Test Street');
  await user.type(screen.getByPlaceholderText('e.g., Colombo 05 / Maharagama / Katugastota'), 'Colombo');
  return user;
}

test('successful checkout sends item references and shows confirmation before clearing the cart', async () => {
  const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({
    order: { orderNumber: 'YLK-TEST-1001', grandTotalLkr: 2420, shippingAddress: { city: 'Colombo', district: 'Colombo' } },
    subOrders: []
  });
  const { container } = checkout();
  await fillAddress();
  fireEvent.submit(container.querySelector('form'));
  await screen.findByRole('heading', { name: /YLK-TEST-1001/ });
  expect(marketplace.clearCart).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(request.mock.calls[0][1].body);
  expect(payload.items).toEqual([{ productId: 'spice', variantLabel: '100 g', quantity: 2 }]);
  expect(payload.shippingAddress.district).toBe('Colombo');
  expect(payload.paymentMethod).toBe('COD');
  expect(payload).not.toHaveProperty('grandTotalLkr');
});

test('failed checkout keeps the cart and allows a retry', async () => {
  vi.spyOn(api, 'apiRequest').mockRejectedValue(new Error('Not enough stock'));
  const { container } = checkout();
  await fillAddress();
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(marketplace.showToast).toHaveBeenCalledWith('Not enough stock', 'error'));
  expect(marketplace.clearCart).not.toHaveBeenCalled();
  expect(container.querySelector('button[type="submit"]')).toBeEnabled();
});

test('COD confirmation is required before a checkout request is sent', async () => {
  const request = vi.spyOn(api, 'apiRequest');
  const { container } = checkout();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(container.querySelector('form'));
  expect(request).not.toHaveBeenCalled();
  expect(marketplace.showToast).toHaveBeenCalledWith(expect.stringContaining('confirm'), 'error');
});

test('signed-in customers can start from their default saved address', () => {
  marketplace.user = { name: 'Customer', email: 'customer@test.invalid', phone: '0771234567', addresses: [{
    _id: 'address', label: 'Home', isDefault: true, recipientName: 'Saved Recipient', phone: '0771112222',
    addressLine1: '7 Saved Lane', city: 'Kandy', district: 'Kandy'
  }] };
  checkout();
  expect(screen.getByPlaceholderText('e.g., Kasun Perera')).toHaveValue('Saved Recipient');
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('7 Saved Lane');
  expect(marketplace.setSelectedDistrict).toHaveBeenCalledWith('Kandy');
});
