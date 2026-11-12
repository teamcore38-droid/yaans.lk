import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import SellerDashboardPage from '../../src/pages/SellerDashboardPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import * as api from '../../src/utils/api.js';

vi.mock('../../src/context/MarketplaceContext.jsx', async (importOriginal) => ({
  ...await importOriginal(),
  useMarketplace: vi.fn()
}));

const mockSeller = {
  _id: 'sel_test_pantry',
  storeName: 'Test Pantry',
  isHomemadeVendor: true,
  sellerType: 'Small Business',
  district: 'Kandy',
  city: 'Kandy',
  description: 'Authentic Sri Lankan spices',
  contactPhone: '0771234567',
  shippingPolicy: { freeShippingThresholdLkr: 5000, flatRateIntraLkr: 280 },
  bankDetails: { bankName: 'Sampath Bank', branchName: 'Kandy', accountHolderName: 'Test Seller', accountNumber: '12345678' }
};

const mockCategories = [
  {
    slug: 'homemade-pantry',
    name: 'Homemade Pantry',
    subCategories: [
      { slug: 'curry-powders', name: 'Curry Powders' },
      { slug: 'chilli-pastes', name: 'Chilli Pastes' }
    ]
  },
  {
    slug: 'organic-produce',
    name: 'Organic Produce',
    subCategories: [
      { slug: 'fresh-fruits', name: 'Fresh Fruits' }
    ]
  }
];

const mockProduct = {
  _id: 'prd_spice_1',
  title: 'Ceylon Roasted Curry Powder',
  sku: 'CP-01',
  categorySlug: 'homemade-pantry',
  subCategorySlug: 'curry-powders',
  description: 'Handcrafted roasted curry powder from Kandy.',
  highlights: ['100% Sri Lankan Spices', 'No preservatives', 'Freshly ground'],
  priceLkr: 850,
  compareAtPriceLkr: 1000,
  stock: 30,
  images: ['/brand/yaans-mark-dark.png'],
  isHomemade: true,
  approvalStatus: 'approved'
};

let showToast;

beforeEach(() => {
  showToast = vi.fn();
  useMarketplace.mockReturnValue({
    user: { _id: 'usr_seller_1', role: 'seller', sellerId: 'sel_test_pantry', name: 'Test Seller' },
    showToast,
    categories: mockCategories
  });
});

test('seller product manual form renders Key Highlights field and submits it in payload', async () => {
  const requestSpy = vi.spyOn(api, 'apiRequest').mockImplementation(async (endpoint, options = {}) => {
    if (endpoint === '/seller/dashboard') {
      return {
        seller: mockSeller,
        products: [],
        subOrders: [],
        settlements: [],
        categories: mockCategories
      };
    }
    if (endpoint === '/seller/products' && options.method === 'POST') {
      return { product: { _id: 'prd_new_1', ...JSON.parse(options.body) } };
    }
    return {};
  });

  render(
    <MemoryRouter>
      <SellerDashboardPage />
    </MemoryRouter>
  );

  const user = userEvent.setup();

  // Navigate to Products tab
  const productsTab = await screen.findByRole('button', { name: /Products & Cloudinary Upload/i });
  await user.click(productsTab);

  // Verify Key Highlights field exists
  const highlightsInput = await screen.findByLabelText(/Key Highlights/i);
  expect(highlightsInput).toBeInTheDocument();
  expect(highlightsInput).toHaveAttribute('placeholder', expect.stringContaining('100% Sri Lankan Spices'));

  // Fill in required product fields using fireEvent for fast and reliable updates
  fireEvent.change(screen.getByLabelText(/Product Title \*/i), { target: { value: 'Fresh Kandy Cinnamon Sticks' } });
  fireEvent.change(screen.getByLabelText(/Price \(Rs\.\) \*/i), { target: { value: '1200' } });
  fireEvent.change(highlightsInput, { target: { value: 'Organic certified\nStone crushed\n100g pack' } });
  fireEvent.change(screen.getByLabelText(/Description \*/i), { target: { value: 'Pure Ceylon organic cinnamon sticks sourced directly from Kandy growers.' } });

  // Submit product form
  const submitButton = screen.getByRole('button', { name: /Publish Product Listing/i });
  fireEvent.submit(submitButton.closest('form'));

  await waitFor(() => {
    expect(requestSpy).toHaveBeenCalledWith('/seller/products', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"highlights":"Organic certified\\nStone crushed\\n100g pack"')
    }));
  });
  expect(showToast).toHaveBeenCalledWith('New product added to store!');
});

