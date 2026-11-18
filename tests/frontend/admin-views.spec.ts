import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

test('admin page views show counts, zeroes, period changes and unavailable data', async ({ page, context }, testInfo) => {
  // A local-only session for the isolated test server; never uses production credentials.
  const payload = String(Math.floor(Date.now() / 1000) + 3600);
  const signature = createHmac('sha256', 'frontend-tests-only-not-a-production-secret').update(payload).digest('base64url');
  await context.addCookies([{name:'mas_session',value:`${payload}.${signature}`,url:'http://127.0.0.1:4340'}]);
  await page.route('**/api/galleries', route => route.fulfill({json:[]}));
  let unavailable = false;
  await page.route('**/api/admin/stats?*', route => {
    if (unavailable) return route.fulfill({status:503,json:{error:'Unavailable'}});
    const days = Number(new URL(route.request().url()).searchParams.get('days'));
    return route.fulfill({json:{days,startedAt:'2026-11-18T00:00:00Z',updatedAt:'2026-11-18T12:00:00Z',totalViews:days===7?4:12,totalVisits:2,daily:[],pages:[
      {path:'/projects/video-qr/',title:'Vidéo QR',views:days===7?4:12},
      {path:'/about/',title:'À propos',views:0},
    ]}});
  });
  await page.goto('/admin');
  const table=page.getByRole('table',{name:/Vues par page/});
  await expect(table.getByRole('row').filter({hasText:'Vidéo QR'})).toContainText('4');
  await expect(table.getByRole('row').filter({hasText:'À propos'}).getByRole('cell')).toHaveText('0');
  await page.getByRole('button',{name:'30 jours',exact:true}).click();
  await expect(table.getByRole('row').filter({hasText:'Vidéo QR'}).getByRole('cell')).toHaveText('12');
  await page.getByRole('link',{name:'Vues par page',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vues par page'})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await testInfo.attach('admin-page-views',{body:await page.screenshot(),contentType:'image/png'});
  unavailable=true;
  await page.getByRole('button',{name:'7 jours',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(table).toHaveCount(0);
});

test('page statistics remain private',async({request})=>{
  expect((await request.get('/api/admin/stats?days=7')).status()).toBe(401);
});
