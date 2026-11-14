import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
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

test('admin banner uploads stay independent and the storefront selects the correct device image', async ({ page }) => {
  await login(page, accounts.admin, true);
  await page.getByRole('button', { name: /^Homepage Banners/ }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const desktop = page.getByRole('textbox', { name: 'Desktop banner image URL' });
  const mobile = page.getByRole('textbox', { name: 'Mobile banner image URL' });
  const original = await desktop.inputValue();
  const mobileSource = '/brand/yaans-mark-dark.png';
  const desktopSource = '/brand/yaans-mark-white.png';
  let uploadCount = 0;
  // Only storage responses are simulated; authentication, CSRF, persistence and
  // public catalog reads use the real isolated API. Multipart/CDN checks run in integration.
  await page.route('**/api/admin/upload-image', route => {
    uploadCount++;
    return route.fulfill({ status: uploadCount === 1 ? 502 : 201, contentType: 'application/json',
      body: JSON.stringify(uploadCount === 1 ? { message: 'Image storage unavailable. Try again.' } : { url: uploadCount === 2 ? mobileSource : desktopSource }) });
  });
  const photo = { name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from('synthetic upload') };
  await page.getByLabel('Upload mobile banner', { exact: true }).setInputFiles(photo);
  await expect(page.getByRole('alert')).toHaveText('Image storage unavailable. Try again.');
  await expect(desktop).toHaveValue(original);
  await expect(mobile).toHaveValue(original);
  await page.getByLabel('Upload mobile banner', { exact: true }).setInputFiles(photo);
  await expect(mobile).toHaveValue(mobileSource);
  await expect(desktop).toHaveValue(original);
  await page.getByLabel('Upload desktop banner', { exact: true }).setInputFiles(photo);
  await expect(desktop).toHaveValue(desktopSource);
  await expect(mobile).toHaveValue(mobileSource);
  const saved = page.waitForResponse(response => response.url().endsWith('/api/admin/banners/bnr_test') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Edit Homepage Banner Card' })).toBeHidden();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(desktop).toHaveValue(desktopSource);
  await expect(mobile).toHaveValue(mobileSource);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/');
  const hero = page.getByRole('img', { name: 'Test Marketplace', exact: true });
  await expect(hero).toBeVisible();
  const expected = page.viewportSize().width >= 768 ? desktopSource : mobileSource;
  await expect.poll(() => hero.evaluate(image => new URL(image.currentSrc).pathname)).toBe(expected);
});

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

test('guest multi-seller checkout creates a confirmed order that can be tracked', async ({ page }, testInfo) => {
  for (const slug of ['test-ceylon-spice', 'test-desk-lamp']) {
    await page.goto(`/product/${slug}`);
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  }
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Multi-Seller Shopping Cart' })).toBeVisible();
  await expect(page.getByText('Shipment 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Proceed to Checkout/ }).click();
  const codCard = page.locator('.payment-card-selected');
  await expect(codCard).toHaveCSS('border-top-color', 'rgb(169, 37, 33)');
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByText('Pay cash to rider.')).toBeVisible();
    await expect(page.getByText('Online payments coming soon.')).toBeVisible();
    await expect(page.getByText(/Pay cash in Sri Lankan Rupees directly/)).toBeHidden();
    await expect(page.getByText(/Visa, MasterCard, and LankaQR instant online payments/)).toBeHidden();
  } else {
    await expect(page.getByText(/Pay cash in Sri Lankan Rupees directly/)).toBeVisible();
    await expect(page.getByText(/Visa, MasterCard, and LankaQR instant online payments/)).toBeVisible();
    await expect(page.getByText('Pay cash to rider.')).toBeHidden();
    await expect(page.getByText('Online payments coming soon.')).toBeHidden();
  }
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

test('unavailable saved products stay visible and counted until removed, then a valid quote recovers', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('yaans_cart', JSON.stringify([
    { productId: 'removed-product', title: 'Previously saved product', quantity: '2' },
    { productId: 'prd_test_lamp', title: 'Test Desk Lamp', quantity: 1 }
  ])));
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/orders/quote'));
  await page.goto('/cart');
  expect((await rejected).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('currently unavailable');
  await expect(page.getByRole('link', { name: 'Previously saved product', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 3 items' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Proceed to Checkout/ })).toBeDisabled();
  await expect(page.getByText('Calculating seller shipments...')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 3 items' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Remove Previously saved product', exact: true }).click();
  await expect(page.getByRole('button', { name: /Proceed to Checkout/ })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Cart, 1 item' }).first()).toBeVisible();
  await expect(page.getByText('Shipment 1 of 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear Entire Cart' }).click();
  await expect(page.getByRole('heading', { name: /Shopping Cart is Empty/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 0 items' }).first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yaans_cart')))).toEqual([]);
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
    items: [{ productId: 'prd_test_spice', variantLabel: '100 g', quantity: 1 }, { productId: 'prd_test_lamp', quantity: 1 }],
    shippingAddress, customerEmail: 'fulfillment@test.yaans.invalid', paymentMethod: 'COD', codConfirmedByCustomer: true
  } });
  expect(created.status()).toBe(201);
  const { order, subOrders } = await created.json();
  const subOrder = subOrders.find(sub => sub.items.some(item => item.productId === 'prd_test_spice'));
  const otherPackage = subOrders.find(sub => sub._id !== subOrder._id);
  await login(page, accounts.seller);
  await expect(page.getByRole('heading', { name: /Test Kandy Pantry.*Seller Portal/ })).toBeVisible();
  const inbox = page.getByRole('region', { name: 'Order notifications' });
  await expect(inbox.getByRole('status')).toContainText('New order received');
  await inbox.getByRole('button', { name: /Notifications/ }).click();
  const sellerAlert = inbox.getByRole('listitem').filter({ hasText: subOrder.subOrderNumber });
  await expect(sellerAlert).toBeVisible();
  await expect(sellerAlert).not.toContainText(otherPackage.items[0].title);
  await sellerAlert.getByRole('button', { name: 'View orders and mark as read' }).click();
  await expect(sellerAlert).toHaveCount(0);
  const card = page.getByText(`Sub-Order #${subOrder.subOrderNumber}`, { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]');
  for (const label of ['Mark Packed', 'Mark Shipped', 'Mark Delivered']) {
    const updated = page.waitForResponse((response) => response.url().includes(`/seller/suborders/${subOrder._id}/status`) && response.request().method() === 'PUT');
    await card.getByRole('button', { name: label, exact: true }).click();
    expect((await updated).status()).toBe(200);
  }
  await login(page, accounts.admin, true);
  await expect(page).toHaveURL(/\/admin$/);
  await inbox.getByRole('button', { name: /Notifications/ }).click();
  const adminAlert = inbox.getByRole('listitem').filter({ hasText: order.orderNumber }).filter({ hasText: subOrder.items[0].title });
  await expect(adminAlert).toContainText(otherPackage.items[0].title);
  await adminAlert.getByRole('button', { name: 'View orders and mark as read' }).click();
  await expect(adminAlert).toHaveCount(0);
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

test('administrator security and staff provisioning work on desktop and mobile',async({page,request})=>{
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
  await page.getByRole('button', { name: 'Business Policies & Storefront', exact: true }).click();
  await page.getByText('Announcements', {exact:true}).click();
  const previousSettings = await (await request.get('/api/marketplace/categories')).json();
  const announcement = `Delivery update ${randomUUID().slice(0,8)}`;
  await page.getByLabel('announcements.text', {exact:true}).fill(announcement);
  await page.getByLabel('Business settings administrator password').fill(TEST_PASSWORD);
  await page.getByRole('button', {name:'Save draft',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Draft saved.'})).toBeVisible();
  expect((await (await request.get('/api/marketplace/categories')).json()).businessSettings.announcements.text).toBe(previousSettings.businessSettings.announcements.text);
  await page.getByRole('button', {name:'Preview draft',exact:true}).click();
  await expect(page.getByRole('region',{name:'Business settings preview'})).toContainText(announcement);
  await page.getByLabel('Business settings administrator password').fill(TEST_PASSWORD);
  await page.getByRole('button', {name:'Publish saved draft',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Business settings published.'})).toBeVisible();
  await expect(page.getByRole('link',{name:announcement,exact:true})).toBeVisible();
  expect((await (await request.get('/api/marketplace/categories')).json()).businessSettings.announcements.text).toBe(announcement);
  await page.getByRole('button', { name: 'Staff Accounts', exact: true }).click();
  const email = `operator-${randomUUID()}@test.invalid`;
  const temporary = 'Temporary-staff-passphrase!123', permanent = 'Personal-staff-passphrase!456';
  const form = page.getByRole('form', { name: 'Create staff account' });
  await form.getByLabel('Staff name').fill('Browser Order Staff');
  await form.getByLabel('Staff email').fill(email);
  await form.getByLabel('Staff phone').fill('0771234567');
  await form.getByLabel('Temporary staff password').fill(temporary);
  await form.getByLabel('Your administrator password').fill(TEST_PASSWORD);
  await form.getByRole('button', { name: 'Create staff account' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Staff account created' })).toBeVisible();
  const staffCard = page.getByRole('article', { name: 'Staff member Browser Order Staff' }).filter({ hasText: email });
  await staffCard.getByRole('button', { name: 'Allow product editing', exact: true }).click();
  const permissionForm = page.getByRole('form', { name: 'Confirm staff access change' });
  await permissionForm.getByLabel('Confirm with your administrator password').fill(TEST_PASSWORD);
  await permissionForm.getByRole('button', { name: 'Confirm staff change' }).click();
  await expect(staffCard).toContainText('Product editing: Allowed');
  const created = await request.post('/api/orders/checkout', { headers: { 'Idempotency-Key': randomUUID() }, data: {
    items: [{ productId: 'prd_test_lamp', quantity: 1 }], shippingAddress,
    customerEmail: 'staff-orders@test.invalid', paymentMethod: 'COD', codConfirmedByCustomer: true
  } });
  expect(created.status()).toBe(201); const { order } = await created.json();
  await page.goto('/staff/login');
  await page.getByLabel('Staff email').fill(email); await page.getByLabel('Password', { exact: true }).fill(temporary);
  await page.getByRole('button', { name: 'Sign in to Staff Dashboard' }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole('region', { name: 'Order notifications' })).not.toBeVisible();
  const passwordForm = page.getByRole('form', { name: 'Change staff password' });
  await passwordForm.getByLabel('Temporary password').fill(temporary);
  await passwordForm.getByLabel('New password', { exact: true }).fill(permanent);
  await passwordForm.getByLabel('Confirm new password').fill(permanent);
  await passwordForm.getByRole('button', { name: 'Save staff password' }).click();
  await expect(page.getByRole('region', { name: 'Order notifications' }).getByRole('status')).toContainText('New order received');
  expect((await page.request.get('/api/admin/overview')).status()).toBe(403);
  expect((await page.request.get('/api/admin/staff')).status()).toBe(403);
  expect((await page.request.get('/api/seller/dashboard')).status()).toBe(403);
  expect((await page.request.post('/api/auth/staff/activity', { data: {} })).status()).toBe(403);
  await page.getByRole('button', { name: `View delivery details for ${order.orderNumber}` }).click();
  const details = page.getByRole('region', { name: 'Order delivery details' });
  await expect(details).toContainText(shippingAddress.recipientName);
  await expect(details).toContainText(shippingAddress.addressLine1);
  await expect(page.getByRole('button', { name: 'Commissions & Seller Settlements' })).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Staff Dashboard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  const products = page.getByRole('region', { name: 'Staff products' });
  await products.getByRole('button', { name: 'Edit Test Desk Lamp', exact: true }).click();
  const editorForm = page.getByRole('form', { name: 'Edit seller product' });
  const description = editorForm.getByRole('textbox', { name: 'Description', exact: true });
  const updatedDescription = (await description.inputValue()) + ' Staff edit verified.';
  await description.fill(updatedDescription);
  await editorForm.getByLabel('Image URL', { exact: true }).fill('https://example.com/lamp-detail.jpg');
  await editorForm.getByRole('button', { name: 'Add image URL' }).click();
  await editorForm.getByRole('button', { name: 'Make image 2 main' }).click();
  await editorForm.getByRole('button', { name: 'Save product changes' }).click();
  await expect(products.getByRole('status')).toContainText('Product updated');
  const published = await request.get('/api/marketplace/products/prd_test_lamp');
  const savedProduct = (await published.json()).product;
  expect(savedProduct.description).toBe(updatedDescription);
  expect(savedProduct.images).toHaveLength(2);
  expect(savedProduct.images[0]).toBe('https://example.com/lamp-detail.jpg');
  expect((await page.request.delete('/api/staff/products/prd_test_lamp')).status()).toBe(403);
  await page.goto('/product/test-desk-lamp');
  const secondImage = page.getByRole('button', { name: 'View product image 2' });
  await secondImage.click();
  await expect(secondImage).toHaveAttribute('aria-pressed', 'true');


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
