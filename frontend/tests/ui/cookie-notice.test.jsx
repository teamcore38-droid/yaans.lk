import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import CookieNotice from '../../src/components/CookieNotice.jsx';

function showNotice() {
  vi.useFakeTimers();
  render(<MemoryRouter><CookieNotice /></MemoryRouter>);
  act(() => vi.advanceTimersByTime(1200));
}

test('accepting the notice persists consent and hides it', () => {
  showNotice();
  expect(screen.getByRole('complementary', { name: 'Cookie & Storage Notice' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Got it, Continue' }));
  expect(JSON.parse(localStorage.getItem('yaans_cookie_consent')).status).toBe('accepted');
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

test('saved consent suppresses the notice until the user reopens it', () => {
  localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' }));
  showNotice();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new Event('yaans:reset-cookie-consent')));
  expect(screen.getByRole('complementary')).toBeVisible();
});

test('dismissing the notice records that preference', () => {
  showNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Close notice' }));
  expect(JSON.parse(localStorage.getItem('yaans_cookie_consent')).status).toBe('dismissed');
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
