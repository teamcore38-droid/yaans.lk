import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
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

test('new customer confirms an emailed link before signing in',async({page,request})=>{
  const email=`verified-${randomUUID()}@test.invalid`;
  await page.goto('/register');
  await page.getByPlaceholder('e.g., Dilshan Silva').fill('Verified Customer');
  await page.getByPlaceholder('077 123 4567').fill('0771234567');
  await page.getByPlaceholder('dilshan@example.com').fill(email);
  await page.getByPlaceholder('Minimum 15 characters').fill(TEST_PASSWORD);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/register-customer')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create Customer Account',exact:true}).click();
  const started=await response;expect(started.status()).toBe(202);expect((await started.json()).token).toBeUndefined();
  await expect(page.getByRole('status')).toContainText('Check your inbox');
  const {controlSecret}=JSON.parse(await fs.readFile(new URL('../../test-results/api-state.json',import.meta.url),'utf8'));
  const inbox=await request.get('http://127.0.0.1:5179/__test/mailbox',{headers:{'x-yaans-test-control':controlSecret}});
  const message=(await inbox.json()).messages.findLast(item=>item.to===email);
  const token=message.text.match(/#token=([\w-]+)/)[1];
  await page.goto('/verify-email#token='+token);
  await expect(page.getByLabel('Your Yaans.lk password')).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(await page.evaluate(()=>localStorage.getItem('yaans_user'))).toBeNull();
  await page.getByLabel('Your Yaans.lk password').fill(TEST_PASSWORD);
  await page.getByRole('button',{name:'Confirm email address'}).click();
  await expect(page.getByRole('status')).toContainText('Email verified and account created');
  await page.getByRole('link',{name:'Continue to sign in'}).click();await login(page,email);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(`${email} — Verified`,{exact:true})).toBeVisible();
});

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

test('a lost success response is recovered without creating another order', async ({ page }) => {
  await page.goto('/product/test-ceylon-spice');
  await page.getByRole('button', { name: 'Buy Now (Cash on Delivery)', exact: true }).click();
  await fillAddress(page);
  let firstOrder;
  let firstKey;
  let dropFirstResponse = true;
  await page.route('**/api/orders/checkout', async (route) => {
    if (!dropFirstResponse) return route.continue();
    dropFirstResponse = false;
    firstKey = route.request().headers()['idempotency-key'];
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    firstOrder = (await response.json()).order;
    await route.abort('failed');
  });
  await page.getByRole('button', { name: /Confirm COD Order/ }).click();
  await expect(page.getByRole('button', { name: /Confirm COD Order/ })).toBeEnabled();
  const repeated = page.waitForResponse((response) => response.url().endsWith('/api/orders/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Confirm COD Order/ }).click();
  const response = await repeated;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.order._id).toBe(firstOrder._id);
  expect(response.request().headers()['idempotency-key']).toBe(firstKey);
  await expect(page.getByRole('heading', { name: new RegExp(firstOrder.orderNumber) })).toBeVisible();
});

test('a guest needs the private code to track and cancel an order', async ({ page, request }) => {
  const created = await request.post('/api/orders/checkout', { headers: { 'Idempotency-Key': randomUUID() },
    data: { items: [{ productId: 'prd_test_lamp', quantity: 1 }], shippingAddress,
      customerEmail: 'tracking@test.yaans.invalid', paymentMethod: 'COD', codConfirmedByCustomer: true } });
  expect(created.status()).toBe(201);
  const { order, guestAccessToken, subOrders } = await created.json();
  expect((await request.get(`/api/orders/track?orderNumber=${order.orderNumber}&phone=${shippingAddress.phone}`)).status()).toBe(403);
  expect((await request.post(`/api/orders/suborders/${subOrders[0]._id}/customer-action`, { data: { action: 'cancel' } })).status()).toBe(403);
  await page.goto(`/track-order?orderNumber=${order.orderNumber}`);
  await expect(page.getByText('Test Customer', { exact: true })).not.toBeVisible();
  await page.getByLabel('Guest tracking access code').fill(guestAccessToken);
  await page.getByRole('button', { name: 'Track Order', exact: true }).click();
  await expect(page.getByText(`Package 1: ${subOrders[0].subOrderNumber}`, { exact: true })).toBeVisible();
  const cancel = page.waitForResponse((response) => response.url().includes('/customer-action'));
  await page.getByRole('button', { name: /Cancel/ }).click();
  expect((await cancel).status()).toBe(200);
  await expect(page.getByText('cancelled', { exact: true }).first()).toBeVisible();
});

test('customer sign-in uses HttpOnly cookies, rejects CSRF and restores the session without admin access', async ({ page, context }) => {
  const authentication=page.waitForResponse(response=>response.url().endsWith('/api/auth/login'));
  await login(page, accounts.customer);
  expect((await (await authentication).json()).token).toBeUndefined();
  await expect(page).toHaveURL(/\/account$/);
  const cookies=await context.cookies();
  expect(cookies.find(cookie=>cookie.name==='yaans_session').httpOnly).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('yaans_token'))).toBeNull();
  expect((await page.request.put('/api/auth/profile',{data:{name:'Rejected CSRF change'}})).status()).toBe(403);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Test Customer/ })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access Denied', exact: true })).toBeVisible();
});

