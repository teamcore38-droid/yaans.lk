import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import CoAdminConsole from '../../src/pages/admin/CoAdminConsole.jsx';
import CoAdminManagement from '../../src/pages/admin/CoAdminManagement.jsx';
import AdminDashboardPage from '../../src/pages/AdminDashboardPage.jsx';
import { apiRequest } from '../../src/utils/api.js';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';

vi.mock('../../src/utils/api.js', async original => ({ ...await original(), apiRequest: vi.fn() }));
vi.mock('../../src/context/MarketplaceContext.jsx', async original => ({ ...await original(), useMarketplace: vi.fn() }));
const account = { role: 'admin', adminAccess: 'coadmin', adminPermissions: ['products'], mfaEnabled: true, name: 'Operations User', email: 'operations@test.invalid', id: 'ops' };
const props = () => ({ user: account, refreshUser: vi.fn(), showToast: vi.fn(), logout: vi.fn() });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

test('operations navigation shows assigned modules and product saves omit ungranted price and stock fields', async () => {
  const product = { _id: 'product', title: 'Example product', description: 'Original description', images: [], priceLkr: 100, stock: 20, revision: 'synthetic-revision' };
  apiRequest.mockImplementation(async (_path, options) => options?.method === 'PUT' ? { message: 'Saved' } : { rows: [product], nextCursor: null });
  render(<MemoryRouter><CoAdminConsole {...props()}/></MemoryRouter>);
  const nav = screen.getByRole('navigation', { name: 'Operations modules' });
  expect(within(nav).queryByText('Seller application review')).not.toBeInTheDocument();
  expect(screen.queryByText('Co-admin Access')).not.toBeInTheDocument();
  const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Edit product content' }));
  expect(screen.queryByLabelText('Price (LKR)')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Stock')).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText('Product title')); await user.type(screen.getByLabelText('Product title'), 'Reviewed title'); await user.click(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/admin/products/product', expect.objectContaining({ method: 'PUT' })));
  const payload = JSON.parse(apiRequest.mock.calls.find(([, opts]) => opts?.method === 'PUT')[1].body);
  expect(payload).toEqual({ title: 'Reviewed title', description: 'Original description', images: [], revision: 'synthetic-revision' });
  expect(apiRequest.mock.calls.some(([path]) => path.includes('/overview'))).toBe(false);
});

test('owner creates an individual co-admin with fresh verification and clears sensitive confirmation inputs', async () => {
  apiRequest.mockImplementation(async (_path, options) => options?.method === 'POST' ? { message: 'Created securely' } : { coadmins: [], nextCursor: null });
  render(<CoAdminManagement/>); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create co-admin' }));
  await user.type(screen.getByLabelText('name'), 'Operations User'); await user.type(screen.getByLabelText('email'), 'operations@test.invalid'); await user.type(screen.getByLabelText('phone'), '0771234567');
  await user.type(screen.getByLabelText('Temporary co-admin password'), 'Unique-temporary-passphrase!123');
  expect(screen.getByLabelText('Product price overrides')).not.toBeChecked(); expect(screen.getByLabelText('Product stock overrides')).not.toBeChecked();
  await user.type(screen.getByLabelText('Your owner password'), 'Owner-personal-passphrase!123'); await user.type(screen.getByLabelText('Your authenticator or unused recovery code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Confirm co-admin change' })); await screen.findByText('Created securely');
  expect(screen.queryByLabelText('Your owner password')).not.toBeInTheDocument();
  const body = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body);
  expect(body.permissions).toEqual(['orders', 'products', 'sellers', 'merchandising', 'audit']); expect(body.code).toBe('123456');
});

test('setup-only dashboard never requests owner operational data', async () => {
  useMarketplace.mockReturnValue({ user: { ...account, mfaEnabled: false, adminMustChangePassword: true }, logout: vi.fn(), refreshUser: vi.fn(), showToast: vi.fn(), categories: [] });
  render(<MemoryRouter><AdminDashboardPage/></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Complete administrator security setup' });
  await screen.findByRole('heading', { name: 'Administrator authenticator' });
  expect(apiRequest).not.toHaveBeenCalled(); expect(screen.queryByText('Active Super Admin')).not.toBeInTheDocument();
});

test('out-of-order module responses do not replace the newly selected module', async () => {
  let resolveProducts;
  apiRequest.mockImplementation(path => path.includes('module=products') ? new Promise(resolve => { resolveProducts = resolve; }) : Promise.resolve({ rows: [{ _id: 'seller', storeName: 'Current storefront' }], nextCursor: null }));
  render(<MemoryRouter><CoAdminConsole {...props()} user={{ ...account, adminPermissions: ['products', 'sellers'] }}/></MemoryRouter>);
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Seller application review' })); await screen.findByText('Current storefront');
  resolveProducts({ rows: [{ _id: 'stale', title: 'Stale product' }] });
  await waitFor(() => expect(screen.queryByText('Stale product')).not.toBeInTheDocument()); expect(screen.getByText('Current storefront')).toBeInTheDocument();
});
