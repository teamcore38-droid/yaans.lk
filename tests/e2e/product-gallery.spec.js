import { test, expect } from '@playwright/test';
import { nextAdminRecoveryCode, accounts, TEST_PASSWORD } from '../support/fixtures.js';

for (const role of ['seller', 'admin']) test(`${role} photo cards support upload, replacement, main selection, order and saved removal`, async ({ page, context }, testInfo) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>localStorage.setItem('yaans_cookie_consent',JSON.stringify({status:'accepted'})));
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.route('https://example.com/gallery-detail.jpg',route=>route.fulfill({path:'frontend/public/card5_homemade.jpg',contentType:'image/jpeg'}));
  await page.goto(role==='admin'?'/admin/login':'/login');
  await page.getByPlaceholder(role==='admin'?'admin@yaans.lk':'name@example.lk').fill(accounts[role]);
  await page.getByPlaceholder(role==='admin'?'••••••••••••':'••••••••',{exact:true}).fill(TEST_PASSWORD);
  await page.getByRole('button',{name:role==='admin'?'Sign In to Admin Console':'Sign In',exact:true}).click();
  if(role==='admin'){await page.getByLabel('Authenticator or recovery code').fill(nextAdminRecoveryCode());await page.getByRole('button',{name:'Sign In to Admin Console',exact:true}).click();}
  await page.getByRole('button',{name:role==='admin'?/^Product & Category Moderation/:/^Products & Cloudinary Upload/}).click();
  if(role==='admin') await page.getByRole('row').filter({hasText:'Test Ceylon Spice'}).getByRole('button',{name:'Edit',exact:true}).click();
  else await page.getByRole('img',{name:'Test Ceylon Spice',exact:true}).locator('../..').getByRole('button',{name:'Edit',exact:true}).click();
  const gallery=page.getByRole('group',{name:/Product images \(/});
  await expect(gallery).toBeVisible();
  while(await gallery.getByRole('article').count()) await gallery.getByRole('button',{name:'Remove image 1',exact:true}).click();
  const sources=['/brand/yaans-mark-dark.png','/brand/yaans-logo-horizontal-dark.png','/brand/yaans-mark-white.png'];
  let uploads=0;
  // Only the storage response is simulated; save uses the real session/CSRF/API/database.
  await page.route('**/api/seller/upload-image',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({url:sources[uploads++]})}));
  const file={name:'photo.png',mimeType:'image/png',buffer:Buffer.from('synthetic image')};
  const chooser=page.waitForEvent('filechooser');await gallery.getByRole('button',{name:'Add photos',exact:true}).click();
  await (await chooser).setFiles([file,{...file,name:'detail.png'}]);
  await expect(gallery.getByRole('article')).toHaveCount(2);
  const replacement=page.waitForEvent('filechooser');await gallery.getByRole('button',{name:'Edit image 2',exact:true}).click();
  await (await replacement).setFiles({...file,name:'replacement.png'});
  await expect(gallery.getByAltText('Product image 2')).toHaveAttribute('src',sources[2]);
  await gallery.getByRole('button',{name:'Make image 2 main',exact:true}).click();
  await expect(gallery.getByAltText('Product image 1')).toHaveAttribute('src',sources[2]);
  await gallery.getByRole('button',{name:'Move image 2 earlier',exact:true}).click();
  await expect(gallery.getByAltText('Product image 1')).toHaveAttribute('src',sources[0]);
  await gallery.getByRole('button',{name:'Move image 1 later',exact:true}).click();
  await gallery.getByRole('button',{name:'Remove image 2',exact:true}).click();
  await gallery.getByLabel('Image URL',{exact:true}).fill('https://example.com/gallery-detail.jpg');
  await gallery.getByRole('button',{name:'Add image URL',exact:true}).click();
  await expect(gallery).toContainText('Product images (2/8)');
  await expect(gallery.getByRole('article',{name:'Photo 1',exact:true})).toContainText('Main image');
  for(const button of await gallery.getByRole('button').all()) {
    const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  expect(await gallery.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await gallery.screenshot({path:testInfo.outputPath(`${role}-photo-cards.png`)});
  await page.getByRole('button',{name:role==='admin'?'Save & Publish Overrides':'Save Product Changes',exact:true}).click();
  await expect.poll(async()=>{
    const response=await page.request.get('/api/marketplace/products/prd_test_spice');return (await response.json()).product.images;
  }).toEqual([sources[2],'https://example.com/gallery-detail.jpg']);
  expect(errors).toEqual([]);
});
