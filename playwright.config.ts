import { defineConfig, devices } from '@playwright/test';

// Playwright config for staging E2E smoke tests.
// NOTE: This file is a template. Install Playwright locally before running:
//   npm install -D @playwright/test
//   npx playwright install

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