test('editing an existing product populates Key Highlights in textarea and updates successfully', async () => {
  const requestSpy = vi.spyOn(api, 'apiRequest').mockImplementation(async (endpoint, options = {}) => {
    if (endpoint === '/seller/dashboard') {
      return {
        seller: mockSeller,
        products: [mockProduct],
        subOrders: [],
        settlements: [],
        categories: [{ slug: 'homemade-pantry', name: 'Homemade Pantry' }]
      };
    }
    if (endpoint === `/seller/products/${mockProduct._id}` && options.method === 'PUT') {
      return { product: { ...mockProduct, ...JSON.parse(options.body) } };
    }
    return {};
  });

  render(
    <MemoryRouter>
      <SellerDashboardPage />
    </MemoryRouter>
  );

  const user = userEvent.setup();

  // Navigate to Products tab
  const productsTab = await screen.findByRole('button', { name: /Products & Cloudinary Upload/i });
  await user.click(productsTab);

  // Click Edit on the existing product in the catalog table
  const editButton = await screen.findByRole('button', { name: /^Edit$/i });
  await user.click(editButton);

  // Verify form is in edit mode and highlights are populated with newlines
  expect(await screen.findByText('Edit Product Listing')).toBeInTheDocument();
  const highlightsInput = screen.getByLabelText(/Key Highlights/i);
  expect(highlightsInput).toHaveValue('100% Sri Lankan Spices\nNo preservatives\nFreshly ground');

  // Modify highlights using fireEvent
  fireEvent.change(highlightsInput, { target: { value: 'Single updated highlight line' } });

  // Submit product changes
  const saveButton = screen.getByRole('button', { name: /Save Product Changes/i });
  fireEvent.submit(saveButton.closest('form'));

  await waitFor(() => {
    expect(requestSpy).toHaveBeenCalledWith(
      `/seller/products/${mockProduct._id}`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"highlights":"Single updated highlight line"')
      })
    );
  });
  expect(showToast).toHaveBeenCalledWith('Product updated!');
});

test('seller product form allows selecting a subcategory and submits subCategorySlug in POST and PUT payloads', async () => {
  const requestSpy = vi.spyOn(api, 'apiRequest').mockImplementation(async (endpoint, options = {}) => {
    if (endpoint === '/seller/dashboard') {
      return {
        seller: mockSeller,
        products: [mockProduct],
        subOrders: [],
        settlements: [],
        categories: mockCategories
      };
    }
    if (endpoint === '/seller/products' && options.method === 'POST') {
      return { product: { _id: 'prd_sub_new', ...JSON.parse(options.body) } };
    }
    if (endpoint === `/seller/products/${mockProduct._id}` && options.method === 'PUT') {
      return { product: { ...mockProduct, ...JSON.parse(options.body) } };
    }
    return {};
  });

  render(
    <MemoryRouter>
      <SellerDashboardPage />
    </MemoryRouter>
  );

  const user = userEvent.setup();
  const productsTab = await screen.findByRole('button', { name: /Products & Cloudinary Upload/i });
  await user.click(productsTab);

  // 1. Check Subcategory select options in Add Product form
  const subCategorySelect = screen.getByLabelText(/Subcategory \/ Tile/i);
  expect(subCategorySelect).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Curry Powders' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Chilli Pastes' })).toBeInTheDocument();

  // Select Curry Powders
  fireEvent.change(subCategorySelect, { target: { value: 'curry-powders' } });
  fireEvent.change(screen.getByLabelText(/Product Title \*/i), { target: { value: 'Roasted Curry Powder 250g' } });
  fireEvent.change(screen.getByLabelText(/Price \(Rs\.\) \*/i), { target: { value: '950' } });
  fireEvent.change(screen.getByLabelText(/Description \*/i), { target: { value: 'Traditional blend of organic spices.' } });

  const submitButton = screen.getByRole('button', { name: /Publish Product Listing/i });
  fireEvent.submit(submitButton.closest('form'));

  await waitFor(() => {
    expect(requestSpy).toHaveBeenCalledWith('/seller/products', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"subCategorySlug":"curry-powders"')
    }));
  });

  // 2. Click Edit on existing product and verify populated subCategorySlug
  const editButton = await screen.findByRole('button', { name: /^Edit$/i });
  await user.click(editButton);

  expect(await screen.findByText('Edit Product Listing')).toBeInTheDocument();
  expect(subCategorySelect).toHaveValue('curry-powders');

  // Change subcategory to Chilli Pastes
  fireEvent.change(subCategorySelect, { target: { value: 'chilli-pastes' } });

  const saveButton = screen.getByRole('button', { name: /Save Product Changes/i });
  fireEvent.submit(saveButton.closest('form'));

  await waitFor(() => {
    expect(requestSpy).toHaveBeenCalledWith(
      `/seller/products/${mockProduct._id}`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"subCategorySlug":"chilli-pastes"')
      })
    );
  });

  // 3. Verify category change resets invalid subCategorySlug
  fireEvent.change(subCategorySelect, { target: { value: 'chilli-pastes' } });
  const departmentSelect = screen.getByLabelText(/Department \*/i);
  fireEvent.change(departmentSelect, { target: { value: 'organic-produce' } });
  expect(subCategorySelect).toHaveValue('');
});
