import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { LoginPage } from '../../src/pages/AuthAccountPages.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';

vi.mock('../../src/context/MarketplaceContext.jsx', async (importOriginal) => ({
  ...await importOriginal(), useMarketplace: vi.fn()
}));
let login;
let showToast;
beforeEach(() => {
  login = vi.fn(); showToast = vi.fn();
  useMarketplace.mockReturnValue({ login, showToast });
});

function page() {
  render(<MemoryRouter initialEntries={['/login']}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account" element={<h1>Customer Account</h1>} />
      <Route path="/seller/dashboard" element={<h1>Seller Dashboard</h1>} />
    </Routes>
  </MemoryRouter>);
}

test.each([['customer', 'Customer Account'], ['seller', 'Seller Dashboard']])('successful %s login navigates to the correct account area', async (role, heading) => {
  login.mockResolvedValue({ role });
  page();
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('name@example.lk'), 'CUSTOMER@TEST.INVALID');
  await user.type(screen.getByPlaceholderText('••••••••'), 'Testing@123');
  await user.click(screen.getByRole('button', { name: 'Sign In', exact: true }));
  await screen.findByRole('heading', { name: heading });
  expect(login).toHaveBeenCalledWith('customer@test.invalid', 'Testing@123');
});

test('failed login displays the API message and re-enables the form', async () => {
  login.mockRejectedValue(new Error('Invalid email or password.'));
  page();
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('name@example.lk'), 'customer@test.invalid');
  await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Sign In', exact: true }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Invalid email or password.', 'error'));
  expect(screen.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
});

test('password visibility can be changed without submitting credentials', async () => {
  page();
  const user = userEvent.setup();
  const password = screen.getByPlaceholderText('••••••••');
  expect(password).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(password).toHaveAttribute('type', 'password');
  expect(login).not.toHaveBeenCalled();
});
