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

const mockProduct = {
  _id: 'prd_spice_1',
  title: 'Ceylon Roasted Curry Powder',
  sku: 'CP-01',
  categorySlug: 'homemade-pantry',
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
    categories: [{ slug: 'homemade-pantry', name: 'Homemade Pantry' }]
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
        categories: [{ slug: 'homemade-pantry', name: 'Homemade Pantry' }]
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
