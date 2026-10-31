import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000, expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:3105', browserName: 'chromium', serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm start -- --hostname 127.0.0.1 --port 3105', url: 'http://127.0.0.1:3105', reuseExistingServer: false, timeout: 30000 },
});
