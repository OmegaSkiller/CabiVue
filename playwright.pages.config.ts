import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pages',
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:5176/CabiVue/', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview:demo',
    url: 'http://127.0.0.1:5176/CabiVue/',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pages' }]],
});
