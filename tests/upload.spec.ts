import { test, expect } from '@playwright/test';

test.describe('Photo Upload E2E', () => {
  test('should load app and show upload form', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle' });

    // 2. Verify the app loaded correctly
    await expect(page.locator('h1')).toContainText('PongPush', { timeout: 10000 });

    // 3. Verify upload form elements are present
    await expect(page.locator('input[type="file"]#photoInput')).toBeAttached();
    await expect(page.locator('button[type="submit"]')).toBeAttached();
    await expect(page.locator('text=Spielbericht hochladen')).toBeVisible();

    console.log('✅ App loaded successfully with upload form');
  });

  test('should have file input that accepts images', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]#photoInput');
    await expect(fileInput).toBeAttached();

    // Check that it accepts images
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('image');

    console.log('✅ File input configured correctly');
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
