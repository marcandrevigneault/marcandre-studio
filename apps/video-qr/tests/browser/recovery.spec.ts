import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Regression: clearing recoveredBlob/completed on navigation used to discard
// a verified film whenever its optional MP4 playback conversion had failed.
test('recovered WebM survives failed playback and a workspace round trip', async ({ page }) => {
  const original = await readFile(new URL('../../public/examples/demo.webm', import.meta.url));
  let fallbackRequests = 0;
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => '';
  });
  await page.route('**/ffmpeg-core.wasm', async route => {
    fallbackRequests++;
    await route.abort('failed');
  });

  await page.goto('./?lang=en');
  await page.locator('#decode-tab').click();
  // Fetches and scans the real PNG, then verifies and assembles its binary packet.
  await page.locator('#example').click();
  await expect(page.locator('#status')).toContainText('playback unavailable');
  expect(fallbackRequests).toBeGreaterThan(0);
  await expect(page.locator('#collection-count')).toHaveText('1 / 1 frames collected');

  const firstAttemptRequests = fallbackRequests;
  await page.locator('#encode-tab').click();
  await page.locator('#decode-tab').click();
  await expect(page.locator('#decoded-result')).toBeVisible();
  await expect(page.locator('#status')).toContainText('playback unavailable');
  expect(fallbackRequests).toBeGreaterThan(firstAttemptRequests);
  await expect(page.locator('#collection-count')).toHaveText('1 / 1 frames collected');

  await page.locator('#language-fr').click();
  await expect(page.locator('#status')).toContainText('lecture indisponible');
  await expect(page.locator('#collection-count')).toHaveText('1 / 1 images recueillies');
  await expect(page.locator('#decoded-result')).toBeVisible();
  expect(fallbackRequests).toBeGreaterThan(firstAttemptRequests);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save-decoded').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('recovered-video.webm');
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(original);
});

test('French default, persistent preference, explicit query and live errors', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle('Vidéo QR — un cinéma de poche');
  await expect(page.locator('#status')).toHaveText('Choisissez un extrait pour commencer.');
  await expect(page.locator('#language-fr')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#trim-start').fill('1.2');
  await page.locator('#preset').selectOption('clear');
  await page.locator('#language-en').click();
  await expect(page.locator('#trim-start')).toHaveValue('1.2');
  await expect(page.locator('#preset')).toHaveValue('clear');
  expect(await page.evaluate(() => localStorage.getItem('studio-language'))).toBe('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('./?lang=fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.locator('#decode-tab').click();
  await page.locator('#qr-files').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(page.locator('#status')).toHaveText('1 image n’a pas pu être ajoutée. Choisissez une image PNG valide.');
  await page.locator('#language-en').click();
  await expect(page.locator('#status')).toHaveText('1 image could not be added. Choose a valid PNG image.');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('switching language preserves source, encoded frames and export bytes', async ({ page }) => {
  await page.goto('./');
  await page.locator('#video-file').setInputFiles(new URL('../../public/examples/demo.webm', import.meta.url).pathname);
  await expect(page.locator('#encode')).toBeEnabled();
  await page.locator('input[value="sequence"]').check();
  await page.locator('#encode').click();
  await expect(page.locator('#qr-result')).toBeVisible({ timeout: 40_000 });
  const canvas = await page.locator('#qr-canvas').evaluate(node => (node as HTMLCanvasElement).toDataURL());
  const source = await page.locator('#source-video').getAttribute('src');
  const save = async () => {
    const event = page.waitForEvent('download');
    await page.locator('#save-encoded').click();
    const download = await event;
    return readFile((await download.path())!);
  };
  const original = await save();
  await page.locator('#language-en').click();
  await expect(page.locator('#status')).toHaveText('Export opened. Choose where to save your file.');
  await expect(page.locator('#source-name')).toHaveText('demo.webm');
  await expect(page.locator('#source-video')).toHaveAttribute('src', source!);
  await expect(page.locator('#qr-result')).toBeVisible();
  await expect(page.locator('#frame-info')).toContainText('FRAME');
  expect(await page.locator('#qr-canvas').evaluate(node => (node as HTMLCanvasElement).toDataURL())).toBe(canvas);
  expect(await save()).toEqual(original);
});
