import { test, expect } from '@playwright/test';
import { accounts, TEST_PASSWORD, shippingAddress } from '../support/fixtures.js';

let browserErrors;
test.beforeEach(async ({ context, page }) => {
  browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' }));
  });
  // Keep fixtures deterministic and prevent accidental calls to external/production APIs.
  await context.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort();
  });
});
test.afterEach(() => expect(browserErrors).toEqual([]));

async function login(page, email, admin = false) {
  await page.goto(admin ? '/admin/login' : '/login');
  await page.getByPlaceholder(admin ? 'admin@yaans.lk' : 'name@example.lk').fill(email);
  await page.getByPlaceholder(admin ? '••••••••••••' : '••••••••', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: admin ? 'Sign In to Admin Console' : 'Sign In', exact: true }).click();
}

async function fillAddress(page) {
  await page.getByPlaceholder('e.g., Kasun Perera').fill(shippingAddress.recipientName);
  await page.getByPlaceholder('e.g., 077 412 3987').fill(shippingAddress.phone);
  await page.getByPlaceholder('e.g., kasun@gmail.com').fill('guest@test.yaans.invalid');
  await page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya').fill(shippingAddress.addressLine1);
  await page.getByPlaceholder('e.g., Colombo 05 / Maharagama / Katugastota').fill(shippingAddress.city);
}

test('search leads to a product and seller storefront without exposing pending listings', async ({ page }) => {
  await page.goto('/products?q=Test%20Ceylon%20Spice');
  await page.getByRole('link', { name: 'Test Ceylon Spice', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Test Ceylon Spice', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Test Kandy Pantry', exact: true }).last().click();
  await expect(page).toHaveURL(/\/store\/test-kandy-pantry/);
  await expect(page.getByRole('heading', { name: 'Test Kandy Pantry', exact: true })).toBeVisible();
  await page.goto('/products?q=Pending');
  await expect(page.getByText('No products match your current filter selection')).toBeVisible();
});

test('guest multi-seller checkout creates a confirmed order that can be tracked', async ({ page }) => {
  for (const slug of ['test-ceylon-spice', 'test-desk-lamp']) {
    await page.goto(`/product/${slug}`);
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  }
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Multi-Seller Shopping Cart' })).toBeVisible();
  await expect(page.getByText('Shipment 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Proceed to Checkout/ }).click();
  await fillAddress(page);
  const created = page.waitForResponse((response) => response.url().endsWith('/api/orders/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Confirm COD Order/ }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { order, subOrders } = await response.json();
  expect(subOrders).toHaveLength(2);
  expect(order.grandTotalLkr).toBe(4200);
  await expect(page.getByRole('heading', { name: new RegExp(order.orderNumber) })).toBeVisible();
  const savedCart = await page.evaluate(() => JSON.parse(localStorage.getItem('yaans_cart')));
  expect(savedCart).toEqual([]);
  await page.getByRole('link', { name: `Track Order #${order.orderNumber}` }).click();
  await expect(page.getByRole('heading', { name: 'Track Your Yaans.lk Multi-Seller Order' })).toBeVisible();
  for (const subOrder of subOrders) {
    await expect(page.getByText(new RegExp(`^Package [12]: ${subOrder.subOrderNumber}$`))).toBeVisible();
  }
});

test('checkout failure preserves the cart and a retry can succeed', async ({ page }) => {
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Buy Now (Cash on Delivery)', exact: true }).click();
  await fillAddress(page);
  let failNext = true;
  await page.route('**/api/orders/checkout', (route) => {
    if (failNext) {
      failNext = false;
      return route.fulfill({ status: 503, json: { message: 'Test temporary failure. Please retry.' } });
    }
    return route.continue();
  });
  const button = page.getByRole('button', { name: /Confirm COD Order/ });
  await button.click();
  await expect(page.getByText('Test temporary failure. Please retry.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yaans_cart')).length)).toBe(1);
  await button.click();
  await expect(page.getByRole('heading', { name: /Thank you! Your Order/ })).toBeVisible();
});

test('customer sign-in restores the session and does not grant admin access', async ({ page }) => {
  await login(page, accounts.customer);
  await expect(page).toHaveURL(/\/account$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Test Customer/ })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access Denied', exact: true })).toBeVisible();
});

test('invalid credentials show an error and leave sign-in available', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('name@example.lk').fill(accounts.customer);
  await page.getByPlaceholder('••••••••', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
});

test('seller fulfillment and admin payout are reflected in the settlement ledger', async ({ page, request }) => {
  const created = await request.post('/api/orders/checkout', { data: {
    items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }],
    shippingAddress, customerEmail: 'fulfillment@test.yaans.invalid', paymentMethod: 'COD'
  } });
  expect(created.status()).toBe(201);
  const { subOrders: [subOrder] } = await created.json();
  await login(page, accounts.seller);
  await expect(page.getByRole('heading', { name: /Test Kandy Pantry.*Seller Portal/ })).toBeVisible();
  const card = page.getByText(`Sub-Order #${subOrder.subOrderNumber}`, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]');
  for (const label of ['Mark Packed', 'Mark Shipped', 'Delivered & COD Collected']) {
    const updated = page.waitForResponse((response) => response.url().includes(`/seller/suborders/${subOrder._id}/status`) && response.request().method() === 'PUT');
    await card.getByRole('button', { name: label, exact: true }).click();
    expect((await updated).status()).toBe(200);
  }
  await login(page, accounts.admin, true);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Commissions & Seller Settlements' }).click();
  const paid = page.waitForResponse((response) => response.url().endsWith('/admin/settlements/payout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Settle Payout', exact: true }).first().click();
  const payout = await paid;
  expect(payout.status()).toBe(201);
  const { settlement } = await payout.json();
  expect(settlement.sellerId).toBe('sel_test_pantry');
  expect(settlement.netPayoutLkr).toBe(950);
  await expect(page.getByRole('cell', { name: settlement.settlementReference, exact: true })).toBeVisible();
});

test('legal route aliases and direct refreshes render their actual pages', async ({ page }) => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy Policy'], ['/privacy-policy', 'Privacy Policy'],
    ['/terms', 'Terms and Conditions'], ['/terms-and-conditions', 'Terms and Conditions'],
    ['/cookies', /Cookie.*Policy/], ['/cookies-policy', /Cookie.*Policy/]
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Cookie.*Policy/ })).toBeVisible();
});
