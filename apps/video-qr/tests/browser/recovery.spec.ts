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

  await page.goto('./');
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

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save-decoded').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('recovered-video.webm');
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(original);
});
