import { defineConfig } from '@playwright/test';

// Supply an installed Chromium without downloading Playwright's browser:
// PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
// PLAYWRIGHT_BASE_URL=https://host/tools/video-qr/ targets an existing server.
const externalURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalURL || 'http://127.0.0.1:5199/';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: './node_modules/.cache/playwright-results',
  use: {
    browserName: 'chromium',
    baseURL,
    headless: true,
    acceptDownloads: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined },
    trace: 'retain-on-failure',
  },
  webServer: externalURL ? undefined : {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
