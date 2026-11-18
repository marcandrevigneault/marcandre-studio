import { test, expect } from '@playwright/test';

test('compact branded header opens, closes and navigates with touch or mouse', async ({ page, isMobile }, testInfo) => {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  const menu=page.locator('.menu-disclosure'), toggle=page.locator('.menu-disclosure > summary');
  await expect(page.locator('.brand')).toHaveText('mytinylab');
  await expect(page.locator('.menu-panel')).toBeHidden();
  await expect(page.locator('.admin-link')).toBeHidden();
  const header=await page.locator('.site-nav').boundingBox();expect(header!.height).toBeLessThan(100);
  const box=await toggle.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
  if(isMobile)await toggle.tap();else await toggle.click();
  await expect(menu).toHaveAttribute('open','');
  await expect(page.locator('.menu-panel').getByRole('link',{name:'Projets',exact:true})).toBeVisible();
  await expect(page.locator('.menu-panel a[href="/photography/"]')).toHaveCount(0);
  await expect(page.locator('.admin-link')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await testInfo.attach('menu-open',{body:await page.screenshot(),contentType:'image/png'});
  await toggle.click();await expect(page.locator('.menu-panel')).toBeHidden();
  await toggle.click();await page.locator('.menu-panel').getByRole('link',{name:'Projets',exact:true}).click();
  await expect(page).toHaveURL(/\/projects\/$/);await expect(page.locator('.menu-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('menu supports keyboard, Escape, outside dismissal and English labels',async({page})=>{
  await page.goto('/');const toggle=page.locator('.menu-disclosure > summary');
  await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('.menu-panel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.menu-panel')).toBeHidden();await expect(toggle).toBeFocused();
  await toggle.click();await page.mouse.click(5,500);await expect(page.locator('.menu-panel')).toBeHidden();
  await page.getByRole('button',{name:'English',exact:true}).click();await toggle.click();
  await expect(page.locator('.menu-panel').getByRole('link',{name:'Projects',exact:true})).toBeVisible();
});

test('no horizontal overflow at narrow phone width, landscape or with JavaScript disabled',async({page,browser})=>{
  for(const size of [{width:320,height:700},{width:844,height:390}]){
    await page.setViewportSize(size);await page.goto('/about/');await page.locator('.menu-disclosure > summary').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const panel=await page.locator('.menu-panel').boundingBox();expect(panel!.x).toBeGreaterThanOrEqual(0);expect(panel!.x+panel!.width).toBeLessThanOrEqual(size.width+1);
  }
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});const fallback=await context.newPage();
  await fallback.goto('http://127.0.0.1:4340/');await fallback.locator('.menu-disclosure > summary').click();
  await expect(fallback.locator('.menu-panel').getByRole('link',{name:'Projets',exact:true})).toBeVisible();await context.close();
});
