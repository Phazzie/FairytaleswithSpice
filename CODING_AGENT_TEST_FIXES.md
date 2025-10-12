# Coding Agent Task: Fix Test Failures and Code Quality Issues

**Created:** 2025-10-12 07:40  
**Status:** Ready for Coding Agent  
**Priority:** Medium (Technical Debt, Not Blocking Features)

## 🎯 Mission

Fix 5 async timing test failures and reduce code duplication from 5.7% to ≤3% to pass SonarCloud quality gate.

## 📊 Current State

**PR #66 was successfully merged** ✅ with the following known issues:

### Test Results
- **Total Tests:** 108
- **Passing:** 102 (94.4%)
- **Failing:** 6 (5.6%)

### Quality Checks
- ❌ **SonarCloud Code Quality:** 5.7% duplication (requires ≤ 3%)
- ❌ **Vercel:** Deployment issue (investigate)
- ✅ **Build:** All builds passing
- ✅ **TypeScript:** No errors

## 🔧 Task 1: Fix 5 Async Timing Test Failures

### Problem
These tests are **correctly written** but fail due to Jasmine async/await timing issues in headless Chrome environments.

### Failing Tests

Located in: `story-generator/src/app/story.service.spec.ts` and `story-generator/src/app/streaming-story/streaming-story.component.spec.ts`

1. **`should handle successful completion`**
   - Issue: EventSource async lifecycle not properly awaited
   - Fix: Add proper `fakeAsync` or increase timeout

2. **`should handle errors during streaming`**
   - Issue: Error event timing race condition
   - Fix: Use `flush()` or `tick()` with proper delays

3. **`should build correct SSE URL with query parameters`**
   - Issue: Observable subscription timing
   - Fix: Ensure spy verification happens after async completion

4. **`should log streaming lifecycle events`**
   - Issue: Logger spy not capturing events in time
   - Fix: Add `await` or use `done()` callback properly

5. **`should detect question mark ending with "but" pattern`**
   - Issue: Helper method test timing (likely unrelated to async but grouped with failures)
   - Fix: Verify test isolation and mock setup

### Recommended Solutions

#### Option A: Increase Jasmine Timeout (Quick Fix)
```typescript
// In karma.conf.js
jasmine: {
  random: false,
  seed: null,
  stopSpecOnExpectationFailure: false,
  timeoutInterval: 10000 // Increase from default 5000ms
}
```

#### Option B: Fix Individual Tests (Better)
```typescript
// Example fix for EventSource async tests
it('should handle successful completion', fakeAsync(() => {
  // Test code...
  tick(100); // Allow EventSource events to process
  flush(); // Clear any pending timers
  expect(result).toBeDefined();
}));

// Or use done() callback
it('should handle errors during streaming', (done) => {
  service.generateStoryStreaming(params).subscribe({
    error: (err) => {
      expect(err).toBeDefined();
      done(); // Signal test completion
    }
  });
  
  // Trigger error event
  mockEventSource.onerror({ type: 'error' } as Event);
});
```

#### Option C: Mock EventSource Properly
```typescript
// Ensure EventSource mock allows synchronous control
class MockEventSource {
  private listeners: Map<string, Function[]> = new Map();
  
  addEventListener(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }
  
  // Add method to synchronously trigger events in tests
  triggerEvent(event: string, data: any) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h({ data: JSON.stringify(data) }));
  }
}
```

## 🔧 Task 2: Reduce Code Duplication (5.7% → ≤3%)

### Problem
SonarCloud detected duplicate code patterns exceeding the 3% threshold.

### Investigation Steps

1. **Run SonarCloud analysis locally** (if possible):
   ```bash
   # Check SonarCloud report for specific duplicate blocks
   # URL: https://sonarcloud.io/dashboard?id=Phazzie_FairytaleswithSpice&pullRequest=66
   ```

2. **Common duplication sources to check:**
   - Test setup code (beforeEach blocks)
   - Mock data creation
   - API call patterns
   - Error handling blocks
   - Type definitions duplicated across files

### Likely Duplications

Based on PR #66 changes:

#### A. Test Mock Setup (HIGHLY LIKELY)
**Files:** 
- `story-generator/src/app/story.service.spec.ts`
- `story-generator/src/app/streaming-story/streaming-story.component.spec.ts`

**Duplication Pattern:**
```typescript
// Likely duplicated in multiple test files
beforeEach(() => {
  mockEventSource = {
    addEventListener: jasmine.createSpy('addEventListener'),
    close: jasmine.createSpy('close'),
    readyState: 0
  };
  
  spyOn(window, 'EventSource').and.returnValue(mockEventSource as any);
});
```

**Fix:** Extract to shared test helper:
```typescript
// story-generator/src/testing/event-source-mock.ts
export function createMockEventSource() {
  return {
    addEventListener: jasmine.createSpy('addEventListener'),
    close: jasmine.createSpy('close'),
    readyState: 0,
    url: '',
    withCredentials: false,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
  };
}

export function setupEventSourceMock(): jasmine.Spy {
  const mockEventSource = createMockEventSource();
  return spyOn(window, 'EventSource').and.returnValue(mockEventSource as any);
}
```

