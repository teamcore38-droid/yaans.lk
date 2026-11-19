import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' })));
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
});

test('mobile sellers fit one card and swipe while desktop keeps the grid', async ({ page, context }) => {
  await page.setViewportSize({ width: 393, height: 850 });
  await page.goto('/');
  const sellers = page.getByRole('region', { name: 'Shop Local Sellers' });
  await expect(sellers.locator('a')).toHaveCount(2);
  const section = sellers.locator('..');
  const mobile = await sellers.evaluate(element => {
    const cards = [...element.querySelectorAll('a')].map(card => card.getBoundingClientRect());
    return { width: element.clientWidth, scrollWidth: element.scrollWidth, left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right, cards: cards.map(card => ({ x: card.x, width: card.width, height: card.height, y: card.y })) };
  });
  expect(mobile.scrollWidth).toBeGreaterThan(mobile.width);
  expect(mobile.cards[0].width).toBeCloseTo(mobile.width, 0);
  expect(mobile.cards[1].x).toBeGreaterThanOrEqual(mobile.right);
  expect(mobile.cards[0].y).toBe(mobile.cards[1].y);
  expect((await section.boundingBox()).height).toBeLessThan(mobile.cards[0].height + 80);
  expect((await page.locator('section[data-home-section="recommended"]').boundingBox()).y)
    .toBeGreaterThan((await section.boundingBox()).y);
  await expect(page.getByText('Sri Lanka’s marketplace connecting shoppers with local sellers and Sri Lankan women entrepreneurs.')).toBeVisible();
  await expect(page.locator('input[placeholder="Handmade dresses, cane crafts, bouquets"]')).toHaveCount(2);

  await sellers.scrollIntoViewIfNeeded();
  const box = await sellers.boundingBox();
  const cdp = await context.newCDPSession(page);
  const start = box.x + box.width - 20, end = box.x + 20, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
  for (let step = 1; step <= 6; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 6, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => sellers.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(sellers).toHaveCSS('display', 'grid');
  const desktop = await sellers.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.width + 1);
  const storeLink = sellers.locator('a').first();
  const href = await storeLink.getAttribute('href');
  await storeLink.click();
  await expect(page).toHaveURL(new URL(href, page.url()).toString());
});

for (const total of [17, 45]) test(`recommendations reveal all ${total} products without duplicates`, async ({ page }) => {
  const catalog = Array.from({ length: total }, (_, index) => ({
    _id: `recommended-${index}`, slug: `recommended-${index}`, title: `Recommended item ${index}`,
    sellerId: 'sel_test_pantry', sellerName: 'Test Kandy Pantry', sellerDistrict: 'Kandy',
    priceLkr: 1000, stock: 25, images: ['/brand/yaans-mark-dark.png'], rating: 5
  }));
  await page.route('**/api/marketplace/home', async route => {
    const response = await route.fetch();
    const home = await response.json();
    await route.fulfill({ response, json: { ...home, recommendedProducts: catalog.slice(0, 10) } });
  });
  let pageRequests = 0;
  await page.route('**/api/marketplace/recommendations?*', route => {
    pageRequests++;
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    return route.fulfill({ json: { products: catalog.slice(offset, offset + limit), total } });
  });
  await page.goto('/');
  const section = page.locator('section[data-home-section="recommended"]');
  const titles = section.locator('a.line-clamp-2');
  const sentinel = section.locator('div[aria-hidden="true"].h-1');
  await expect(titles).toHaveCount(10);
  for (let previous = 10; previous < Math.min(total, 40);) {
    await sentinel.scrollIntoViewIfNeeded();
    await expect.poll(() => titles.count()).toBeGreaterThan(previous);
    previous = await titles.count();
  }
  await expect(titles).toHaveCount(Math.min(total, 40));
  expect(pageRequests).toBeGreaterThan(0);
  if (total > 40) {
    await expect(section.getByRole('button', { name: 'Load More' })).toBeVisible();
    await expect(section.getByRole('link', { name: 'See All Products' })).toBeVisible();
    await section.getByRole('button', { name: 'Load More' }).click();
    await expect(titles).toHaveCount(total);
    await expect(section.getByRole('button', { name: 'Load More' })).toHaveCount(0);
    const ids = await titles.evaluateAll(elements => elements.map(element => element.getAttribute('href')));
    expect(new Set(ids).size).toBe(total);
    await section.getByRole('link', { name: 'See All Products' }).click();
    await expect(page).toHaveURL(/\/products$/);
  } else {
    await expect(section.getByRole('button', { name: 'Load More' })).toHaveCount(0);
    await expect(section.getByRole('link', { name: 'See All Products' })).toHaveCount(0);
  }
});
