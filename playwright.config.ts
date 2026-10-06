import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/browser-test.mjs',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
