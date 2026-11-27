import { test, expect } from '@playwright/test';

test('homepage departments show three swipeable phone tiles and preserve the larger-screen 2x2 layout', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' })));
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  let homeRequests = 0;
  // Read the real isolated catalog, replacing only department tiles with a
  // bounded fixture that exercises more than four subcategories.
  await page.route('**/api/marketplace/home', async route => {
    homeRequests++;
    const response = await route.fetch();
    const home = await response.json();
    home.categories = [6, 4].map((count, i) => ({ _id: `test-department-${i}`, name: `Test department ${i + 1}`,
      slug: `test-department-${i}`, subCategories: Array.from({ length: count }, (_, j) => ({
        name: `Department ${i + 1} tile ${j + 1}`, slug: `tile-${j + 1}`, imageUrl: '/brand/yaans-mark-dark.png'
      })) }));
    await route.fulfill({ response, json: home });
  });
  await page.goto('/');
  const first = page.getByRole('region', { name: 'Test department 1 subcategories', exact: true });
  await expect(first).toBeVisible();
  const readLayout = region => region.evaluate(element => ({
    width: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft,
    left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
    tiles: [...element.querySelectorAll('a')].filter(link => getComputedStyle(link).display !== 'none').map(link => {
      const { x, y, width, right } = link.getBoundingClientRect();
      return { x, y, width, right };
    })
  }));
  const mobile = testInfo.project.name === 'mobile-chromium';
  const widths = mobile ? [320, 393, 639] : [640, 768, 1280];
  if (mobile) {
    await expect(page.getByRole('region', { name: 'Test department 2 subcategories', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Explore 1 More Category', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Test department 2 subcategories', exact: true })).toBeVisible();
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: 851 });
    for (const department of [1, 2]) {
      const region = page.getByRole('region', { name: `Test department ${department} subcategories`, exact: true });
      const layout = await readLayout(region);
      const card = region.locator('../..');
      const footerLink = card.getByRole('link', { name: `See all in Test department ${department}`, exact: true });
      const swipeHint = card.getByText(/^Swipe/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (mobile) {
        const linkBox = await footerLink.boundingBox(), hintBox = await swipeHint.boundingBox();
        expect(Math.abs((linkBox.y + linkBox.height / 2) - (hintBox.y + hintBox.height / 2))).toBeLessThan(2);
        expect(linkBox.x + linkBox.width).toBeLessThan(hintBox.x);
        await expect(card).toHaveCSS('padding-top', '12px');
        await expect(page.getByText('Tap any department or subcategory tile to filter products')).toBeHidden();
        const heading = await page.getByRole('heading', { name: 'Explore Categories' }).boundingBox();
        const viewAll = await page.getByRole('link', { name: 'View All Departments', exact: true }).boundingBox();
        expect(Math.abs((heading.y + heading.height / 2) - (viewAll.y + viewAll.height / 2))).toBeLessThan(2);
        expect(layout.tiles).toHaveLength(department === 1 ? 6 : 4);
        expect(layout.tiles.every(tile => Math.abs(tile.y - layout.tiles[0].y) < 1)).toBe(true);
        expect(layout.tiles[0].x).toBeCloseTo(layout.left, 0);
        expect(layout.tiles[2].right).toBeCloseTo(layout.right, 0);
        expect(layout.tiles[3].x).toBeGreaterThanOrEqual(layout.right);
        expect(layout.scrollWidth).toBeGreaterThan(layout.width);
      } else {
        await expect(swipeHint).toBeHidden();
        await expect(card).toHaveCSS('padding-top', '16px');
        await expect(page.getByText('Tap any department or subcategory tile to filter products')).toBeVisible();
        expect(layout.tiles).toHaveLength(4);
        expect(layout.tiles[0].y).toBeCloseTo(layout.tiles[1].y, 0);
        expect(layout.tiles[2].y).toBeCloseTo(layout.tiles[3].y, 0);
        expect(layout.tiles[2].y).toBeGreaterThan(layout.tiles[0].y);
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
      }
    }
  }
  if (mobile) {
    await page.setViewportSize({ width: 393, height: 851 });
    await first.scrollIntoViewIfNeeded();
    const box = await first.boundingBox();
    const cdp = await context.newCDPSession(page);
    const start = box.x + box.width - 15, end = box.x + 15, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * step / 6, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => first.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    // A touch fling keeps scrolling after touchEnd. Wait for its position to
    // settle before testing focus; do not scroll the last tile into view here.
    let previousScroll = -1, stableReads = 0;
    await expect.poll(async () => {
      const position = await first.evaluate(element => element.scrollLeft);
      stableReads = position === previousScroll ? stableReads + 1 : 0;
      previousScroll = position;
      return stableReads;
    }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
    const last = first.getByRole('link', { name: 'Department 1 tile 6', exact: true });
    await last.focus();
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    expect(homeRequests).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('mobile-department-row.png') });
    await last.click();
    await expect(page).toHaveURL(/\/products\?category=test-department-0&subCategory=tile-6$/);
  } else {
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('desktop-department-grid.png') });
    expect(homeRequests).toBe(1);
    await expect(first.getByRole('link', { name: 'Department 1 tile 5', exact: true })).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test('explore categories starts collapsed on mobile and desktop and smoothly toggles hidden departments', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem('yaans_cookie_consent', JSON.stringify({ status: 'accepted' })));
  await context.route('**/*', (route) =>
    ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()
  );

  const names = [
    'Accessories',
    'Ceramics',
    'Cane Products',
    'Home & Kitchen',
    'Fashion & Handloom',
    'Ayurveda & Beauty',
    'Handmade Gifts'
  ];
  const localThumbs = [
    '/card3_fashion.jpg',
    '/card1_kitchen.jpg',
    '/card5_homemade.jpg',
    '/card2_beauty.jpg',
    '/card4_electronics.jpg',
    '/brand/yaans-mark-dark.png',
    '/brand/yaans-mark-white.png'
  ];
  let homeRequests = 0;
  await page.route('**/api/marketplace/home', async (route) => {
    homeRequests++;
    const response = await route.fetch();
    const home = await response.json();
    home.categories = names.map((name, index) => ({
      _id: `cat-e2e-${index + 1}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      quadHeadline: name,
      imageUrl: localThumbs[index],
      subCategories: Array.from({ length: 4 }, (_, j) => ({
        name: `${name} tile ${j + 1}`,
        slug: `tile-${j + 1}`,
        imageUrl: localThumbs[(index + j) % localThumbs.length]
      }))
    }));
    await route.fulfill({ response, json: home });
  });

  await page.goto('/');
  const section = page.locator('section[data-home-section="categories"]');
  const homemade = page.locator('section[data-home-section="homemade"]');
  const docTop = (locator) => locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await expect(section).toBeVisible();
  await expect(homemade).toBeVisible();

  const mobile = testInfo.project.name === 'mobile-chromium';

  if (mobile) {
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 851 });
      await expect(section.getByRole('region', { name: 'Accessories subcategories', exact: true })).toBeVisible();
      await expect(section.getByRole('region', { name: 'Ceramics subcategories', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      const toggle = section.getByRole('button', { name: 'Explore 6 More Categories', exact: true });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toHaveCSS('color', 'rgb(255, 255, 255)');
      const toggleStyle = await toggle.evaluate((el) => {
        const css = getComputedStyle(el);
        return { bg: css.backgroundImage, radius: parseFloat(css.borderRadius), height: el.getBoundingClientRect().height };
      });
      expect(toggleStyle.bg).toContain('rgb(139, 12, 23)');
      expect(toggleStyle.bg).toContain('rgb(216, 36, 50)');
      expect(toggleStyle.radius).toBeGreaterThanOrEqual(toggleStyle.height / 2);
      expect(toggleStyle.height).toBeLessThanOrEqual(48);

      const preview = toggle.getByTestId('hidden-categories-preview');
      await expect(preview).toContainText('+6');
      const previewSources = await preview.locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));
      expect(previewSources).toEqual([localThumbs[1], localThumbs[2], localThumbs[3]]);
    }

    await page.setViewportSize({ width: 393, height: 851 });
    const firstCardBox = await section.getByRole('region', { name: 'Accessories subcategories', exact: true }).locator('../..').boundingBox();
    const toggle = section.getByRole('button', { name: 'Explore 6 More Categories', exact: true });
    const toggleBox = await toggle.boundingBox();
    const collapsedHomemadeTop = await docTop(homemade);
    const collapsedHomemadeBox = await homemade.boundingBox();
    expect(toggleBox.y - (firstCardBox.y + firstCardBox.height)).toBeGreaterThanOrEqual(4);
    expect(toggleBox.y - (firstCardBox.y + firstCardBox.height)).toBeLessThanOrEqual(16);
    expect(collapsedHomemadeBox.y - (toggleBox.y + toggleBox.height)).toBeLessThanOrEqual(24);

    await page.screenshot({ path: testInfo.outputPath('mobile-categories-collapsed.png') });

    await toggle.click();
    const collapseButton = section.getByRole('button', { name: 'Show Less Categories', exact: true });
    await expect(collapseButton).toBeVisible();
    await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    for (const name of names) {
      await expect(section.getByRole('region', { name: `${name} subcategories`, exact: true })).toBeVisible();
    }
    await expect.poll(() => docTop(homemade)).toBeGreaterThan(collapsedHomemadeTop + 400);
    await collapseButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('mobile-categories-expanded.png') });

    await collapseButton.click();
    await expect(section.getByRole('button', { name: 'Explore 6 More Categories', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(section.getByRole('region', { name: 'Ceramics subcategories', exact: true })).toHaveCount(0);
    await expect.poll(() => docTop(homemade)).toBeLessThan(collapsedHomemadeTop + 5);
  } else {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const visibleName of ['Accessories', 'Ceramics', 'Cane Products']) {
      await expect(section.getByRole('region', { name: `${visibleName} subcategories`, exact: true })).toBeVisible();
    }
    for (const hiddenName of names.slice(3)) {
      await expect(section.getByRole('region', { name: `${hiddenName} subcategories`, exact: true })).toHaveCount(0);
    }

    const rowBoxes = await Promise.all(
      ['Accessories', 'Ceramics', 'Cane Products'].map((name) =>
        section.getByRole('region', { name: `${name} subcategories`, exact: true }).locator('../..').boundingBox()
      )
    );
    expect(Math.abs(rowBoxes[0].y - rowBoxes[1].y)).toBeLessThan(2);
    expect(Math.abs(rowBoxes[1].y - rowBoxes[2].y)).toBeLessThan(2);

    const toggle = section.getByRole('button', { name: 'Explore 4 More Categories', exact: true });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveCSS('color', 'rgb(255, 255, 255)');
    const preview = toggle.getByTestId('hidden-categories-preview');
    await expect(preview).toContainText('+4');
    const previewSources = await preview.locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));
    expect(previewSources).toEqual([localThumbs[3], localThumbs[4], localThumbs[5]]);

    const collapsedHomemadeTop = await docTop(homemade);
    await toggle.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('desktop-categories-collapsed.png') });

    await toggle.click();
    const collapseButton = section.getByRole('button', { name: 'Show Less Categories', exact: true });
    await expect(collapseButton).toBeVisible();
    await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    for (const name of names) {
      await expect(section.getByRole('region', { name: `${name} subcategories`, exact: true })).toBeVisible();
    }
    await expect.poll(() => docTop(homemade)).toBeGreaterThan(collapsedHomemadeTop + 200);
    const [firstCardNow, fourthCardBox] = await Promise.all([
      section.getByRole('region', { name: 'Accessories subcategories', exact: true }).locator('../..').boundingBox(),
      section.getByRole('region', { name: 'Home & Kitchen subcategories', exact: true }).locator('../..').boundingBox()
    ]);
    expect(Math.abs(fourthCardBox.x - firstCardNow.x)).toBeLessThan(2);
    expect(fourthCardBox.y).toBeGreaterThan(firstCardNow.y + firstCardNow.height);
    await collapseButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('desktop-categories-expanded.png') });

    await collapseButton.click();
    await expect(section.getByRole('button', { name: 'Explore 4 More Categories', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(section.getByRole('region', { name: 'Home & Kitchen subcategories', exact: true })).toHaveCount(0);
    await expect.poll(() => docTop(homemade)).toBeLessThan(collapsedHomemadeTop + 5);

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(section.getByRole('region', { name: 'Accessories subcategories', exact: true })).toBeVisible();
    await expect(section.getByRole('region', { name: 'Ceramics subcategories', exact: true })).toBeVisible();
    await expect(section.getByRole('region', { name: 'Cane Products subcategories', exact: true })).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Explore 5 More Categories', exact: true })).toBeVisible();
  }

  expect(homeRequests).toBe(1);
  expect(errors).toEqual([]);
});
