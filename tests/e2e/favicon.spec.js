import { expect, test } from '@playwright/test';

test('homepage and admin HTML expose the same locally served favicons', async ({ page, request }) => {
  // Fetch the HTML directly, as a crawler would, without running the app.
  for (const path of ['/', '/admin', '/admin/login']) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const head = (await response.text()).match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '';
    expect(head).toMatch(/<link rel="icon" type="image\/png" sizes="96x96" href="\/favicon\.png"/);
    expect(head).toMatch(/<link rel="icon" type="image\/x-icon" sizes="16x16 32x32 48x48" href="\/favicon\.ico"/);
    expect(head).toMatch(/<link rel="apple-touch-icon" sizes="180x180" href="\/brand\/apple-touch-icon\.png"/);
  }

  for (const [path, type] of [
    ['/favicon.png', /image\/png/],
    ['/favicon.ico', /image\/(?:x-icon|vnd\.microsoft\.icon)/],
    ['/brand/apple-touch-icon.png', /image\/png/]
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(type);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }

  await page.goto('/favicon.png');
  const sizes = await page.evaluate(async () => {
    return Promise.all(['/favicon.png', '/favicon.ico', '/brand/apple-touch-icon.png'].map(async path => {
      const image = new Image();
      image.src = path;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }));
  });
  expect(sizes[0]).toEqual([96, 96]);
  expect(sizes[1][0]).toBe(sizes[1][1]);
  expect([16, 32, 48]).toContain(sizes[1][0]);
  expect(sizes[2]).toEqual([180, 180]);
});
