import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: {
    command:
      'DATA_DIR=./data/browser-test npm run demo && DATA_DIR=./data/browser-test DEMO_MODE=true npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
