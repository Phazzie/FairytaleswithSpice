# E2E Tests with Playwright

This directory contains end-to-end tests for the Fairytales with Spice application using Playwright.

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm run install:all

# Install Playwright browsers (first time only)
npx playwright install
```

### Run Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run unit tests
npm run test:unit
```

## Test Structure

- `story-generation.spec.ts` - Tests for story generation workflow
  - Homepage loading
  - Creature selection
  - Theme selection
  - Spicy level adjustment
  - Story generation button
  - Accessibility checks

## Writing New Tests

When adding new E2E tests:

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Use `data-testid` attributes in the UI for stable selectors
3. Group related tests using `test.describe()`
4. Use `test.beforeEach()` for common setup
5. Follow the Page Object Model pattern for complex flows

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

## CI/CD Integration

The Playwright configuration (`playwright.config.ts`) is set up to:
- Run tests in parallel locally
- Run tests serially in CI
- Retry failed tests in CI
- Generate HTML reports
- Take screenshots on failure
- Automatically start dev server

## Debugging

```bash
# Run with Playwright Inspector
npx playwright test --debug

# Run specific test file
npx playwright test e2e/story-generation.spec.ts

# Run specific test
npx playwright test -g "should load the homepage"

# View last test report
npx playwright show-report
```

## Browser Coverage

Tests run on:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

## Best Practices

1. **Use semantic locators**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for elements**: Playwright auto-waits, but use `await expect()` for assertions
3. **Keep tests independent**: Each test should work standalone
4. **Use data-testid sparingly**: Prefer accessible selectors first
5. **Test real user flows**: Focus on end-to-end scenarios, not implementation details
