import { defineConfig, devices } from '@playwright/test';

// Determine if we should test against deployed site or local server
const TEST_DEPLOYED_SITE = process.env.TEST_DEPLOYED_SITE === 'true';
const DEPLOYED_SITE_URL = process.env.DEPLOYED_SITE_URL || 'https://appgates.github.io/PongPush/';
const LOCAL_BASE_URL = 'http://localhost:4173/PongPush';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Extended timeout when testing deployed site (waiting for deployment) */
  timeout: TEST_DEPLOYED_SITE ? 600000 : 30000, // 10 minutes for deployed, 30s for local

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: TEST_DEPLOYED_SITE ? DEPLOYED_SITE_URL : LOCAL_BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run your local dev server before starting the tests (only when testing locally) */
  webServer: TEST_DEPLOYED_SITE ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
