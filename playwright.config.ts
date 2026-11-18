import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/frontend',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4340', locale: 'fr-CA', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4340', url: 'http://127.0.0.1:4340', reuseExistingServer: false, env: { SESSION_SECRET: 'frontend-tests-only-not-a-production-secret', STUDIO_ADMIN_URL: '', STUDIO_ADMIN_KEY: '' }, timeout: 60000 },
});
