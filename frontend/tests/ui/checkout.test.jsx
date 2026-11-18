import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import CheckoutPage from '../../src/pages/CheckoutPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import * as api from '../../src/utils/api.js';
import { prepareCustomerAuth, readCheckoutDraft, saveCheckoutDraft } from '../../src/utils/checkoutDraft.js';
import { checkoutKey, clearCheckoutKey } from '../../src/utils/orderAccess.js';

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

function checkout(path = '/checkout') {
  return render(<MemoryRouter initialEntries={[path]}><CheckoutPage /></MemoryRouter>);
}

test('direct checkout quotes and orders only the selected option while preserving the saved cart', async () => {
  marketplace.cartItems = [{ productId: 'lamp', variantLabel: 'Standard', quantity: 3 }];
  const request = vi.spyOn(api, 'apiRequest').mockImplementation(async (endpoint) => endpoint === '/orders/quote'
    ? { codAvailable: true, sellerGroups: [], grandTotalLkr: 2000 }
    : { order: { orderNumber: 'YLK-DIRECT-1', grandTotalLkr: 2000, shippingAddress: { city: 'Colombo', district: 'Colombo' } }, subOrders: [] });
  const { container } = checkout('/checkout?buyNow=spice&variant=250+g&quantity=2');
  await screen.findByRole('button', { name: 'Confirm COD Order (Rs. 2,000)' });
  await fillAddress();
  fireEvent.submit(container.querySelector('form'));
  await screen.findByRole('heading', { name: /YLK-DIRECT-1/ });
  const quote = JSON.parse(request.mock.calls.find(([endpoint]) => endpoint === '/orders/quote')[1].body);
  const order = JSON.parse(request.mock.calls.find(([endpoint]) => endpoint === '/orders/checkout')[1].body);
  expect(quote.items).toEqual([{ productId: 'spice', variantLabel: '250 g', quantity: 2 }]);
  expect(order.items).toEqual(quote.items);
  expect(marketplace.clearCart).not.toHaveBeenCalled();
  expect(marketplace.cartItems).toEqual([{ productId: 'lamp', variantLabel: 'Standard', quantity: 3 }]);
});

test('invalid direct selection cannot submit the saved cart', () => {
  const request = vi.spyOn(api, 'apiRequest');
  checkout('/checkout?buyNow=spice&variant=250+g&quantity=100');
  expect(screen.getByRole('heading', { name: 'No items to checkout' })).toBeVisible();
  expect(request).not.toHaveBeenCalled();
});

test('direct quote failure blocks submission and can be retried without changing the cart', async () => {
  const request = vi.spyOn(api, 'apiRequest')
    .mockRejectedValueOnce(new Error('Quote unavailable'))
    .mockResolvedValueOnce({ codAvailable: true, sellerGroups: [], grandTotalLkr: 1200 });
  checkout('/checkout?buyNow=spice&variant=100+g&quantity=1');
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: /Confirm COD Order/ })).toBeDisabled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry product check' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm COD Order (Rs. 1,200)' })).toBeEnabled());
  expect(request.mock.calls.filter(([endpoint]) => endpoint === '/orders/quote')).toHaveLength(2);
  expect(marketplace.clearCart).not.toHaveBeenCalled();
});

test('direct checkout retry key survives guest sign-in and stays separate from the cart', () => {
  const selection = JSON.stringify([{ productId: 'spice', variantLabel: '100 g', quantity: 1 }]);
  const guestKey = checkoutKey('guest', selection);
  expect(checkoutKey('customer', selection)).toBe(guestKey);
  expect(checkoutKey('guest')).not.toBe(guestKey);
  clearCheckoutKey('customer', selection);
  clearCheckoutKey('guest');
});

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
