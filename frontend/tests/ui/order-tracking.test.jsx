import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import TrackOrderPage from '../../src/pages/TrackOrderPage.jsx';
import { useMarketplace } from '../../src/context/MarketplaceContext.jsx';
import * as api from '../../src/utils/api.js';

vi.mock('../../src/context/MarketplaceContext.jsx', async (original) => ({ ...await original(), useMarketplace: vi.fn() }));
beforeEach(() => { sessionStorage.clear(); useMarketplace.mockReturnValue({ user: null, showToast: vi.fn() }); });

test('opening a guest order number alone does not fetch private order details', () => {
  const request = vi.spyOn(api, 'apiRequest');
  render(<MemoryRouter initialEntries={['/track-order?orderNumber=YLK-TEST-1']}><TrackOrderPage /></MemoryRouter>);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Guest tracking access code')).toBeVisible();
  expect(screen.queryByText(/Recipient Phone/)).not.toBeInTheDocument();
});

test('a guest code travels in a request header and is kept out of the API URL', async () => {
  const request = vi.spyOn(api, 'apiRequest').mockRejectedValue(new Error('Test denied'));
  render(<MemoryRouter initialEntries={['/track-order?orderNumber=YLK-TEST-2']}><TrackOrderPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Guest tracking access code'), { target: { value: 'a'.repeat(43) } });
  fireEvent.click(screen.getByRole('button', { name: 'Track Order', exact: true }));
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(request.mock.calls[0][0]).toBe('/orders/track?orderNumber=YLK-TEST-2');
  expect(request.mock.calls[0][1].headers['X-Order-Access-Token']).toBe('a'.repeat(43));
  expect(screen.getByText('Test denied')).toBeVisible();
});
