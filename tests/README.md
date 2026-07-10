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

### 1. **Story Service Tests** (`story-service.test.mjs`)

**Tests**: 8 test categories, 50+ individual assertions

#### What's Tested:

1. **Basic Story Generation**
   - Result structure validation
   - Required fields present
   - Word count accuracy (±20% tolerance)
   - HTML formatting
   - Metadata tracking

2. **All Creature Types**
   - Vampire stories
   - Werewolf stories
   - Fairy stories
   - Creature type preservation

3. **All Spicy Levels (1-5)**
   - Each spice level generates correctly
   - Level preservation in output
   - Content appropriateness

4. **Word Count Variations**
   - 700-word stories
   - 900-word stories
   - 1200-word stories
   - Accuracy within tolerance

5. **Chapter Continuation**
   - Initial story generation
   - Chapter 2 generation
   - Chapter number tracking
   - Content continuity

6. **Input Validation**
   - Invalid creature rejection
   - Invalid spicy level rejection
   - Empty themes rejection
   - Proper error codes

7. **Speaker Tags (Multi-Voice)**
   - Speaker tag detection
   - Unique speaker counting
   - rawContent field presence
   - Multi-voice readiness

8. **Logging Integration**
   - Log capture working
   - Request IDs present
   - Performance logs present
   - Info logs present

#### How to Run:
```bash
node tests/story-service.test.mjs
```

---

## Running All Tests

### Option 1: Test Runner Script
```bash
node tests/run-all.mjs
```

Runs all test suites sequentially with summary.

### Option 2: NPM Script (Recommended)
```bash
npm test
```

### Option 3: Individual Tests
```bash
# Story tests only
node tests/story-service.test.mjs
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

1. **Import Errors**
   ```
   Error: Cannot find module
   ```
   **Fix**: Ensure you're using `.mjs` extension and ES6 imports

2. **Timeout Errors**
   ```
   Request timeout after 45000ms
   ```
   **Fix**: Check API keys, increase timeout, or verify network

3. **Module Resolution**
   ```
   ERR_MODULE_NOT_FOUND
   ```
   **Fix**: Use relative paths `../api/lib/services/...`

4. **TypeScript Errors**
   ```
   SyntaxError: Unexpected identifier
   ```
   **Fix**: Tests use `.mjs` (JavaScript), not `.ts` (TypeScript)

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
node tests/story-service.test.mjs

# Story-Lab privacy/security/job contract surface
npm run test:story-lab-privacy-contracts

# With debugging
NODE_ENV=development node tests/story-service.test.mjs
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
