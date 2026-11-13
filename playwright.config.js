import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';

process.env.YAANS_TEST_RUN_ID ||= randomUUID();
const isolatedProject = process.env.YAANS_TEST_PROJECT;
if (isolatedProject && !['chromium', 'mobile-chromium'].includes(isolatedProject)) throw new Error('Unknown isolated browser project.');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  outputDir: isolatedProject ? `test-results/browser/${isolatedProject}` : 'test-results/browser',
  globalTeardown: './tests/support/stop-api.js',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45000,
  globalTimeout: 10 * 60 * 1000,
  reporter: isolatedProject
    ? [['list'], ['blob', { outputDir: process.env.YAANS_TEST_BLOB_DIR, fileName: 'report.zip' }]]
    : [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/e2e.xml' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: process.env.YAANS_TEST_BROWSER_CHANNEL || undefined,
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
      timeout: 180000, reuseExistingServer: false, env: { YAANS_E2E_GOOGLE: 'true' } },
    { command: 'npm --prefix frontend run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173', timeout: 60000, reuseExistingServer: false,
      env: { YAANS_TEST_API_TARGET: 'http://127.0.0.1:5179' } }
  ]
});
