# 🧪 Test Suite Documentation

## Overview

Comprehensive test suite for **Fairytales with Spice** that validates core services independent of HTTP/networking layers.

## Test Structure

### ✅ Service-Level Tests (Direct Testing)

These tests interact directly with service classes, bypassing HTTP endpoints. This isolates business logic from networking issues.

**Benefits:**
- ✅ Fast execution (no HTTP overhead)
- ✅ Isolates service logic from transport layer
- ✅ Tests work without running servers
- ✅ Better error messages and debugging
- ✅ Can test internal methods and edge cases

---

## Test Suites

### 1. **Story Service Tests** (`story-service-improved.test.ts`)

Direct service behaviour: generation result shape, word-count tolerance, chapter
continuation, input validation, speaker tags, and logging integration.

```bash
npm run test:story
```

Its siblings cover the prompt surface the same service builds:

```bash
npm run test:story-service-prompt-guards
npm run test:xai-fast-path-review
npm run test:verify-ai-fixes
```

---

## Running All Tests

Every suite is an `npm run test:*` script, and `npm test` runs all of them in
order. There is no separate runner script: the list in `package.json` is the
list, so a suite that is not named there does not run.

### Option 1: NPM Script (Recommended)
```bash
npm test
```

### Option 2: Individual Tests
```bash
# Story tests only
npm run test:story
```

---

## Test Output

### Success Output:
```
🧪 TEST: Basic Story Generation - Vampire Romance
────────────────────────────────────────────────────────────────────────────────
ℹ️  Duration: 2341ms (2.34s)
✅ Result is not null/undefined
✅ Result is an object
✅ Result has success property
✅ Story has valid storyId: story_1633824567_abc123
✅ Story has valid title: "Moonlit Desires"
✅ Story has content (4532 chars)
✅ Story has word count: 723
✅ Word count within tolerance: 723 (target: 700, ±140)
✅ Content contains HTML formatting
✅ Metadata has requestId: req_1633824567_def456
```

### Failure Output:
```
❌ Story generation failed: AI service temporarily unavailable
ℹ️  Error details: Request timeout after 45000ms
```

---

## Environment Setup

### Required:
- Node.js 20+ (ES modules support)
- Installed dependencies: `npm install`

### Optional (for real API testing):
```bash
# .env file
XAI_API_KEY=your_grok_api_key
```

**Note**: Tests work in **mock mode** without API keys!

---

## Test Configuration

### Mock vs Real API

**Mock Mode** (no API keys):
- Uses generated mock data
- Instant responses
- No external dependencies
- Perfect for CI/CD

**Real API Mode** (with API keys):
- Calls actual Grok AI
- Calls actual ElevenLabs
- Tests real integration
- Costs API credits

### Adjusting Test Behavior

Edit test files to:
- Change tolerance levels
- Add/remove test cases
- Modify assertions
- Test edge cases

---

## Continuous Integration

### GitHub Actions Example:
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

---

## Troubleshooting

### Common Issues:

1. **Timeout Errors**
   ```
   Request timeout after 45000ms
   ```
   **Fix**: Check API keys, increase timeout, or verify network

2. **Module Resolution**
   ```
   ERR_MODULE_NOT_FOUND
   ```
   **Fix**: Import the TypeScript source by its extensionless relative path
   (`../api/_lib/services/storyService`) and run the suite through `tsx`, as the
   `npm run test:*` scripts do. A plain `node` run of a `.mjs` test resolves
   `../api/_lib/services/storyService.js` literally, and no such file exists —
   the sources are `.ts` and are never compiled to disk.

3. **A new test never runs**
   ```
   (no output, no failure)
   ```
   **Fix**: Add it to `package.json` as its own `test:*` script *and* append it
   to `test:all`. Nothing globs the `tests/` directory, so a file that is not
   named in `test:all` is never executed by `npm test` or by CI.

---

## Test Metrics

### Current Test Surface:
- **Story Service**: direct service behavior and prompt-generation contracts
- **Story Lab**: state, route status, auth/config, storage ports, cloud schema/readiness, profile/account routes, job contracts, and privacy/security contract checks
- **Coverage status**: root/API tests are runtime contract tests and are not currently instrumented for line/branch coverage percentages

### Performance Benchmarks:
- Story Generation: < 5s (with real API)
- Audio Conversion: < 3s (with real API)
- Mock Mode: < 100ms per test
- Full Suite: < 5min (real API), < 30s (mock)

---

## Future Enhancements

### Planned Additions:
- [ ] Integration tests (HTTP endpoint testing)
- [ ] Load testing (concurrent requests)
- [ ] Stress testing (resource limits)
- [ ] Security testing (input sanitization)
- [ ] Performance profiling
- [ ] Code coverage reports
- [ ] Mutation testing

---

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Test both success and failure** paths
3. **Validate all fields** in responses
4. **Check edge cases** (empty, null, invalid)
5. **Add logging verification**
6. **Update this README**

---

## Quick Reference

### Test Commands:
```bash
# All tests
npm test

# Story tests only
npm run test:story

# Story-Lab privacy/security/job contract surface
npm run test:story-lab-privacy-contracts

# With debugging
NODE_ENV=development npm run test:story
```

### Story Lab Privacy/Security Command Map

- `npm run test:story-lab-privacy-contracts`: executes `tests/cors-policy.test.ts`, `tests/export-sanitizer.test.ts`, `tests/log-redaction.test.ts`, `tests/story-lab-stream-parse.test.ts`, `tests/story-service-streaming-security.test.ts`, `tests/story-lab-job-contracts.test.ts` in this order.
- Included in `test:all`: yes.
- This command set is not coverage/instrumentation; it is a focused runtime contract suite for omitted tests.

### Expected Results:
- ✅ **All tests pass** in mock mode
- ✅ **90%+ tests pass** with real APIs
- ⚠️  **Warnings** for tolerance issues (acceptable)
- ❌ **Failures** indicate bugs or API issues

---

**Status**: Active contract test suite; root/API coverage percentages are not instrumented yet

Last Updated: July 10, 2026
