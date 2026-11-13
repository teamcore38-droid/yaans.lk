import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { TEST_PASSWORD } from '../support/fixtures.js';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' })));
});

async function googleProvider(context, request, id) {
  const { controlSecret } = JSON.parse(await fs.readFile(new URL('../../test-results/api-state.json', import.meta.url), 'utf8'));
  await context.route('https://accounts.google.com/**', async route => {
    const url = new URL(route.request().url());
    const state = url.searchParams.get('state'); const code = `browser-google:${id}:${state}`;
    const registered = await request.post('http://127.0.0.1:5179/__test/google-code', { headers: { 'x-yaans-test-control': controlSecret },
      data: { code, nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge') } });
    expect(registered.status()).toBe(204);
    await route.fulfill({ status: 302, headers: { location: `${url.searchParams.get('redirect_uri')}?state=${state}&code=${encodeURIComponent(code)}` }, body: '' });
  });
}

test('Google customer onboarding preserves the cart, restores a secure session, and supports verified password creation', async ({ page, context, request }, testInfo) => {
  const id = randomUUID(); await googleProvider(context, request, id);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  const cart = await page.evaluate(() => localStorage.getItem('yaans_cart'));
  await page.goto('/login?redirect=/checkout');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Complete your customer profile' })).toBeVisible();
  await expect(page.getByLabel('Sri Lankan mobile number', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Your district', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox').check();
  await page.screenshot({ path: testInfo.outputPath('google-profile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create customer account', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByPlaceholder('e.g., 077 412 3987')).toHaveValue('');
  await expect(page.getByPlaceholder('e.g., 077 412 3987')).toHaveAttribute('required', '');
  expect(await page.evaluate(() => localStorage.getItem('yaans_cart'))).toBe(cart);
  expect((await context.cookies()).find(cookie => cookie.name === 'yaans_session').httpOnly).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('yaans_token'))).toBeNull();
  await page.getByPlaceholder('e.g., 077 412 3987').fill('0771234567');
  await page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya').fill('42 Test Street');
  await page.getByPlaceholder('e.g., Colombo 05 / Maharagama / Katugastota').fill('Galle');
  await page.locator('main select').selectOption('Galle');
  const placed = page.waitForResponse(response => response.url().endsWith('/api/orders/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Confirm COD Order/ }).click();
  const orderResponse = await placed;
  expect(orderResponse.status()).toBe(201);
  const { order } = await orderResponse.json();
  expect(order.shippingAddress.phone).toBe('0771234567');
  expect(order.shippingAddress.district).toBe('Galle');
  await expect(page.getByRole('heading', { name: new RegExp(order.orderNumber) })).toBeVisible();
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: /Browser Google Customer/ })).toBeVisible();
  await page.getByRole('button', { name: 'Verify with Google to create a password' }).click();
  await expect(page.getByRole('heading', { name: 'Create a Yaans password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Confirm new password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create password', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Browser Google Customer/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Google linking requires the existing password and returning login keeps the original account', async ({ page, context, request }) => {
  const id = randomUUID(), email = `${id}@google-browser.test.invalid`;
  const created = await request.post('/api/auth/register-customer', { data: { name: 'Existing Google Browser Customer', email, phone: '0771234567', password: TEST_PASSWORD } });
  expect(created.status()).toBe(201); const original = (await created.json()).user;
  await googleProvider(context, request, id);
  await page.goto('/login'); await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Securely link your existing account' })).toBeVisible();
  await page.getByLabel('Current Yaans password').fill('incorrect-password');
  await page.getByRole('button', { name: 'Link Google and sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Your current Yaans password is required');
  await page.getByLabel('Current Yaans password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Link Google and sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect((await (await page.request.get('/api/auth/me')).json()).user._id).toBe(original._id);
  await context.clearCookies();
  await page.goto('/login'); await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: /Existing Google Browser Customer/ })).toBeVisible();
});

test('Google sign-in resumes an unfinished guest checkout without submitting an order', async ({ page, context, request }) => {
  await googleProvider(context, request, randomUUID());
  let checkoutRequests = 0;
  page.on('request', req => { if (req.url().endsWith('/api/orders/checkout') && req.method() === 'POST') checkoutRequests++; });
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Buy Now (Cash on Delivery)', exact: true }).click();
  await page.getByPlaceholder('e.g., Kasun Perera').fill('Draft Recipient');
  await page.getByPlaceholder('e.g., 077 412 3987').fill('0771234567');
  await page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya').fill('42 Draft Street');
  await page.getByPlaceholder('e.g., Colombo 05 / Maharagama / Katugastota').fill('Galle');
  await page.locator('main select').selectOption('Galle');
  await page.getByRole('link', { name: 'Sign in to continue checkout' }).click();
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Use email and password instead' })).toHaveAttribute('href', '/login?redirect=%2Fcheckout');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create customer account', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByPlaceholder('e.g., Kasun Perera')).toHaveValue('Draft Recipient');
  await expect(page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('42 Draft Street');
  await expect(page.locator('main select')).toHaveValue('Galle');
  expect(checkoutRequests).toBe(0);
  await page.getByRole('button', { name: /Confirm COD Order/ }).click();
  await expect(page.getByRole('heading', { name: /Your Order.*Confirmed/ })).toBeVisible();
  expect(checkoutRequests).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('yaans_checkout_draft_v1'))).toBeNull();
});
