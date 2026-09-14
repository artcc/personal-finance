import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @personal-finance/api start',
      url: 'http://127.0.0.1:3000/api/v1/health/live',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '3000',
        APP_ORIGIN: 'http://127.0.0.1:4173',
        DATABASE_URL:
          process.env['TEST_DATABASE_URL'] ?? 'postgresql://unused:unused@127.0.0.1:1/unused',
      },
    },
    {
      command: 'pnpm --filter @personal-finance/web preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
  ],
});
