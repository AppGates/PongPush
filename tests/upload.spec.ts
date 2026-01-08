import { test, expect, Page } from '@playwright/test';

// Configuration from environment variables
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA;
const TEST_DEPLOYED_SITE = process.env.TEST_DEPLOYED_SITE === 'true';
const DEPLOYED_SITE_URL = process.env.DEPLOYED_SITE_URL || 'https://appgates.github.io/PongPush/';

/**
 * Structured logging for E2E tests
 */
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'E2E-Test',
    message,
    data,
  };

  // Output as JSON for CI parsing
  if (process.env.CI === 'true') {
    console.log(JSON.stringify(entry));
  } else {
    console.log(`[${level}] ${message}`, data || '');
  }
}

/**
 * Wait for the correct commit version to be deployed
 * This ensures we test the page that matches the commit we're testing
 */
async function waitForCorrectCommit(page: Page, expectedSha: string, maxRetries = 30, retryDelayMs = 10000): Promise<void> {
  log('INFO', 'Waiting for commit to be deployed', { expectedSha, maxRetries });

  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

      // Check if element with commit SHA as ID exists
      const commitElement = page.locator(`#commit-${expectedSha}`);
      const exists = await commitElement.count() > 0;

      log('INFO', 'Checking for deployed commit', {
        attempt: i + 1,
        maxRetries,
        expectedSha,
        found: exists
      });

      if (exists) {
        log('INFO', 'Correct commit is deployed', { expectedSha });
        return;
      }

      if (i < maxRetries - 1) {
        log('INFO', 'Waiting before retry', { delaySeconds: retryDelayMs / 1000 });
        await page.waitForTimeout(retryDelayMs);
      }
    } catch (error) {
      log('WARN', 'Attempt failed', {
        attempt: i + 1,
        error: error instanceof Error ? error.message : String(error)
      });
      if (i < maxRetries - 1) {
        await page.waitForTimeout(retryDelayMs);
      }
    }
  }

  log('ERROR', 'Timeout waiting for commit', { expectedSha, maxRetries });
  throw new Error(`Timeout: Commit ${expectedSha} was not deployed after ${maxRetries} attempts`);
}

/**
 * Verify the deployed commit matches what we expect
 */
async function verifyCommitSha(page: Page): Promise<void> {
  if (EXPECTED_COMMIT_SHA) {
    try {
      const commitElement = page.locator(`#commit-${EXPECTED_COMMIT_SHA}`);
      const count = await commitElement.count();
      if (count > 0) {
        log('INFO', 'Commit SHA verified', { commitSha: EXPECTED_COMMIT_SHA });
      } else {
        log('WARN', 'Expected commit element not found', { commitSha: EXPECTED_COMMIT_SHA });
        // Don't fail the test, just warn
      }
    } catch (error) {
      log('WARN', 'Failed to verify commit SHA', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't fail the test, just warn
    }
  } else {
    log('INFO', 'No expected commit SHA provided, skipping verification');
  }
}

test.describe('Photo Upload E2E', () => {
  test.beforeEach(async ({ page }) => {
    // If testing deployed site and we have an expected commit, wait for it
    if (TEST_DEPLOYED_SITE && EXPECTED_COMMIT_SHA) {
      log('INFO', 'Testing deployed site', { url: DEPLOYED_SITE_URL });
      await waitForCorrectCommit(page, EXPECTED_COMMIT_SHA);
    } else {
      log('INFO', 'Testing local preview');
      // Normal navigation for local tests
      await page.goto('/', { waitUntil: 'networkidle' });
    }
  });

  test('should load app and show upload form', async ({ page }) => {
    log('INFO', 'Starting test: load app and show upload form');

    // Verify we're testing the correct commit
    await verifyCommitSha(page);

    // Verify the app loaded correctly
    await expect(page.locator('h1')).toContainText('PongPush', { timeout: 10000 });

    // Verify upload form elements are present
    await expect(page.locator('input[type="file"]#photoInput')).toBeAttached();
    await expect(page.locator('button[type="submit"]')).toBeAttached();
    await expect(page.locator('text=Spielbericht hochladen')).toBeVisible();

    log('INFO', 'Test passed: app loaded successfully with upload form');
  });

  test('should have file input that accepts images', async ({ page }) => {
    log('INFO', 'Starting test: file input accepts images');

    // Verify commit
    await verifyCommitSha(page);

    const fileInput = page.locator('input[type="file"]#photoInput');
    await expect(fileInput).toBeAttached();

    // Check that it accepts images
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('image');

    log('INFO', 'Test passed: file input configured correctly', { accept: acceptAttr });
  });

  test('should be mobile responsive', async ({ page }) => {
    log('INFO', 'Starting test: mobile responsive');

    // Verify commit
    await verifyCommitSha(page);

    // Check viewport meta tag exists
    const viewport = await page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);

    // Check key UI elements are visible/attached
    await expect(page.locator('h1')).toBeVisible();
    // File input is hidden by CSS (custom styling), check if attached instead
    await expect(page.locator('input[type="file"]')).toBeAttached();

    log('INFO', 'Test passed: mobile responsive checks completed');
  });
});
