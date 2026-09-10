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
- `tests/log-redaction.test.ts` — what reaches a log line: bearer credentials in header, JSON and bare positions, the prose that uses `bearer` as an ordinary noun, the boundary between the two (Note 7), plus API keys, email addresses and URLs

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

7. **What `redactBearerTokens` treats as a credential.** `bearer` is both the RFC 6750 scheme keyword and an ordinary English noun, and in a dark-fantasy story generator the noun reaches the logger constantly — a bearer of a seal, an oath, or bad news, inside a prompt, a story excerpt or an error message. The run after the keyword is redacted when **either** the keyword is carried by an authorization header — an auth field name (`authorization`, `x-api-key`, `token`, `access_token`, … ), then `:` or `=`, then the scheme, ignoring whitespace, quotes and the backslashes that escape them, so that `Authorization: Bearer x`, `Authorization=Bearer x`, `{"authorization": "Bearer x"}` and an already-escaped payload such as `payload="{\"authorization\":\"Bearer x\"}"` all match. A descriptive label is read too — `Invalid Authorization header: Bearer x` — by looking back exactly one word past `header`/`headers`, which is bounded on purpose: an unbounded scan for a field name anywhere before the separator would destroy `The authorization ceremony: Bearer of the seal` — **or** the run is credential-shaped. Neither test is sufficient alone and both directions are asserted — a header position catches a credential short and alphabetic enough to pass for a word, and the shape test catches one written bare into a sentence.

   **Credential-shaped** means one of two things. Either the run is not word-shaped — a word being letters joined by interior single hyphens **or slashes**, so a digit, `_`, `.`, `+`, `=`, or a leading, trailing or doubled joiner all settle it — which holds at *any* length (both joiners are allowed inside a word because `re-entered` and `self-appointed`, then `and/or` and `his/her`, are prose rather than credentials; the slash was missed when the hyphen was added and a later review found it) and is the arm that catches every provider token this app holds (`xai-…` and `sk_…` carry `-` or `_`; a Clerk session token is a JWT and carries `.`). Or it is purely alphabetic and at least 16 characters, that floor being `API_KEY_MINIMUM_LENGTH` itself, so that what a deployment may configure as a credential and what the logger hides as one are a single number. An eight-character floor was tried first and destroyed the common verbs — `announced`, `delivered`, `whispered`, `returned` — that follow the noun in story prose.

   **Punctuation is not shape, and the shape question is asked of the word rather than of the run.** Several `b64token` characters are also marks that prose puts *around* a word: `.` ends a sentence, and Markdown wraps emphasis in `_` and `~`. Reading them as part of the run made ordinary prose credential-shaped on one character — `the bearer returned.` lost `returned` and the mark that ended the line, and `the bearer _returned_ to court`, `__of__` and `~~returned~~` went the same way, in a module that is handed story content for a living. So the shape test is applied to the word *body*: the run with a trailing run of dots removed, and with one balanced pair of emphasis marks removed. Only balanced — `_abcdef` keeps its leading underscore and stays a credential exactly as `-abcdef` does, `sk_live_abcdef` wears its underscores inside, `-abcdef-` is not emphasis because Markdown does not emphasize with hyphens, and an interior dot is what makes `ab.cd` and a JWT's three parts credentials at any length. What the body drops is emitted again only *below the floor*: `sent Bearer abc123def456. Then it failed` redacts the credential and keeps the full stop, the trade `redactUrls` already makes for a link.

   **How much of the run the redaction consumes is a second question, and asking only the first printed a credential beside its own `[REDACTED]`.** `a...............` is one letter and fifteen stops — a sixteen-character body `API_KEY_CREDENTIAL_GRAMMAR` accepts, so a deployment can configure it — and because its *body* is the single letter `a`, the stops were handed back to the sentence as punctuation: `Bearer [REDACTED]...............`, fifteen of the key's sixteen characters in the log. The rule is now the floor on both questions. At or above `API_KEY_MINIMUM_LENGTH` the whole run is consumed, stops included, because that is exactly the band in which a run could be a configured credential and nothing distinguishes its trailing `.` from a full stop; the sentence loses a mark rather than the log keeping a key. Below the floor the stops are the sentence's, and nothing given back there could have been configured, so it falls in the residual band this note already documents. A run of *nothing but* marks is consumed at any length, since it has no word to punctuate.

   **The length, though, is measured on the whole run, and that is what keeps the arm fail-closed.** `API_KEY_CREDENTIAL_GRAMMAR` counts `.`, `_` and `~` inside a token body, so `abcdefghijklmno.` — fifteen letters and a stop — is a sixteen-character body that `authenticateRequest` accepts. Trimming those marks out of the *length* as well as the shape logged exactly that value in the clear. Measuring the untrimmed run gives this arm one flat guarantee that no trimming can reach past: **every run of `API_KEY_MINIMUM_LENGTH` characters or more is redacted, whatever its shape** — so no configured credential can survive it, and the residual below is exactly the band under that floor. That sentence was written before it was true: a run of *nothing but* marks was returned before either arm was asked, and sixteen periods is a key the grammar accepts, so `Authorization: Bearer ................` was logged in the clear. Such a run now has no word to take a shape from, so only its length speaks — an ellipsis after the noun stays prose, a run at the floor is a credential — and when it is redacted the marks are consumed rather than handed back, since printing them beside their own `[REDACTED]` would put the value back on the line it was removed from. The cost of the guarantee is at the same boundary the residual already names: a prose word long enough to reach the floor *with* its punctuation is redacted, so `enthusiastically` is joined by a fifteen-letter word ending a sentence.

   **The field name is what makes the header arm mean anything**, and it was added after two rounds of getting this wrong in the same direction. A punctuation mark alone is not a header: what this app logs is story content, so `>` (HTML), `"` and `'` (dialogue), `(` and `[` sit before an ordinary capitalized noun far more often than before a credential — and even `:` and `=` do, in `Title: Bearer of the seal`, `Chapter 3: Bearer of the Oath` and `role=bearer of bad news`, which are a story title, a generated chapter heading and ordinary structured prose. Requiring the field name is what separates "a header carried this" from "a punctuation mark preceded this", and it is why quotes can now be skipped safely: `He said: "Bearer of the seal"` reaches the label `said` and is left alone. `tests/log-redaction.test.ts` asserts `BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH === API_KEY_MINIMUM_LENGTH` — an equality between the two constants rather than against a literal, because the invariant is that they are the same number and not that the number is 16 — so the two floors cannot drift apart: lowering Note 6's contract without lowering this would make a configurable key a value the logger reads as prose.

   **A value that has closed is not padding around the next one.** Whitespace, quotes and escaping backslashes between the separator and the scheme belong to the serialization, so the walk back skips them — but two quotes of the *same* character, separated by nothing but the backslashes that escape them, are an empty value that has already closed, and the walk stops there rather than reading through to the separator behind it. Without that, `authorization: "" Bearer of the seal` lost its `of` while `authorization: "abc" Bearer of the seal` did not, since a non-empty value stops the walk on its own characters; the two spellings of a closed value now stop it alike. Two *different* quotes side by side are a value quoted inside another (`authorization: "'Bearer abcdef'"`) and are still read through. **The backslashes matter because adjacency is only how an empty value is spelled at depth 0.** Embedded in a string the same value is `\"\"`, and at depth 2 `\\\"\\\"`; comparing each quote against the character immediately before it saw only padding there and walked through, so a fix that held for `authorization: "" Bearer of the seal` was live in no serialized log — `{"message":"authorization: \"\" Bearer of the seal"}` still lost its `of`. Whitespace between the pair does still separate it, so a value holding only spaces (`authorization: " " Bearer of the seal`) is not read as closed and the prose after it is redacted; that is unchanged behaviour rather than a decision this note is making, and it is over-redaction rather than a leak.

   **A scheme with no credential after it is a credential that was missing, not one being hidden.** `Authorization: Bearer` followed by nothing but a space, the same in a serialized value, and an empty array element all put the keyword in a genuine header position with nothing following it, and both arms fire on that context alone — so the line was rewritten to `Bearer [REDACTED]`, telling an operator debugging a *missing* credential that a secret had been supplied and withheld from them. That is this module's own defect in its other direction: asserting a credential where there was none. The empty run is now returned before either arm is consulted, since the arms answer "is this a credential position" and this asks the prior question of whether anything is there to be one. An empty element does not cost its neighbours their redaction. The cost is one band, and it is the band the residual already names: a credential written after a closed empty value, short and alphabetic enough to have no shape, is no longer reached by the header arm — anything with a shape still is, at any length.

   **A serialized header value is read as one span.** A repeated header is a `string[]` in this repository's own request contracts, so `{"authorization":["Bearer a","Bearer b"]}` reaching a text field is a real shape, and so is the joined spelling `{"authorization":"Bearer a, Bearer b"}`. Either defeats the header arm from the second credential onwards: the walk back from the scheme reaches the `,` between elements rather than the field's `:`. The field context belongs to the whole value rather than to any one element, so it is established once — the same field-name gate, applied to the field's separator instead of to the scheme — and everything inside the value inherits it, whatever position it sits in. An array and a quoted string are the same rule, not two. The *structured* form is replaced wholesale before text redaction: `SENSITIVE_KEY_PATTERNS` matches the `authorization` key and `redactValue` returns `[REDACTED]` for the whole value at that key — array value included — without traversing into it, so this arm never has to read one. A value left unterminated by a truncated log is read to the end of the string, which is the fail-closed direction.

   **How the value's end is found, and why it took eleven rounds.** Each time a payload is embedded in a string, every delimiter gains a backslash and every literal quote gains more: at depth 0 a delimiter is `"`, at depth 1 it is `\"`, at depth 2 it is `\\\"` — and a literal quote *inside* an element at depth 1 is spelled `\\\"` too, identical to a depth-2 delimiter. Earlier versions guessed the depth by trying every reading the text admitted and comparing the ends, and review found five separate ways for the comparison to pick the wrong one: twice a credential in the clear, three times the sentence *after* the value rewritten, which is the defect this whole arm exists to avoid. The depth is now read rather than guessed, off the quote that wraps the **field name** — `"authorization":` is depth 0, `\"authorization\":` is depth 1, an unquoted `Authorization:` is depth 0 because nothing has been escaped. The name and the value it introduces were written by the same serializer, so one fact about the text settles one reading, and there is no candidate set to choose wrongly from. A quote whose backslash count does not match the field name's is not this serialization's delimiter and opens no span at all, so a malformed line cannot start one that runs to the end of the log.

   **What the value span costs.** Inside a value whose field name is an authorization field, `bearer` is header data rather than prose, so the word after it is redacted wherever in the value it sits: `token: "the bearer announced victory"` loses `announced`. That is the same trade the array form has always made, now stated for both. It is bounded by the same gate — the field name must be one of the credential fields, and the value must actually be serialized as an array or a quoted string, so `token: the bearer announced victory` unquoted, `{"storyText":"the bearer announced victory"}` and `Title: "the bearer announced victory"` are all untouched.

   **A comma-joined list needs no serializer around it.** `Authorization: Bearer abcdef, Bearer ghijkl` is the form RFC 7230 gives a repeated header on the wire, and a diagnostic quotes it back with no quotes and no brackets at all. Keying the span on the opening `[` or `"` therefore hid the first credential and printed every later one in the clear, because the walk back from the second reaches the comma rather than the field — the same defeat the serialized forms have, without the delimiter that ends them. A bare value gets a span too, and what ends it is the repetition itself: the list continues only across a `,` that is followed by the scheme keyword again, so `Authorization: Bearer abcdef, and the bearer returned` ends at `abcdef` and keeps its sentence. Reading a bare value to the end of the line instead would put this arm's original defect back, since a provider's error text follows a credential with prose far more often than with a second credential. A single credential opens no span, because the backward walk already reaches it.

   **A bare list that does not open on `Bearer` is a residual.** `Authorization: Basic xyz, Bearer abcdef` keeps `abcdef`, where the same value inside quotes redacts it — the chain above is a chain of `Bearer` entries, so a different registered scheme in front of one ends it before it starts. Closing it means admitting the other IANA authentication schemes (`Basic`, `Digest`, `Negotiate`, …) as chain members, which is a closed registry rather than open-ended English and so is not the enumeration this module refuses elsewhere; it was left out because the reported defect is the `Bearer` chain and widening the rule is the owner's call. The exposure is bounded by Note 6's contract in the same way as the residual below: the leaked run must be short and word-shaped, which no configured `API_KEYS` entry and no provider token this app holds can be.

   **An auth field name written inside a story value is read as a field name.** `{"story":"The authorization: [the bearer returned] was ceremonial"}` loses `returned`, because the pass that finds serialized values sees a credential field name and a separator without knowing which value it is standing inside. Raised in review and deliberately not fixed, because the obvious fix reverses the direction that matters: refusing a separator that sits inside another value would also refuse `{"debug":"{\"authorization\":\"Bearer abcdef\"}"}` and `{"message":"upstream said Authorization: Bearer abcdef"}` — a credential nested in a non-credential field is the commonest shape a real error log takes, and both are redacted today. The gap costs over-redaction of one word inside prose that spells out an authorization label; closing it would cost credentials in the clear. It is pre-existing rather than introduced by this slice.

   **Known gaps, bounded and deliberate.** Beyond the residual below and the one above, the header arm does not match a free-prose label longer than one qualifier word (`Invalid Authorization request header:`). It was raised in review and deliberately not patched: the space of natural-language labels is unbounded, and four rounds of enumerating it argued for stopping rather than continuing. An array is not that case and is fixed rather than documented — `[`, `,` and `]` are closed grammar, and the gate that reads them is the existing one rather than a new list of words. The label gap is not reachable with a credential this app can produce, for the same reason as the residual.

   **The length rule cuts both ways, and both ends are deliberate.** Below the floor, a word-shaped run with no auth field name before it is preserved, so `request failed with Bearer secret` keeps `secret` — the residual. A run joined by a single interior hyphen or slash is word-shaped too, so the residual covers those spellings at the same lengths: `sent Bearer abc/def upstream` keeps `abc/def`, exactly as `sent Bearer abc-def upstream` keeps `abc-def`. Both are bounded the same way as the plain-letters case and by the same two facts — Note 6's contract means no configured `API_KEYS` entry can be that short, and every provider token this app holds carries a digit, `_` or `.` and is caught on shape at any length. A joiner at the edge or doubled is still a credential, so `/abcdef`, `ab//cd` and `abcdef/` are redacted, as are `-abcdef`, `ab--cd` and `abcdef-`. Above it, an ordinary long word *is* redacted, so `the bearer enthusiastically accepted the seal` loses `enthusiastically` (16 letters), as do `uncharacteristically` and `incomprehensible`. These are the same impossibility from opposite ends: a word and a credential of the same shape are the same string, and no threshold separates them — raising the floor from 8 to 16 moved the boundary rather than removing the mechanism. The fail-closed direction was chosen at both ends.

   **A lever the owner may want to pull.** The setup instructions above tell operators to *generate* keys (`openssl rand -hex 24`), and hex output carries digits, so a correctly-configured key is caught by the non-letter clause at any length and never needs the length rule. That rule earns its place only against a key typed by hand, in letters, against the documented instruction. If generated keys were *required* rather than recommended, the alphabetic length rule could be dropped entirely and the long-word damage above would disappear permanently. That is a posture change to an auth-adjacent contract, so it is recorded here as a decision rather than taken. This is the trade #314 documents: no rule can both spare the noun and hide such a run, because they are the same string. It is bounded by the contract above (no configured entry can be that shape) and by every provider token carrying a non-letter, but it is an assumption about credential shapes rather than a proof, and it is why the auth-side contract in Note 6 had to land first. Separately, the scheme must be followed by whitespace to be read at all, so the query-string form `?auth=1&bearer=xyz` is not redacted; a full URL is redacted whole by `redactUrls`, a bare fragment is not.

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
