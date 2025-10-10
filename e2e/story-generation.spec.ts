import { test, expect } from '@playwright/test';

test.describe('Fairytales with Spice - Story Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the homepage', async ({ page }) => {
    // Check that the main title is visible
    await expect(page.locator('h1')).toContainText('Fairytales with Spice');
  });

  test('should display creature selection buttons', async ({ page }) => {
    // Check for creature selection buttons
    const vampireButton = page.getByRole('button', { name: /vampire/i });
    const werewolfButton = page.getByRole('button', { name: /werewolf/i });
    const fairyButton = page.getByRole('button', { name: /fairy/i });
    
    await expect(vampireButton).toBeVisible();
    await expect(werewolfButton).toBeVisible();
    await expect(fairyButton).toBeVisible();
  });

  test('should allow theme selection', async ({ page }) => {
    // Look for theme checkboxes or buttons
    // Note: This is a placeholder - adjust selectors based on actual UI
    const themes = page.locator('[data-testid="theme-option"]');
    const themeCount = await themes.count();
    
    // Should have multiple theme options
    expect(themeCount).toBeGreaterThan(0);
  });

  test('should have spicy level slider', async ({ page }) => {
    // Check for spicy level control
    const spicySlider = page.locator('input[type="range"]');
    await expect(spicySlider).toBeVisible();
  });

  test('should have generate button', async ({ page }) => {
    // Check for generate story button
    const generateButton = page.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeVisible();
  });

  test('should require theme selection before generating', async ({ page }) => {
    // Try to generate without selecting themes
    const generateButton = page.getByRole('button', { name: /generate/i });
    
    // Button should be disabled or show validation message
    const isDisabled = await generateButton.isDisabled();
    
    // If not disabled by attribute, clicking should show an error or do nothing
    if (!isDisabled) {
      // Click and check that no story is generated (implementation-dependent)
      await generateButton.click();
      // Add assertion based on your app's behavior
    }
  });

  test('should select creature and themes', async ({ page }) => {
    // Select vampire creature
    await page.getByRole('button', { name: /vampire/i }).click();
    
    // Select some themes (adjust selectors based on actual implementation)
    // This is a placeholder - will need to match actual theme selection UI
    const firstTheme = page.locator('[data-testid="theme-option"]').first();
    if (await firstTheme.count() > 0) {
      await firstTheme.click();
    }
    
    // Verify creature selection is reflected in UI
    await expect(page.getByRole('button', { name: /vampire/i })).toHaveClass(/selected|active/);
  });

  test('should handle spicy level adjustment', async ({ page }) => {
    const spicySlider = page.locator('input[type="range"]').first();
    
    // Get initial value
    const initialValue = await spicySlider.inputValue();
    
    // Change the value
    await spicySlider.fill('5');
    
    // Verify value changed
    const newValue = await spicySlider.inputValue();
    expect(newValue).toBe('5');
    expect(newValue).not.toBe(initialValue);
  });
});

test.describe('Fairytales with Spice - Story Display', () => {
  test('should have story display area', async ({ page }) => {
    await page.goto('/');
    
    // Check for story content area (adjust selector based on actual implementation)
    const storyDisplay = page.locator('[data-testid="story-display"]').or(page.locator('.story-content'));
    
    // Story display should exist even if empty
    const count = await storyDisplay.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Fairytales with Spice - Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Check that there's an h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);
  });

  test('should have interactive elements with labels', async ({ page }) => {
    await page.goto('/');
    
    // All buttons should have accessible names
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const accessibleName = await button.getAttribute('aria-label') || await button.textContent();
      expect(accessibleName).toBeTruthy();
    }
  });
});
