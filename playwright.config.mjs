import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/ui',
  fullyParallel: false,
  workers: 1,
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:9000',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 9000',
    url: 'http://127.0.0.1:9000',
    reuseExistingServer: !process.env.CI,
  },
})
