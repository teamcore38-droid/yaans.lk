import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import GoogleCustomerLogin from '../../src/components/GoogleCustomerLogin.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import { apiRequest } from '../../src/utils/api.js';

vi.mock('../../src/utils/api.js', () => ({ apiRequest: vi.fn() }));
vi.mock('../../src/context/MarketplaceContext.jsx', async original => ({ ...await original(), useMarketplace: vi.fn() }));
let refreshUser;
beforeEach(() => {
  refreshUser = vi.fn().mockResolvedValue({ role: 'customer' }); useMarketplace.mockReturnValue({ refreshUser });
  apiRequest.mockReset();
});
function page(path = '/login', purpose) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<GoogleCustomerLogin purpose={purpose} />} />
    <Route path="/checkout" element={<h1>Checkout destination</h1>} />
    <Route path="/account" element={<h1>Customer account</h1>} />
  </Routes></MemoryRouter>);
}
function provider(mode = 'register') {
  apiRequest.mockImplementation(async (endpoint) => {
    if (endpoint === '/auth/google/config') return { enabled: true, origin: window.location.origin };
    if (endpoint === '/auth/google/pending') return { mode, email: 'customer@gmail.com', name: 'Google Customer', csrf: 'pending-proof' };
    if (endpoint === '/auth/google/complete') return { returnTo: '/checkout' };
    throw new Error('Unexpected request');
  });
}

test('disabled Google login renders no extra controls and does not interrupt password login', async () => {
  apiRequest.mockResolvedValue({ enabled: false }); const { container } = page();
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/google/config'));
  expect(container.textContent).toBe('');
});

test('new Google customer completes required profile without a password and restores the session', async () => {
  provider(); page('/login?google=complete'); const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Complete your customer profile' });
  expect(screen.queryByLabelText(/password/i)).toBeNull();
  await user.type(screen.getByLabelText('Sri Lankan mobile number'), '0771234567');
  await user.selectOptions(screen.getByLabelText('Your district'), 'Kandy');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Create customer account' }));
  await screen.findByRole('heading', { name: 'Checkout destination' });
  expect(apiRequest).toHaveBeenCalledWith('/auth/google/complete', expect.objectContaining({ method: 'POST', headers: { 'X-Google-CSRF': 'pending-proof' }, body: JSON.stringify({ name: 'Google Customer', phone: '0771234567', defaultDistrict: 'Kandy', acceptTerms: true }) }));
  expect(refreshUser).toHaveBeenCalledTimes(1);
});

test('existing customer sees password-confirmed linking and API errors preserve the form', async () => {
  provider('link'); const implementation = apiRequest.getMockImplementation();
  apiRequest.mockImplementation(endpoint => endpoint === '/auth/google/complete' ? Promise.reject(new Error('Your current Yaans password is required.')) : implementation(endpoint));
  page('/login?google=complete'); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Current Yaans password'), 'incorrect-password');
  await user.click(screen.getByRole('button', { name: 'Link Google and sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your current Yaans password is required.');
  expect(refreshUser).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Link Google and sign in' })).toBeEnabled();
});

test('Google password setup requires matching new passwords and never asks for an invented current password', async () => {
  provider('set-password'); page('/login?google=complete'); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('New password'), 'Long-new-password!123');
  await user.type(screen.getByLabelText('Confirm new password'), 'Different-password!456');
  await user.click(screen.getByRole('button', { name: 'Create password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('New passwords do not match.');
  expect(screen.queryByLabelText('Current Yaans password')).toBeNull();
  expect(apiRequest.mock.calls.some(([endpoint]) => endpoint === '/auth/google/complete')).toBe(false);
});

test('cancelled sign-in has an accessible error and allows a fresh attempt', async () => {
  provider(); page('/login?google=failed');
  expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in was cancelled');
  expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});

test('alternate origins offer a canonical-site link without initiating OAuth on the wrong host', async () => {
  apiRequest.mockResolvedValue({ enabled: true, origin: 'https://yaans.lk' }); page('/login?redirect=//untrusted.invalid');
  const link = await screen.findByRole('link', { name: 'Continue on the main Yaans website' });
  expect(link).toHaveAttribute('href', 'https://yaans.lk/login?redirect=%2Faccount');
  expect(screen.queryByRole('button')).toBeNull();
});
