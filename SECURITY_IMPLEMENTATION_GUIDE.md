# 🔒 Security Implementation Guide

This guide documents the security enhancements implemented to address vulnerabilities identified in the security audit.

## 📋 Overview

The following critical security vulnerabilities have been addressed:

1. ✅ **Prompt Injection Sanitization** - Prevents malicious AI prompt manipulation
2. ✅ **Comprehensive Input Validation** - Validates all user inputs against defined rules
3. ✅ **API Authentication** - Secures endpoints with API key validation
4. ✅ **Rate Limiting** - Prevents abuse and API quota exhaustion

## 🛡️ Security Features

### 1. Prompt Injection Prevention

**Location:** `api/_lib/services/storyService.ts` (line 1189+)

**How it works:**
- Sanitizes user input using whitelist approach
- Removes special characters that could manipulate AI prompts
- Truncates input to maximum allowed length
- Validates semantic correctness (must contain alphanumeric characters)
- Implements rate limiting on failed sanitization attempts

**Example:**
```typescript
private sanitizeUserInput(input: string, userId?: string): string {
  if (!input) return '';
  
  // Whitelist: allow only letters, numbers, basic punctuation, and spaces
  const whitelistPattern = /[^a-zA-Z0-9 .,!?'"()-]/g;
  let sanitized = input.replace(whitelistPattern, '');
  
  // Ensure length limit
  sanitized = sanitized.slice(0, VALIDATION_RULES.userInput.maxLength);
  
  return sanitized.trim();
}
```

**Testing:**
- 5 comprehensive tests in `storyService.security.spec.ts`
- Tests cover: special characters, injection patterns, length limits, empty input, valid punctuation

### 2. Input Validation

**Location:** `api/_lib/services/storyService.ts` (line 1150+)

**Validates:**
- ✅ Creature type: Must be 'vampire', 'werewolf', or 'fairy'
- ✅ Themes: Must be array with 1-5 items
- ✅ Spicy level: Must be number between 1-5
- ✅ Word count: Must be number between 150-2000
- ✅ User input: Max 1000 characters

**Example:**
```typescript
private validateStoryInput(input: StoryGenerationSeam['input']): any {
  if (!input.creature || !['vampire', 'werewolf', 'fairy'].includes(input.creature)) {
    return {
      code: 'INVALID_INPUT',
      message: 'Invalid creature type',
      field: 'creature'
    };
  }
  // ... more validations
}
```

**Testing:**
- 10 comprehensive tests in `storyService.security.spec.ts`
- Tests cover: all field validations, type checking, boundary conditions

### 3. API Authentication

**Location:** `api/_lib/middleware/security.ts` (`authenticateRequest`, `checkRateLimit`), wired into every route through `api/_lib/middleware/apiAccessControl.ts` (`enforceApiAccessControl`).

**Features:**
- API key validation via X-API-Key header or Authorization Bearer token
- Environment variable configuration (`API_KEYS`)
- A credential contract on each configured entry: it must match RFC 6750's
  `b64token` grammar — a body of `A-Z a-z 0-9 . _ ~ + / -` followed only by
  optional trailing `=` padding — and its body, excluding that padding, must be
  at least 16 characters (`API_KEY_MINIMUM_LENGTH`), drawn from at least 5
  different characters (`API_KEY_MINIMUM_DISTINCT_CHARACTERS`). An entry that
  does not qualify is refused rather than trusted, so a *short* placeholder
  (`test`, `changeme`), a truncated paste, a value that kept its shell quoting,
  or a *degenerate* one (`kkkkkkkkkkkkkkkk`) cannot become a live credential for
  a paid route. Padding is measured out of both the length and the variety
  deliberately: it is a base64 length artefact, not secret, and counting it
  would let `a===============` clear a sixteen-character floor
- **The three rules are well-formedness, size and variety. None of them is an
  entropy test, and a key that clears all three can still be a bad one.** The
  variety rule refuses degenerate *repetition*; it does not refuse a weak
  *choice*. `changemechangeme` carries seven distinct characters and
  **authenticates**, and `tests/api-key-auth.test.ts` asserts that it does, so
  the residual is pinned rather than implied. Catching it would need a word
  list — unbounded, and it cannot be made to terminate — or a floor high enough
  to start refusing genuinely generated keys: at eight distinct characters a
  legitimate sixteen-character hex key is refused about two percent of the
  time. Five is set where it provably cannot refuse a key from the generator
  this guide recommends (for a 16-character hex key the false-refusal rate is
  bounded by ≈ 4 × 10⁻⁷; for the 48-character `openssl rand -hex 24` it is far
  smaller). So the contract refuses what is *malformed, too short, or
  degenerate*, and the operator remains responsible for the value being secret.
  Closing the rest means **issuing** credentials rather than validating
  operator-chosen ones — see issue #321. This is why the setup step below says
  to generate keys rather than type them (`openssl rand -hex 24`), which is the
  only
  measure that actually closes this gap
