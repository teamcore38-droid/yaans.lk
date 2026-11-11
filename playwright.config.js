import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';

process.env.YAANS_TEST_RUN_ID ||= randomUUID();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  outputDir: 'test-results/browser',
  globalTeardown: './tests/support/stop-api.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45000,
  globalTimeout: 10 * 60 * 1000,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/e2e.xml' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ],
  webServer: [
    { command: 'node tests/support/start-api.js', url: 'http://127.0.0.1:5179/api/health',
      timeout: 180000, reuseExistingServer: false },
    { command: 'npm --prefix frontend run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173', timeout: 60000, reuseExistingServer: false,
      env: { YAANS_TEST_API_TARGET: 'http://127.0.0.1:5179' } }
  ]
});
