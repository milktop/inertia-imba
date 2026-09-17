import { defineConfig } from '@playwright/test'

const port = process.env.E2E_PORT || '3111'

export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    // Allows local Chrome on hosts too old for bundled Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bash bin/browser-test-server',
    url: `http://127.0.0.1:${port}/students`,
    reuseExistingServer: false,
    timeout: 120000,
  },
})
