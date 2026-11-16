import { defineConfig, devices } from '@playwright/test'

/**
 * Owner console end-to-end suite (spec §6.3.5). Run with `npm run test:owner-e2e`, which starts the Firestore and Auth
 * emulators, seeds them (scripts/owner-console-seed), builds and starts the app against them, then runs these tests.
 * Nothing here talks to a real Firebase project.
 */
const baseURL = process.env.OWNER_E2E_BASE_URL || 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e/owner-console',
  outputDir: './test-results/owner-e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/owner-e2e' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined,
  },
})