test('the deployed content policy blocks injected inline scripts while the storefront works',async({page})=>{
  const response=await page.goto('/');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['x-frame-options']).toBe('DENY');
  await page.evaluate(()=>{
    const script=document.createElement('script');script.textContent='window.__unsafeInlineExecuted=true';document.head.append(script);
  });
  expect(await page.evaluate(()=>window.__unsafeInlineExecuted)).toBeUndefined();
  await expect(page.getByRole('link',{name:'Browse All Products',exact:true})).toBeVisible();
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
  const created = await request.post('/api/orders/checkout', { headers: { 'Idempotency-Key': randomUUID() }, data: {
    items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }],
    shippingAddress, customerEmail: 'fulfillment@test.yaans.invalid', paymentMethod: 'COD', codConfirmedByCustomer: true
  } });
  expect(created.status()).toBe(201);
  const { subOrders: [subOrder] } = await created.json();
  await login(page, accounts.seller);
  await expect(page.getByRole('heading', { name: /Test Kandy Pantry.*Seller Portal/ })).toBeVisible();
  const card = page.getByText(`Sub-Order #${subOrder.subOrderNumber}`, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]');
  for (const label of ['Mark Packed', 'Mark Shipped', 'Mark Delivered']) {
    const updated = page.waitForResponse((response) => response.url().includes(`/seller/suborders/${subOrder._id}/status`) && response.request().method() === 'PUT');
    await card.getByRole('button', { name: label, exact: true }).click();
    expect((await updated).status()).toBe(200);
  }
  await login(page, accounts.admin, true);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Commissions & Seller Settlements' }).click();
  const receiptForm = page.getByRole('article', { name: `Reconcile ${subOrder.subOrderNumber}` }).getByRole('form', { name: 'Confirm platform receipt' });
  await receiptForm.getByLabel('Actual bank or courier reference').fill(`E2E-RECEIPT-${subOrder._id}`);
  await receiptForm.getByLabel('Confirmed amount (LKR)').fill(String(subOrder.grossTotalLkr));
  await receiptForm.getByRole('checkbox').check();
  const received = page.waitForResponse((response) => response.url().endsWith(`/cash/receipt`) && response.request().method() === 'POST');
  await receiptForm.getByRole('button', { name: 'Confirm platform receipt', exact: true }).click();
  expect((await received).status()).toBe(201);
  await page.getByText('Record bank payout', { exact: true }).first().click();
  const payoutForm = page.getByRole('form', { name: 'Record completed bank transfer' }).first();
  await payoutForm.getByLabel('Actual bank or courier reference').fill(`E2E-PAYOUT-${subOrder._id}`);
  await payoutForm.getByLabel('Confirmed amount (LKR)').fill('950');
  await payoutForm.getByRole('checkbox').check();
  const paid = page.waitForResponse((response) => response.url().endsWith('/admin/settlements/payout') && response.request().method() === 'POST');
  await payoutForm.getByRole('button', { name: 'Record completed bank transfer', exact: true }).click();
  const payout = await paid;
  expect(payout.status()).toBe(201);
  const { settlement } = await payout.json();
  expect(settlement.sellerId).toBe('sel_test_pantry');
  expect(settlement.netPayoutLkr).toBe(950);
  await expect(page.getByRole('cell', { name: settlement.settlementReference, exact: true })).toBeVisible();
});

test('administrator security settings stay inside the screen and can be opened',async({page})=>{
  await login(page,accounts.admin,true);
  await expect(page).toHaveURL(/\/admin$/);
  const tab=page.getByRole('button',{name:'Admin Account & Security',exact:true});
  const fitsScreen=await tab.evaluate(element=>{
    const bounds=element.getBoundingClientRect();
    return bounds.left>=0&&bounds.right<=document.documentElement.clientWidth;
  });
  expect(fitsScreen).toBe(true);
  await tab.click();
  await expect(page.getByRole('heading',{name:'Administrator authenticator',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Set up authenticator',exact:true})).toBeVisible();
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
