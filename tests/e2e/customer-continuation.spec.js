import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { accounts, TEST_PASSWORD } from '../support/fixtures.js';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' })));
});

async function passwordLogin(page) {
  await page.getByPlaceholder('name@example.lk').fill(accounts.customer);
  await page.getByPlaceholder('••••••••', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

test('header sign-in returns a customer to the product or filtered results they were viewing', async ({ page, context }) => {
  for (const path of ['/product/test-ceylon-spice', '/products?q=Test%20Ceylon']) {
    await context.clearCookies();
    await page.goto(path);
    await page.locator('a[href^="/login?redirect="]').first().click();
    await passwordLogin(page);
    await expect(page).toHaveURL('http://127.0.0.1:4173' + path);
  }
});

test('guest checkout can sign in via the header and keeps delivery details, cart and district', async ({ page }) => {
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Buy Now (Cash on Delivery)', exact: true }).click();
  await page.getByPlaceholder('e.g., Kasun Perera').fill('Draft Buyer');
  await page.getByPlaceholder('e.g., 077 412 3987').fill('0771234567');
  await page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya').fill('8 Draft Lane');
  await page.getByPlaceholder('e.g., Colombo 05 / Maharagama / Katugastota').fill('Kandy');
  await page.locator('main select').selectOption('Kandy');
  const cart = await page.evaluate(() => localStorage.getItem('yaans_cart'));
  await page.locator('a[href^="/login?redirect="]').first().click();
  await passwordLogin(page);
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByPlaceholder('e.g., Kasun Perera')).toHaveValue('Draft Buyer');
  await expect(page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('8 Draft Lane');
  await expect(page.locator('main select')).toHaveValue('Kandy');
  expect(await page.evaluate(() => localStorage.getItem('yaans_cart'))).toBe(cart);
});

test('email registration from checkout returns to the preserved draft', async ({ page }) => {
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Buy Now (Cash on Delivery)', exact: true }).click();
  await page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya').fill('Registration Draft Lane');
  await page.getByRole('link', { name: 'Sign in to continue checkout' }).click();
  await page.getByRole('link', { name: 'Create Customer Account', exact: true }).click();
  await page.getByPlaceholder('e.g., Dilshan Silva').fill('New Continuation Customer');
  await page.getByPlaceholder('077 123 4567').fill('0771234567');
  await page.getByPlaceholder('dilshan@example.com').fill(`${randomUUID()}@test.invalid`);
  await page.getByPlaceholder('Minimum 15 characters').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create Customer Account', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByPlaceholder('e.g., No. 42/B, Fife Road, Thimbirigasyaya')).toHaveValue('Registration Draft Lane');
});