#### B. Test Data Factories (LIKELY)
**Duplication Pattern:**
```typescript
// Repeated in multiple tests
const mockParams = {
  creature: 'vampire' as CreatureType,
  themes: ['romance'] as ThemeType[],
  userInput: 'test input',
  spicyLevel: 3 as SpicyLevel,
  wordCount: 900 as WordCount
};
```

**Fix:** Create test data factory:
```typescript
// story-generator/src/testing/test-data-factory.ts
export const TestDataFactory = {
  createStoryParams(overrides = {}): StoryGenerationParams {
    return {
      creature: 'vampire' as CreatureType,
      themes: ['romance'] as ThemeType[],
      userInput: 'test input',
      spicyLevel: 3 as SpicyLevel,
      wordCount: 900 as WordCount,
      ...overrides
    };
  },
  
  createProgressChunk(overrides = {}): StreamingProgressChunk {
    return {
      event: 'chunk',
      content: 'Test content',
      metadata: {
        wordsGenerated: 100,
        generationSpeed: 15.5,
        percentComplete: 50,
        estimatedTimeRemaining: 10
      },
      ...overrides
    };
  }
};
```

#### C. Error Handling Patterns (POSSIBLE)
**Duplication Pattern:**
```typescript
// Similar error handling in multiple methods
.catch(error => {
  console.error('Error in generateStory:', error);
  return {
    success: false,
    error: {
      code: 'GENERATION_FAILED',
      message: error.message || 'Unknown error'
    }
  };
})
```

**Fix:** Extract to error handler utility (if not already done in seam contracts).

### Refactoring Strategy

1. **Create testing utilities folder:**
   ```
   story-generator/src/testing/
   ├── event-source-mock.ts
   ├── test-data-factory.ts
   └── index.ts
   ```

2. **Extract shared test setup code**
3. **Replace duplicated blocks with imports**
4. **Run SonarCloud again to verify < 3%**

## 🔧 Task 3: Investigate Vercel Deployment Issue

### Steps
1. Check Vercel deployment logs
2. Verify build configuration
3. Ensure environment variables are set
4. Test production build locally:
   ```bash
   cd story-generator
   npm run build --configuration production
   ```

## 📋 Acceptance Criteria

### Test Fixes
- [ ] All 5 async timing tests pass consistently
- [ ] No new test failures introduced
- [ ] Tests run in < 30 seconds
- [ ] Tests pass in CI/CD environment (GitHub Actions)

### Code Quality
- [ ] SonarCloud duplication ≤ 3%
- [ ] No new code smells introduced
- [ ] Maintainability rating stays A
- [ ] Test coverage remains ≥ 94%

### Deployment
- [ ] Vercel deployment succeeds
- [ ] Production build completes without errors
- [ ] Application loads and functions in production

## 🛠️ Implementation Guide

### Step 1: Fix Tests Locally
```bash
cd /workspaces/FairytaleswithSpice/story-generator

# Install dependencies if needed
npm install

# Run tests (if Chrome available)
npm test

# Or run specific test file
npm test -- --include='**/story.service.spec.ts'
```

### Step 2: Refactor Duplicated Code
1. Review SonarCloud report for exact duplicate locations
2. Create shared utilities in `/testing` folder
3. Update tests to use shared utilities
4. Run tests to ensure no regression

### Step 3: Verify Quality Gates
```bash
# Run full build
cd story-generator
npm run build

# If SonarQube scanner available locally
sonar-scanner
```

### Step 4: Create Pull Request
```bash
git checkout -b fix/test-timing-and-code-quality
git add .
git commit -m "Fix async test timing issues and reduce code duplication

- Add fakeAsync/flush to async EventSource tests
- Extract shared test utilities to reduce duplication
- Create test data factory for consistent mock data
- Update karma.conf.js timeout settings
- Verify all tests pass and code quality improves

Fixes: Async timing issues from PR #66
SonarCloud: Reduces duplication from 5.7% to <3%"

git push origin fix/test-timing-and-code-quality
gh pr create --title "Fix test timing issues and code duplication" \
  --body "Addresses technical debt from PR #66 merge"
```

## 📚 Reference Documentation

- **Jasmine Async Testing:** https://jasmine.github.io/tutorials/async
- **Angular Testing Guide:** https://angular.io/guide/testing
- **SonarCloud Rules:** https://rules.sonarsource.com/typescript/
- **Test Coverage Analysis:** `/TEST_COVERAGE_ANALYSIS.md`
- **Streaming Implementation:** `/STREAMING_IMPLEMENTATION.md`

## 🎯 Priority Order

1. **HIGH:** Fix async test timing (impacts CI/CD reliability)
2. **MEDIUM:** Reduce code duplication (impacts code quality metrics)
3. **LOW:** Investigate Vercel deployment (may auto-resolve with fixes)

## 💡 Tips for Success

- Run tests frequently while making changes
- Fix one test at a time, verify it passes before moving on
- Keep commits small and focused
- Use `git stash` to try different approaches
- Check SonarCloud feedback after each significant change

## ❓ Pre-existing Issue (Don't Fix)

**DebugPanel test failure** - This existed before PR #66 and should be addressed separately.

---

**Ready to start?** Use this document as your guide. You have all the context needed! 🚀
