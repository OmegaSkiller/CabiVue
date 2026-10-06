import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests/pwa',
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:5175', trace: 'retain-on-failure' },
  webServer: {
    command: `node ${resolve('dist/server/index.js')}`,
    cwd: process.env.PWA_TEST_DIR,
    url: 'http://localhost:5175/api/health',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]],
});
