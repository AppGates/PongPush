import { test, expect, Page } from '@playwright/test';

// Configuration from environment variables
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA;
const TEST_DEPLOYED_SITE = process.env.TEST_DEPLOYED_SITE === 'true';
const DEPLOYED_SITE_URL = process.env.DEPLOYED_SITE_URL || 'https://appgates.github.io/PongPush/';

/**
 * Wait for the correct commit version to be deployed
 * This ensures we test the page that matches the commit we're testing
 */
async function waitForCorrectCommit(page: Page, expectedSha: string, maxRetries = 30, retryDelayMs = 10000): Promise<void> {
  console.log(`🔍 Waiting for commit ${expectedSha} to be deployed...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

      const appRoot = page.locator('#app-root');
      const deployedCommit = await appRoot.getAttribute('data-commit-sha');

      console.log(`Attempt ${i + 1}/${maxRetries}: Deployed commit is ${deployedCommit}`);

      if (deployedCommit === expectedSha) {
        console.log(`✅ Correct commit ${expectedSha} is deployed!`);
        return;
      }

      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting ${retryDelayMs / 1000}s before retry...`);
        await page.waitForTimeout(retryDelayMs);
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i < maxRetries - 1) {
        await page.waitForTimeout(retryDelayMs);
      }
    }
  }

  throw new Error(`Timeout: Commit ${expectedSha} was not deployed after ${maxRetries} attempts`);
}

/**
 * Verify the deployed commit matches what we expect
 */
async function verifyCommitSha(page: Page): Promise<void> {
  const appRoot = page.locator('#app-root');
  await expect(appRoot).toBeAttached();

  const deployedCommit = await appRoot.getAttribute('data-commit-sha');
  console.log(`📍 Deployed commit: ${deployedCommit}`);

  if (EXPECTED_COMMIT_SHA) {
    expect(deployedCommit).toBe(EXPECTED_COMMIT_SHA);
    console.log(`✅ Commit SHA verified: ${deployedCommit}`);
  } else {
    console.log(`ℹ️  No expected commit SHA provided, current: ${deployedCommit}`);
  }
}

test.describe('Photo Upload E2E', () => {
  test.beforeEach(async ({ page }) => {
    // If testing deployed site and we have an expected commit, wait for it
    if (TEST_DEPLOYED_SITE && EXPECTED_COMMIT_SHA) {
      console.log(`🌐 Testing deployed site: ${DEPLOYED_SITE_URL}`);
      await waitForCorrectCommit(page, EXPECTED_COMMIT_SHA);
    } else {
      // Normal navigation for local tests
      await page.goto('/', { waitUntil: 'networkidle' });
    }
  });

  test('should load app and show upload form', async ({ page }) => {
    // Verify we're testing the correct commit
    await verifyCommitSha(page);

    // Verify the app loaded correctly
    await expect(page.locator('h1')).toContainText('PongPush', { timeout: 10000 });

    // Verify upload form elements are present
    await expect(page.locator('input[type="file"]#photoInput')).toBeAttached();
    await expect(page.locator('button[type="submit"]')).toBeAttached();
    await expect(page.locator('text=Spielbericht hochladen')).toBeVisible();

    console.log('✅ App loaded successfully with upload form');
  });

  test('should have file input that accepts images', async ({ page }) => {
    // Verify commit
    await verifyCommitSha(page);

    const fileInput = page.locator('input[type="file"]#photoInput');
    await expect(fileInput).toBeAttached();

    // Check that it accepts images
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('image');

    console.log('✅ File input configured correctly');
  });

  test('should be mobile responsive', async ({ page }) => {
    // Verify commit
    await verifyCommitSha(page);

    // Check viewport meta tag exists
    const viewport = await page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);

    // Check key UI elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });
});
