import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import CheckoutPage from '../../src/pages/CheckoutPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import * as api from '../../src/utils/api.js';
import { prepareCustomerAuth, readCheckoutDraft, saveCheckoutDraft } from '../../src/utils/checkoutDraft.js';

vi.mock('../../src/context/MarketplaceContext.jsx', async (importOriginal) => ({
  ...await importOriginal(), useMarketplace: vi.fn()
}));

let marketplace;
beforeEach(() => {
  sessionStorage.clear();
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

test('checkout offers optional sign-in and saves delivery fields only on auth navigation', async () => {
  checkout(); await fillAddress();
  expect(sessionStorage.getItem('yaans_checkout_draft_v1')).toBeNull();
  expect(screen.getByRole('link', { name: 'Continue as guest' })).toHaveAttribute('href', '#delivery-details');
  expect(screen.getByRole('link', { name: 'Sign in to continue checkout' })).toHaveAttribute('href', '/login?redirect=%2Fcheckout');
  prepareCustomerAuth();
  expect(readCheckoutDraft(marketplace.cartItems, null).addressLine1).toBe('42 Test Street');
});

test('resuming checkout preserves the draft over account defaults and never submits automatically', () => {
  saveCheckoutDraft(marketplace.cartItems, null, { recipientName: 'Draft Recipient', phone: '0771234567', addressLine1: 'Draft Street', city: 'Galle', district: 'Galle' });
  marketplace.user = { _id: 'customer', role: 'customer', name: 'Account Name', addresses: [{ _id: 'saved', recipientName: 'Saved Name', phone: '0779999999', addressLine1: 'Saved Street', city: 'Colombo', district: 'Colombo' }] };
  const request = vi.spyOn(api, 'apiRequest'); checkout();
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('Draft Street');
  expect(marketplace.setSelectedDistrict).toHaveBeenCalledWith('Galle');
  expect(request).not.toHaveBeenCalled();
});

test('expired session prompts reauthentication while keeping entered details', async () => {
  vi.spyOn(api, 'apiRequest').mockRejectedValue(Object.assign(new Error('Please sign in again.'), { status: 401 }));
  const { container } = checkout(); await fillAddress(); fireEvent.submit(container.querySelector('form'));
  expect(await screen.findByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/login?redirect=%2Fcheckout');
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('42 Test Street');
  expect(marketplace.clearCart).not.toHaveBeenCalled();
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
  marketplace.selectedDistrict = 'Kandy';
  marketplace.user = { _id: 'customer', role: 'customer', name: 'Customer', email: 'customer@test.invalid', phone: '0771234567', addresses: [{
    _id: 'address', label: 'Home', isDefault: true, recipientName: 'Saved Recipient', phone: '0771112222',
    addressLine1: '7 Saved Lane', city: 'Kandy', district: 'Kandy'
  }] };
  checkout();
  expect(screen.getByPlaceholderText('e.g., Kasun Perera')).toHaveValue('Saved Recipient');
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('7 Saved Lane');
  expect(marketplace.setSelectedDistrict).not.toHaveBeenCalled();
});

test('a saved address in another district is applied only when explicitly selected', async () => {
  marketplace.user = { _id: 'customer', role: 'customer', name: 'Customer', addresses: [{ _id: 'saved', label: 'Home', recipientName: 'Saved Recipient', phone: '0771112222', addressLine1: '7 Saved Lane', city: 'Kandy', district: 'Kandy' }] };
  checkout();
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('');
  expect(marketplace.setSelectedDistrict).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: /Home/ }));
  expect(screen.getByPlaceholderText('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('7 Saved Lane');
  expect(marketplace.setSelectedDistrict).toHaveBeenCalledWith('Kandy');
});

test('duplicate form submission sends one request and an ambiguous retry preserves its key across remounts', async () => {
  let reject;
  const request = vi.spyOn(api, 'apiRequest').mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  const first = checkout();
  await fillAddress();
  fireEvent.submit(first.container.querySelector('form'));
  fireEvent.submit(first.container.querySelector('form'));
  expect(request).toHaveBeenCalledTimes(1);
  const key = request.mock.calls[0][1].headers['Idempotency-Key'];
  reject(new Error('Response was lost'));
  await waitFor(() => expect(marketplace.showToast).toHaveBeenCalledWith('Response was lost', 'error'));
  first.unmount();
  request.mockResolvedValueOnce({ order: { orderNumber: 'YLK-TEST-RECOVERED', grandTotalLkr: 2420,
    shippingAddress: { city: 'Colombo', district: 'Colombo' } }, subOrders: [], guestAccessToken: 'a'.repeat(43) });
  const second = checkout();
  await fillAddress();
  fireEvent.submit(second.container.querySelector('form'));
  await screen.findByRole('heading', { name: /YLK-TEST-RECOVERED/ });
  expect(request.mock.calls[1][1].headers['Idempotency-Key']).toBe(key);
  expect(screen.getByText('a'.repeat(43))).toBeVisible();
  expect(sessionStorage.getItem('yaans_guest_order_access_v1:YLK-TEST-RECOVERED')).toBe('a'.repeat(43));
});

test('changed details after an uncertain checkout recover the original order rather than creating a second one', async () => {
  const conflict = Object.assign(new Error('Earlier order completed'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  const request = vi.spyOn(api, 'apiRequest').mockRejectedValueOnce(conflict).mockResolvedValueOnce({
    order: { orderNumber: 'YLK-TEST-ORIGINAL', grandTotalLkr: 2420, shippingAddress: { city: 'Colombo', district: 'Colombo' } }, subOrders: []
  });
  const { container } = checkout(); await fillAddress();
  fireEvent.submit(container.querySelector('form'));
  await screen.findByRole('heading', { name: /YLK-TEST-ORIGINAL/ });
  expect(request.mock.calls[1][0]).toBe('/orders/checkout-result');
  expect(request.mock.calls[1][1].headers['Idempotency-Key']).toBe(request.mock.calls[0][1].headers['Idempotency-Key']);
});

test('payment method options apply themed card classes and concise mobile copy', () => {
  checkout();
  const codRadio = screen.getByRole('radio', { checked: true });
  const codCard = codRadio.closest('label');
  expect(codCard).toHaveClass('payment-card-selected');

  const onlineRadio = screen.getByRole('radio', { checked: false });
  expect(onlineRadio).toBeDisabled();
  const onlineCard = onlineRadio.closest('div');
  expect(onlineCard).toHaveClass('payment-card-unselected');

  const mobileCod = screen.getByText('Pay cash to rider.');
  expect(mobileCod).toHaveClass('sm:hidden');
  expect(mobileCod.textContent.trim().split(/\s+/).length).toBeLessThanOrEqual(4);

  const mobileOnline = screen.getByText('Online payments coming soon.');
  expect(mobileOnline).toHaveClass('sm:hidden');
  expect(mobileOnline.textContent.trim().split(/\s+/).length).toBeLessThanOrEqual(4);

  expect(screen.getByText(/Pay cash in Sri Lankan Rupees directly to the delivery rider/)).toHaveClass('hidden', 'sm:inline');
  expect(screen.getByText(/Visa, MasterCard, and LankaQR instant online payments are pre-architected/)).toHaveClass('hidden', 'sm:inline');
});
