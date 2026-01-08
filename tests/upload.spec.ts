import { test, expect } from '@playwright/test';
import path from 'path';

const PIPELINE_REPO_OWNER = 'AppGates';
const PIPELINE_REPO_NAME = 'PongPush.Pipeline';

test.describe('Photo Upload E2E', () => {
  test('should upload photo and verify it appears in PongPush.Pipeline repository', async ({ page }) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const testFilename = `playwright-test-${timestamp}.jpg`;

    // 1. Navigate to the app
    await page.goto('/');

    // 2. Verify the app loaded correctly
    await expect(page.locator('h1')).toContainText('PongPush');

    // 3. Check if GitHub token is configured
    const tokenWarning = page.locator('text=/GitHub token nicht konfiguriert|token.*nicht.*gefunden/i');
    const hasToken = !(await tokenWarning.isVisible().catch(() => false));

    if (!hasToken) {
      test.skip('GitHub token not configured - skipping upload test');
      return;
    }

    // 4. Upload the test image
    const fileInputSelector = 'input[type="file"]#photoInput';
    await expect(page.locator(fileInputSelector)).toBeVisible();

    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
    await page.locator(fileInputSelector).setInputFiles(testImagePath);

    // 5. Wait for upload to complete
    // Look for success message or upload completion indicator
    const successIndicator = page.locator('text=/erfolgreich|success|uploaded/i');
    await expect(successIndicator).toBeVisible({ timeout: 30000 });

    // 6. Verify the file was uploaded to PongPush.Pipeline repo
    // Use GitHub API to check if file exists
    const githubApiUrl = `https://api.github.com/repos/${PIPELINE_REPO_OWNER}/${PIPELINE_REPO_NAME}/contents/uploads`;

    // Wait a bit for GitHub to process the file
    await page.waitForTimeout(5000);

    // Fetch the uploads directory
    const response = await page.request.get(githubApiUrl);
    expect(response.ok()).toBeTruthy();

    const files = await response.json();

    // Check if our test file is in the uploads directory
    const uploadedFile = Array.isArray(files)
      ? files.find((file: any) => file.name.startsWith('playwright-test-'))
      : null;

    expect(uploadedFile).toBeTruthy();
    console.log(`✅ File uploaded successfully: ${uploadedFile?.name}`);

    // 7. Optional: Clean up - delete the test file
    // Note: This requires the token to have delete permissions
    // We'll skip cleanup to avoid permission issues
  });

  test('should show error when GitHub token is missing', async ({ page }) => {
    // This test assumes we're running locally without token
    await page.goto('/');

    // Look for token warning message
    const tokenWarning = page.locator('text=/GitHub token nicht konfiguriert|token.*nicht.*gefunden/i');

    // If token is configured, skip this test
    if (!(await tokenWarning.isVisible().catch(() => false))) {
      test.skip('GitHub token is configured - skipping token error test');
      return;
    }

    await expect(tokenWarning).toBeVisible();
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.goto('/');

    // Check viewport meta tag exists
    const viewport = await page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);

    // Check key UI elements are visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });
});