- Whitespace *around* an entry belongs to the comma-separated list rather than
  to the entry (`key-one, key-two`), so it is stripped before the entry is
  validated. A newline *inside* an entry is part of the entry and is refused
- Development mode fallback (when no keys configured) — this checks whether
  any keys are configured *before* requiring the caller to have sent one, so
  a request with no key at all is allowed through when `API_KEYS` is unset,
  not just a request that happened to send some key anyway
- **Unconfigured and misconfigured are different answers.** If `API_KEYS` is
  set but *every* entry fails the contract, the deployment fails closed —
  it refuses every request with `API_KEY_CONFIGURATION_INVALID` rather than
  falling back to the development mode above. Collapsing the two would turn
  one typo into an app serving every caller as `development_user`. The same
  applies to a value that holds no entry at all: `API_KEYS=" "` (a secret
  substitution that produced nothing) or `API_KEYS=","` fails closed. Only an
  absent variable and the empty string `API_KEYS=` count as unconfigured
- Per-key user ID mapping
- Wired into every route that spends money on the xAI/Grok API or handles a
  resource-costing request: `api/story/generate.ts`, `api/story/continue.ts`,
  `api/image/generate.ts`, `api/export/save.ts`, `api/story-lab/evaluate.ts`,
  `api/story-lab/stories.ts`, `api/story-lab/stories/[storyId]/continue.ts`,
  and both handlers in `api/_lib/story-lab/jobs/jobRouteHandlers.ts` (job
  creation and the job event stream) — on both the Vercel serverless and the
  Node/Docker deployments, since both serve the same handler functions
  (`api/_lib/http/expressApiRoutes.ts`).
- The route a browser reaches through `EventSource`
  (`story-lab/jobs/:jobId/events`) also accepts the key as an `apiKey` query
  parameter, since `EventSource` cannot set custom headers
  (`withEventStreamAuth` in `apiAccessControl.ts`).

**Setup:**

1. Set environment variable. Each comma-separated entry must match the
   `b64token` grammar, carry at least 16 characters of token body (padding
   excluded), and draw that body from at least 5 different characters;
   generate them, do not type them (`openssl rand -hex 24`). Entries
   that fail the contract are refused, and a deployment whose entries *all*
   fail — or which sets `API_KEYS` to something holding no entry — refuses
   every request:
```bash
API_KEYS=sk-live-9f3c2a71b40e,sk-live-2d81ff60ac95
```

2. Call the shared guard at the start of a handler, right after its CORS and
   method checks and before it does any paid work:
```typescript
import { enforceApiAccessControl } from '../_lib/middleware/apiAccessControl';
import { RATE_LIMITS } from '../_lib/constants';

export default async function handler(req: any, res: any) {
  const access = await enforceApiAccessControl(req, res, 'story/generate', RATE_LIMITS.STORY_GENERATION);
  if (!access.allowed) {
    return; // enforceApiAccessControl has already written the 401 or 429 response
  }

  // ... rest of handler, using access.userId if needed
}
```

3. Client usage:
```typescript
// Option 1: X-API-Key header
fetch('/api/story/generate', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(storyInput)
});

// Option 2: Authorization header
fetch('/api/story/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(storyInput)
});
```

**Testing:**
- 6 comprehensive tests in `security.spec.ts`
- Tests cover: missing key, valid key, invalid key, development mode, both header types

### 4. Rate Limiting

**Location:** `api/_lib/middleware/rateLimitStorePort.ts` (the `RateLimitStore` seam), applied through the same `enforceApiAccessControl` guard as authentication.

**Features:**
- Per-user, per-endpoint rate limiting
- Configurable limits and time windows
- Two interchangeable stores behind one `RateLimitStore` port:
  - `InMemoryRateLimitStore` (`api/_lib/middleware/inMemoryRateLimitStore.ts`, wrapping `checkRateLimit` in `security.ts`) — process-local, the default (`RATE_LIMIT_STORE` unset or `memory`). Correct for a single instance; **not** correct once more than one instance of this app is warm at once, since each instance starts with its own empty counter.
  - `PostgresRateLimitStore` (`api/_lib/middleware/postgresRateLimitStore.ts`) — a shared counter in the same Postgres/Neon database the durable Story Lab stores already use, selected with `RATE_LIMIT_STORE=postgres` once `DATABASE_URL` is set. One atomic `INSERT ... ON CONFLICT ... DO UPDATE` per request; see the file for why that single statement is safe under concurrent instances without an explicit lock.
  - Selected by `api/_lib/middleware/rateLimitStoreConfig.ts`, mirroring how `storyLabJobStoreConfig.ts` selects the Story Lab job store. The production default stays `memory` in this revision — flipping it to `postgres` is a separate, deliberately gated step, the same convention `STORY_LAB_JOB_STORE` follows.
