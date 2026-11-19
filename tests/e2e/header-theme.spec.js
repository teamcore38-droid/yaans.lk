import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test.beforeEach(async({page,context})=>{
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await context.addInitScript(()=>localStorage.setItem('yaans_cookie_consent',JSON.stringify({status:'accepted'})));
});

test('red wave header fits mobile, tablet and desktop without covering controls',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  const header=page.getByRole('banner');
  const logo=header.getByRole('img',{name:'Yaans.lk Marketplace',exact:true});
  await expect(logo).toHaveAttribute('src','/brand/yaans-logo-horizontal-white.png');
  const measurements=[];
  for(const width of [320,360,393,768,820,1024,1440]){
    await page.setViewportSize({width,height:960});
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const box=await header.boundingBox();expect(box.width).toBe(width);
    expect(box.height).toBeLessThan(width<768?150:110);
    const decoration=await page.locator('.header-red-main').evaluate(el=>{
      const css=getComputedStyle(el,'::before');return {background:css.backgroundImage,pointerEvents:css.pointerEvents,animation:css.animationName};
    });
    expect(decoration.background).toContain('svg');expect(decoration.pointerEvents).toBe('none');expect(decoration.animation).toBe('none');
    await expect(header.getByRole('link',{name:'Wishlist',exact:true})).toHaveCSS('color','rgb(255, 255, 255)');
    const search=header.locator('input[placeholder="Handmade dresses, cane crafts, bouquets"]:visible');
    await expect(search).toBeVisible();await expect(search).toHaveCSS('color','rgb(15, 23, 42)');
    const cart=await header.getByRole('link',{name:'Cart, 0 items',exact:true}).boundingBox();
    expect(cart.x+cart.width).toBeLessThanOrEqual(width);
    const logoBox=await logo.boundingBox();
    measurements.push({width,header:box,logo:logoBox});
    if(width===393 || width===1440)await page.screenshot({path:testInfo.outputPath(`red-header-${width}.png`)});
  }
  await fs.writeFile(testInfo.outputPath('header-dimensions.json'),JSON.stringify(measurements,null,2));
  await page.setViewportSize({width:393,height:852});
  const bottom=page.locator('nav.fixed.bottom-0');await expect(bottom).toHaveCSS('background-color','rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('themed header keeps search, menu, location, account and cart navigation working',async({page},testInfo)=>{
  await page.goto('/');const header=page.getByRole('banner');
  const mobile=page.viewportSize().width<768;
  const search=header.locator('input[placeholder="Handmade dresses, cane crafts, bouquets"]:visible');
  await search.fill('Test Ceylon Spice');await search.press('Enter');await expect(page).toHaveURL(/\/products\?q=Test\+Ceylon\+Spice/);
  const district=header.getByRole('button',{name:page.viewportSize().width<1024?'Deliver to Colombo ▾':'Deliver to Sri Lanka Colombo District',exact:true});
  await district.click();await page.getByText('Choose Your Delivery District',{exact:true}).locator('xpath=ancestor::div[contains(@class,"max-w-md")][1]').getByRole('button',{name:'Kandy',exact:true}).click();
  await expect(header.getByRole('button',{name:page.viewportSize().width<1024?'Deliver to Kandy ▾':'Deliver to Sri Lanka Kandy District',exact:true})).toBeVisible();
  if(mobile){
    await header.getByRole('button',{name:'Open categories menu'}).click();
    await page.getByRole('link',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/login/);
  }else{
    await header.getByRole('link',{name:/Sign in Account/}).click();await expect(page).toHaveURL(/\/login/);
  }
  await page.screenshot({path:testInfo.outputPath('red-header-login.png')});
  await header.getByRole('link',{name:'Wishlist',exact:true}).click();await expect(page).toHaveURL(/\/wishlist/);
  await header.getByRole('link',{name:'Cart, 0 items',exact:true}).click();await expect(page).toHaveURL(/\/cart/);
});
