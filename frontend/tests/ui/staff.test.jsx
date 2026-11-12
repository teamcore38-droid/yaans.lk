import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import StaffDashboardPage from '../../src/pages/StaffDashboardPage.jsx';
import StaffLoginPage from '../../src/pages/StaffLoginPage.jsx';
import StaffManagementTab from '../../src/pages/admin/StaffManagementTab.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import { apiRequest } from '../../src/utils/api.js';
vi.mock('../../src/context/MarketplaceContext.jsx', async original => ({ ...await original(), useMarketplace: vi.fn() }));
vi.mock('../../src/utils/api.js', async original => ({ ...await original(), apiRequest: vi.fn() }));
const staff = { _id: 'staff_one', name: 'Order Operator', role: 'staff', email: 'operator@test.invalid' };
const order = { _id: 'order_one', orderNumber: 'YLK-TEST', createdAt: '2026-01-01', overallStatus: 'processing', grandTotalLkr: 100, sellerCount: 1 };
function dashboard(user = staff) {
  const clearSession = vi.fn(), refreshUser = vi.fn().mockResolvedValue(user);
  useMarketplace.mockReturnValue({ user, clearSession, refreshUser });
  return { ...render(<MemoryRouter initialEntries={['/staff']}><Routes><Route path="/staff" element={<StaffDashboardPage />} /><Route path="/staff/login" element={<p>Sign in again</p>} /></Routes></MemoryRouter>), clearSession, refreshUser };
}
afterEach(() => vi.clearAllMocks());
test('staff login uses its dedicated authentication and opens the staff dashboard', async () => {
  const staffLogin = vi.fn().mockResolvedValue(staff); useMarketplace.mockReturnValue({ staffLogin });
  render(<MemoryRouter><Routes><Route path="/" element={<StaffLoginPage />} /><Route path="/staff" element={<p>Order workspace</p>} /></Routes></MemoryRouter>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Staff email'), staff.email); await user.type(screen.getByLabelText('Password'), 'Staff-passphrase!123');
  await user.click(screen.getByRole('button', { name: 'Sign in to Staff Dashboard' }));
  expect(await screen.findByText('Order workspace')).toBeInTheDocument();
  expect(staffLogin).toHaveBeenCalledWith(staff.email, 'Staff-passphrase!123');
});
test('staff with temporary passwords cannot mount the order monitor', async () => {
  dashboard({ ...staff, staffMustChangePassword: true });
  expect(screen.getByRole('form', { name: 'Change staff password' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Order notifications' })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Temporary password'), 'Temporary-password!123');
  await user.type(screen.getByLabelText('New password'), 'Personal-passphrase!123');
  await user.type(screen.getByLabelText('Confirm new password'), 'Other-passphrase!123');
  await user.click(screen.getByRole('button', { name: 'Save staff password' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
  expect(apiRequest).not.toHaveBeenCalled();
});
test('orders are paginated and private delivery details load only when explicitly opened', async () => {
  apiRequest.mockImplementation(async endpoint => {
    if (endpoint === '/notifications') return { unreadCount: 0, notifications: [] };
    if (endpoint.includes('/staff/orders/order_one')) return { order: { ...order, shippingAddress: { recipientName: 'Private Recipient', phone: '0771234567', addressLine1: 'Private street' }, packages: [] } };
    return { orders: [order], nextCursor: 'order_one' };
  });
  dashboard(); const user = userEvent.setup();
  expect(await screen.findByText('YLK-TEST')).toBeInTheDocument();
  expect(screen.queryByText(/Private Recipient/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View delivery details for YLK-TEST' }));
  expect(await screen.findByRole('region', { name: 'Order delivery details' })).toHaveTextContent('Private Recipient');
  await user.click(screen.getByRole('button', { name: 'Older orders' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/staff/orders?before=order_one'));
  expect(screen.queryByRole('region', { name: 'Order delivery details' })).not.toBeInTheDocument();
});
test('expired access clears the staff workspace instead of showing cached order data', async () => {
  apiRequest.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }));
  const { clearSession } = dashboard();
  expect(await screen.findByText('Sign in again')).toBeInTheDocument();
  expect(clearSession).toHaveBeenCalled();
  expect(screen.queryByText('Staff Dashboard')).not.toBeInTheDocument();
});
test('idle timeout locks the monitor and automatic polling does not submit human activity', async () => {
  vi.useFakeTimers();
  apiRequest.mockImplementation(async endpoint => endpoint === '/notifications' ? { notifications: [], unreadCount: 0 } : { orders: [], nextCursor: null });
  const { clearSession } = dashboard();
  await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60000); });
  expect(clearSession).toHaveBeenCalledOnce();
  expect(apiRequest.mock.calls.some(([endpoint]) => endpoint === '/auth/staff/activity')).toBe(false);
});
test('admin creation sends a temporary password and reauthentication, then clears password fields', async () => {
  apiRequest.mockImplementation(async (endpoint, options) => options?.method === 'POST' ? { message: 'Staff account created.' } : { staff: [], nextCursor: null });
  render(<MemoryRouter><StaffManagementTab /></MemoryRouter>);
  const user = userEvent.setup(); const form = screen.getByRole('form', { name: 'Create staff account' });
  for (const [label, value] of [['Staff name','Operator'],['Staff email','operator@test.invalid'],['Staff phone','0771234567'],['Temporary staff password','Temporary-password!123'],['Your administrator password','Admin-passphrase!123']]) await user.type(within(form).getByLabelText(label), value);
  await user.click(within(form).getByRole('button', { name: 'Create staff account' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Staff account created');
  const [, options] = apiRequest.mock.calls.find(([endpoint, options]) => endpoint === '/admin/staff' && options?.method === 'POST');
  expect(JSON.parse(options.body)).toMatchObject({ name: 'Operator', password: 'Temporary-password!123', currentPassword: 'Admin-passphrase!123' });
  expect(within(form).getByLabelText('Temporary staff password')).toHaveValue('');
  expect(within(form).getByLabelText('Your administrator password')).toHaveValue('');
}, 15000);
test('disabling a staff account requires explicit password confirmation before the request', async () => {
  apiRequest.mockResolvedValue({ staff: [{ ...staff, isActive: true }], nextCursor: null });
  render(<MemoryRouter><StaffManagementTab /></MemoryRouter>); const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Disable access' }));
  expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  const form = screen.getByRole('form', { name: 'Confirm staff access change' });
  await user.type(within(form).getByLabelText('Confirm with your administrator password'), 'Admin-passphrase!123');
  await user.click(within(form).getByRole('button', { name: 'Confirm staff change' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/staff/staff_one', expect.objectContaining({ method: 'PATCH' })));
});
