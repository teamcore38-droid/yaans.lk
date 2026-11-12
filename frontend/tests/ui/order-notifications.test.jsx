import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, vi, afterEach } from 'vitest';
import OrderNotifications from '../../src/components/OrderNotifications.jsx';
import { apiRequest } from '../../src/utils/api.js';
vi.mock('../../src/utils/api.js', async original => ({ ...await original(), apiRequest: vi.fn() }));
afterEach(() => vi.clearAllMocks());
test('shows unread badge, scoped item details and marks read on explicit action', async () => {
  apiRequest.mockResolvedValueOnce({ unreadCount: 1, notifications: [{ _id: 'notification:one', orderNumber: 'YLK-1', totalLkr: 100, items: [{ title: 'Spice', quantity: 2 }] }] }).mockResolvedValue({});
  const onViewOrders = vi.fn(); const user = userEvent.setup();
  render(<OrderNotifications onViewOrders={onViewOrders} />);
  expect(await screen.findByLabelText('1 unread notifications')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('New order received');
  expect(screen.getByRole('button', { name: 'Sound: off' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: /Notifications/ }));
  expect(screen.getByText('Spice × 2')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View orders and mark as read' }));
  await waitFor(() => expect(onViewOrders).toHaveBeenCalledOnce());
  expect(apiRequest).toHaveBeenCalledWith('/notifications/notification%3Aone/read', { method: 'POST' });
  expect(screen.getByLabelText('0 unread notifications')).toBeInTheDocument();
});
test('notification outages remain visible without crashing the dashboard', async () => {
  apiRequest.mockRejectedValue(new Error('offline'));
  render(<OrderNotifications onViewOrders={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Retrying automatically');
});

test('polls only while visible and stops after unmount', async () => {
  vi.useFakeTimers();
  apiRequest.mockResolvedValue({ unreadCount: 0, notifications: [] });
  const { unmount } = render(<OrderNotifications onViewOrders={() => {}} />);
  await act(async () => {});
  expect(apiRequest).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(apiRequest).toHaveBeenCalledTimes(2);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(apiRequest).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(apiRequest).toHaveBeenCalledTimes(2);
});

test('sound requires opt-in and plays only for newly received notifications', async () => {
  const start = vi.fn();
  const context = { resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(), currentTime: 0, destination: {},
    createOscillator: () => ({ connect: vi.fn(), disconnect: vi.fn(), frequency: {}, start, stop: vi.fn() }),
    createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }) };
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  apiRequest.mockResolvedValueOnce({ unreadCount: 0, notifications: [] });
  render(<OrderNotifications onViewOrders={() => {}} />);
  await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce());
  expect(start).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sound: off' }));
  expect(screen.getByRole('button', { name: 'Sound: on' })).toHaveAttribute('aria-pressed', 'true');
  apiRequest.mockResolvedValue({ unreadCount: 1, notifications: [{ _id: 'new', items: [] }] });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => expect(start).toHaveBeenCalledOnce());
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(start).toHaveBeenCalledOnce();
});