- Automatic cleanup of expired entries (in-memory store only; the Postgres store's rows are small, keyed by `(user_id, endpoint)`, and simply get overwritten on the next window)
- Returns remaining quota and reset time
- Applies even when `API_KEYS` is unset: every unauthenticated caller
  collapses onto the same `development_user` id, so the configured store still
  gives them one *shared* budget per endpoint rather than unlimited access

**Setup:**

`enforceApiAccessControl` (see the Authentication section above) already
authenticates the request and checks its rate limit together, sets the
`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers,
and answers `429` (with `Retry-After`) when the budget is spent, or `503`
if a deployment has opted into `RATE_LIMIT_STORE=postgres` without a working
`DATABASE_URL` — a handler never calls a rate-limit store directly.

`X-RateLimit-Reset` carries a **UTC epoch in seconds**, which is the form every
client that knows the header name reads it in. `checkRateLimit` works in
milliseconds internally and `error.resetTime` in the 429 body still reports
milliseconds — that field is this API's own, not a standard header.

Limits (from `api/_lib/constants.ts`):
```typescript
RATE_LIMITS = {
  STORY_GENERATION: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  CHAPTER_CONTINUATION: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  IMAGE_GENERATION: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  EXPORT: { maxRequests: 20, windowMs: 15 * 60 * 1000 },
  STREAMING: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  STORY_LAB_GENESIS: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  STORY_LAB_CONTINUATION: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  STORY_LAB_JOB_CREATE: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  STORY_LAB_EVALUATE: { maxRequests: 20, windowMs: 15 * 60 * 1000 }
}
```

**Multi-Instance Deployments (implemented, opt-in):**

Set `RATE_LIMIT_STORE=postgres` and `DATABASE_URL` to move rate limiting off
the process-local `Map` and onto the shared `rate_limit_buckets` table
(`storyLabCloudSchema.sql`), applied the same way the other durable Story Lab
tables are (`scripts/recovery/apply-story-lab-cloud-schema.ts`). No new
infrastructure (e.g. Redis) is required — it reuses the Postgres/Neon
connection this app already provisions for durable jobs, profiles, and
projects. See `api/_lib/middleware/postgresRateLimitStore.ts` for the store
itself.

Before enabling `RATE_LIMIT_STORE=postgres` in a real deployment, run
`DATABASE_URL=... npm run smoke:rate-limit-store-concurrency` against that
database. Unlike the unit tests below (which drive the algorithm through a
JavaScript simulation of Postgres), this fires genuinely concurrent
`consume()` calls from two independent store instances at the real database
and proves the shared budget holds — the actual claim this feature exists to
make.

**Testing:**
- `tests/rate-limit-store.test.ts` — `InMemoryRateLimitStore` (unchanged `checkRateLimit` behavior through the port) and `PostgresRateLimitStore` (SQL wiring, window reset/increment/deny transitions, unconfigured fail-closed)
- `tests/rate-limit-store-config.test.ts` — mode selection (`memory` default, explicit `postgres`, unknown mode fails closed), mirroring `tests/story-lab-job-store-config.test.ts`
- `tests/api-access-control.test.ts` — route wiring, including the `503` when `RATE_LIMIT_STORE=postgres` is misconfigured
- `npm run smoke:rate-limit-store-concurrency` (`DATABASE_URL`-gated, not part of `test:all`) — the real-Postgres concurrency proof described above

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Set `API_KEYS` environment variable with secure keys — until this is set, every route stays in fail-open development mode (see the Notes below). Each entry must clear the credential contract (`b64token` grammar, ≥ 16 characters of token body excluding padding); a value that does not is refused, and a deployment whose entries all fail — or which sets `API_KEYS` to whitespace or bare commas — returns 401 `API_KEY_CONFIGURATION_INVALID` to everything rather than reverting to development mode
- [x] Test authentication with valid and invalid keys — `tests/api-key-auth.test.ts`, `tests/api-access-control.test.ts`
- [x] Test rate limiting with automated requests — `tests/api-access-control.test.ts`
- [ ] Update frontend to send an API key once `API_KEYS` is configured (it currently sends none, which relies on the fail-open path)
- [ ] Configure CORS to whitelist only production domains
- [ ] For multi-instance deployments, set `RATE_LIMIT_STORE=postgres` (with `DATABASE_URL`) so the rate-limit budget is shared across instances instead of per-process
- [ ] Monitor failed authentication attempts
- [ ] Set up alerts for rate limit violations
- [ ] Document API key management process for users

## 📊 Test Coverage

- `tests/api-key-auth.test.ts` — the primitives themselves: header parsing, casing, Bearer stripping, constant-time comparison, user id derivation, the fail-open path with and without a caller-supplied key, the configured-key credential contract (minimum length and its boundary, credential alphabet, a rejected entry alongside a usable one), the fail-closed path when no configured entry qualifies, and that a rejected entry's value never reaches the log
- `tests/api-access-control.test.ts` — every wired route: missing key → 401, wrong key → 401, valid key passes, rate limit exceeded → 429, the fail-open path with no `API_KEYS` configured, the shared rate-limit bucket that path still enforces, and the `EventSource` query-parameter fallback on the two streaming routes

## 🔍 Security Audit Status

| Vulnerability | Severity | Status |
|--------------|----------|--------|
| Prompt Injection | CRITICAL | ✅ Fixed |
| Input Validation | HIGH | ✅ Fixed |
| API Authentication | CRITICAL | ✅ Implemented and wired into every route |
| Rate Limiting | HIGH | ✅ Implemented and wired into every route |

## 📝 Notes

1. **Development Mode**: When `API_KEYS` is not set, authentication allows all requests for development convenience — this now applies to a request that sends no key at all, not only to one that happens to send some key anyway (the fix in this revision; see `authenticateRequest` in `security.ts`). Always set `API_KEYS` in production if you want the key check enforced. Note that "not set" means *no usable entry was configured at all*: a value that is set but entirely unusable is a misconfiguration, and reaches the fail-closed branch instead (Note 6).

6. **Rejected `API_KEYS` entries.** An entry cannot authenticate a request if its token body is shorter than `API_KEY_MINIMUM_LENGTH` (16), if it does not match the `b64token` grammar (`A-Z a-z 0-9 . _ ~ + / -`, then optional trailing `=` padding), or if that body draws on fewer than `API_KEY_MINIMUM_DISTINCT_CHARACTERS` (5) different characters. The three reasons are counted separately in the log, because "too short" would be false for `kkkkkkkkkkkkkkkk` and would send the operator to lengthen a key that is already long enough. If some entries qualify, the deployment runs on those and logs a warning naming how many were refused and why. If none qualify, every request is refused with 401 `API_KEY_CONFIGURATION_INVALID` and an error is logged. Both reports count the rejected entries rather than printing them: a refused entry is still whatever the operator believed was a credential, and the logger's own redaction does not recognise an arbitrary short string as one.

2. **Rate Limiting Storage**: The default (`RATE_LIMIT_STORE` unset or `memory`) is in-memory storage, suitable for single-instance deployments only. For production with multiple instances, set `RATE_LIMIT_STORE=postgres` (with `DATABASE_URL` configured) — no Redis needed, it shares the Postgres/Neon connection this app already uses for durable Story Lab storage. It applies regardless of whether `API_KEYS` is set — an unconfigured deployment's unauthenticated callers still share one budget per endpoint.

3. **Input Sanitization**: Sanitization is applied at the service layer, providing defense-in-depth even if API handlers are bypassed.

4. **User Feedback**: Error messages are designed to be informative without leaking sensitive information about the system.

5. **The app's own frontend does not send an API key today.** Setting `API_KEYS` without also updating the frontend to send one would 401 every real user — see the checklist item above.

## 🔗 Related Files

- Security Primitives: `api/_lib/middleware/security.ts`
- Access Control Guard (auth + rate limit, wired into every route): `api/_lib/middleware/apiAccessControl.ts`
- Rate Limit Store Port: `api/_lib/middleware/rateLimitStorePort.ts`
- Rate Limit Store Selection: `api/_lib/middleware/rateLimitStoreConfig.ts`
- Postgres Rate Limit Store: `api/_lib/middleware/postgresRateLimitStore.ts`
- Primitive Tests: `tests/api-key-auth.test.ts`
- Rate Limit Store Tests: `tests/rate-limit-store.test.ts`, `tests/rate-limit-store-config.test.ts`
- Route Wiring Tests: `tests/api-access-control.test.ts`
- Input Validation: `api/_lib/services/storyService.ts` (lines 1150-1227)
- Rate Limit Constants: `api/_lib/constants.ts`
- Contracts: `api/_lib/types/contracts.ts`

## 🎯 Next Steps

1. Update the frontend to send an API key once `API_KEYS` is configured for a deployment
2. Set up monitoring for security events
3. Consider implementing request logging for audit trails
4. Plan for API key rotation strategy
5. Validate `RATE_LIMIT_STORE=postgres` against a live database, then consider flipping the deployment's default away from `memory` (a separate, gated step — see `STORY_LAB_JOB_STORE`'s own rollout for the precedent)
