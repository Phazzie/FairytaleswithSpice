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
  at least 16 characters (`API_KEY_MINIMUM_LENGTH`). An entry that does not
  qualify is refused rather than trusted, so a placeholder, a truncated paste,
  or a value that kept its shell quoting cannot become a live credential for a
  paid route. Padding is measured out of the length deliberately: it is a
  base64 length artefact, not secret, and counting it would let
  `a===============` clear a sixteen-character floor
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
   `b64token` grammar and carry at least 16 characters of token body (padding
   excluded); generate them, do not type them (`openssl rand -hex 24`). Entries
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

**Location:** `api/_lib/middleware/security.ts` (`checkRateLimit`), applied through the same `enforceApiAccessControl` guard as authentication.

**Features:**
- Per-user, per-endpoint rate limiting
- Configurable limits and time windows
- In-memory storage (easily replaceable with Redis for production)
- Automatic cleanup of expired entries
- Returns remaining quota and reset time
- Applies even when `API_KEYS` is unset: every unauthenticated caller
  collapses onto the same `development_user` id, so `checkRateLimit` still
  gives them one *shared* budget per endpoint rather than unlimited access

**Setup:**

`enforceApiAccessControl` (see the Authentication section above) already
authenticates the request and checks its rate limit together, sets the
`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers,
and answers `429` (with `Retry-After`) when the budget is spent — a handler does
not call `checkRateLimit` directly.

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

**Production Upgrade (Redis):**
```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimitRedis(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
) {
  const key = `ratelimit:${userId}:${endpoint}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }
  
  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetTime: Date.now() + windowMs
  };
}
```

**Testing:**
- 7 comprehensive tests in `security.spec.ts`
- Tests cover: within limit, exceed limit, multiple users, multiple endpoints, time window reset

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Set `API_KEYS` environment variable with secure keys — until this is set, every route stays in fail-open development mode (see the Notes below). Each entry must clear the credential contract (`b64token` grammar, ≥ 16 characters of token body excluding padding); a value that does not is refused, and a deployment whose entries all fail — or which sets `API_KEYS` to whitespace or bare commas — returns 401 `API_KEY_CONFIGURATION_INVALID` to everything rather than reverting to development mode
- [x] Test authentication with valid and invalid keys — `tests/api-key-auth.test.ts`, `tests/api-access-control.test.ts`
- [x] Test rate limiting with automated requests — `tests/api-access-control.test.ts`
- [ ] Update frontend to send an API key once `API_KEYS` is configured (it currently sends none, which relies on the fail-open path)
- [ ] Configure CORS to whitelist only production domains
- [ ] Consider upgrading rate limiting to Redis for distributed systems
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

6. **Rejected `API_KEYS` entries.** An entry whose token body is shorter than `API_KEY_MINIMUM_LENGTH` (16) or which does not match the `b64token` grammar (`A-Z a-z 0-9 . _ ~ + / -`, then optional trailing `=` padding) cannot authenticate a request. If some entries qualify, the deployment runs on those and logs a warning naming how many were refused and why. If none qualify, every request is refused with 401 `API_KEY_CONFIGURATION_INVALID` and an error is logged. Both reports count the rejected entries rather than printing them: a refused entry is still whatever the operator believed was a credential, and the logger's own redaction does not recognise an arbitrary short string as one.

2. **Rate Limiting Storage**: Current implementation uses in-memory storage suitable for single-instance deployments. For production with multiple instances, upgrade to Redis. It applies regardless of whether `API_KEYS` is set — an unconfigured deployment's unauthenticated callers still share one budget per endpoint.

3. **Input Sanitization**: Sanitization is applied at the service layer, providing defense-in-depth even if API handlers are bypassed.

4. **User Feedback**: Error messages are designed to be informative without leaking sensitive information about the system.

5. **The app's own frontend does not send an API key today.** Setting `API_KEYS` without also updating the frontend to send one would 401 every real user — see the checklist item above.

7. **What `redactBearerTokens` treats as a credential.** `bearer` is both the RFC 6750 scheme keyword and an ordinary English noun, and in a dark-fantasy story generator the noun reaches the logger constantly — a bearer of a seal, an oath, or bad news, inside a prompt, a story excerpt or an error message. The run after the keyword is redacted when **either** the keyword is carried by an authorization header — an auth field name (`authorization`, `x-api-key`, `token`, `access_token`, … ), then `:` or `=`, then the scheme, ignoring whitespace, quotes and the backslashes that escape them, so that `Authorization: Bearer x`, `Authorization=Bearer x`, `{"authorization": "Bearer x"}` and an already-escaped payload such as `payload="{\"authorization\":\"Bearer x\"}"` all match. A descriptive label is read too — `Invalid Authorization header: Bearer x` — by looking back exactly one word past `header`/`headers`, which is bounded on purpose: an unbounded scan for a field name anywhere before the separator would destroy `The authorization ceremony: Bearer of the seal` — **or** the run is credential-shaped. Neither test is sufficient alone and both directions are asserted — a header position catches a credential short and alphabetic enough to pass for a word, and the shape test catches one written bare into a sentence.

   **Credential-shaped** means one of two things. Either the run is not word-shaped — a word being letters joined by interior single hyphens **or slashes**, so a digit, `_`, `.`, `+`, `=`, or a leading, trailing or doubled joiner all settle it — which holds at *any* length (both joiners are allowed inside a word because `re-entered` and `self-appointed`, then `and/or` and `his/her`, are prose rather than credentials; the slash was missed when the hyphen was added and a later review found it) and is the arm that catches every provider token this app holds (`xai-…` and `sk_…` carry `-` or `_`; a Clerk session token is a JWT and carries `.`). Or it is purely alphabetic and at least 16 characters, that floor being `API_KEY_MINIMUM_LENGTH` itself, so that what a deployment may configure as a credential and what the logger hides as one are a single number. An eight-character floor was tried first and destroyed the common verbs — `announced`, `delivered`, `whispered`, `returned` — that follow the noun in story prose.

   **The run stops before the sentence does.** `.` is a `b64token` character, so the scan that reads the run after the keyword took the full stop with it, and every ordinary sentence ending on the word after the noun was credential-shaped on that one character — `the bearer returned.` lost `returned` *and* the mark that ended the line. A trailing run of dots is given back to the sentence before the run is classified, and back to the log line after: `sent Bearer abc123def456. Then it failed` redacts the credential and keeps the full stop, and `Authorization: Bearer abcdef.` does the same. Only `.`, and only trailing — an interior dot is what makes `ab.cd` and a JWT's three parts credentials at any length, and `abcdef/`, `abcdef-` and base64's `=` padding are credentials that really do end in a `b64token` mark. This cannot expose credential material, since what is handed back is a run of dots; it widens the residual below by exactly one shape, in that `Bearer secret.` keeps `secret` just as `Bearer secret` does. It is the same trade `redactUrls` already makes, where a comma or a full stop after a link belongs to the sentence rather than to the link.

   **The field name is what makes the header arm mean anything**, and it was added after two rounds of getting this wrong in the same direction. A punctuation mark alone is not a header: what this app logs is story content, so `>` (HTML), `"` and `'` (dialogue), `(` and `[` sit before an ordinary capitalized noun far more often than before a credential — and even `:` and `=` do, in `Title: Bearer of the seal`, `Chapter 3: Bearer of the Oath` and `role=bearer of bad news`, which are a story title, a generated chapter heading and ordinary structured prose. Requiring the field name is what separates "a header carried this" from "a punctuation mark preceded this", and it is why quotes can now be skipped safely: `He said: "Bearer of the seal"` reaches the label `said` and is left alone. `tests/log-redaction.test.ts` asserts `BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH === API_KEY_MINIMUM_LENGTH` — an equality between the two constants rather than against a literal, because the invariant is that they are the same number and not that the number is 16 — so the two floors cannot drift apart: lowering Note 6's contract without lowering this would make a configurable key a value the logger reads as prose.

   **A serialized header value is read as one span.** A repeated header is a `string[]` in this repository's own request contracts, so `{"authorization":["Bearer a","Bearer b"]}` reaching a text field is a real shape, and so is the joined spelling `{"authorization":"Bearer a, Bearer b"}`. Either defeats the header arm from the second credential onwards: the walk back from the scheme reaches the `,` between elements rather than the field's `:`. The field context belongs to the whole value rather than to any one element, so it is established once — the same field-name gate, applied to the field's separator instead of to the scheme — and everything inside the value inherits it, whatever position it sits in. An array and a quoted string are the same rule, not two. The *structured* form never reaches this function at all: `SENSITIVE_KEY_PATTERNS` blanks an `authorization` key wholesale, array value included, before any text redaction runs. A value left unterminated by a truncated log is read to the end of the string, which is the fail-closed direction.

   **How the value's end is found, and why it took eleven rounds.** Each time a payload is embedded in a string, every delimiter gains a backslash and every literal quote gains more: at depth 0 a delimiter is `"`, at depth 1 it is `\"`, at depth 2 it is `\\\"` — and a literal quote *inside* an element at depth 1 is spelled `\\\"` too, identical to a depth-2 delimiter. Earlier versions guessed the depth by trying every reading the text admitted and comparing the ends, and review found five separate ways for the comparison to pick the wrong one: twice a credential in the clear, three times the sentence *after* the value rewritten, which is the defect this whole arm exists to avoid. The depth is now read rather than guessed, off the quote that wraps the **field name** — `"authorization":` is depth 0, `\"authorization\":` is depth 1, an unquoted `Authorization:` is depth 0 because nothing has been escaped. The name and the value it introduces were written by the same serializer, so one fact about the text settles one reading, and there is no candidate set to choose wrongly from. A quote whose backslash count does not match the field name's is not this serialization's delimiter and opens no span at all, so a malformed line cannot start one that runs to the end of the log.

   **What the value span costs.** Inside a value whose field name is an authorization field, `bearer` is header data rather than prose, so the word after it is redacted wherever in the value it sits: `token: "the bearer announced victory"` loses `announced`. That is the same trade the array form has always made, now stated for both. It is bounded by the same gate — the field name must be one of the credential fields, and the value must actually be serialized as an array or a quoted string, so `token: the bearer announced victory` unquoted, `{"storyText":"the bearer announced victory"}` and `Title: "the bearer announced victory"` are all untouched.

   **Known gaps, bounded and deliberate.** Beyond the residual below, the header arm does not match a free-prose label longer than one qualifier word (`Invalid Authorization request header:`). It was raised in review and deliberately not patched: the space of natural-language labels is unbounded, and four rounds of enumerating it argued for stopping rather than continuing. An array is not that case and is fixed rather than documented — `[`, `,` and `]` are closed grammar, and the gate that reads them is the existing one rather than a new list of words. The label gap is not reachable with a credential this app can produce, for the same reason as the residual.

   **The length rule cuts both ways, and both ends are deliberate.** Below the floor, a word-shaped run with no auth field name before it is preserved, so `request failed with Bearer secret` keeps `secret` — the residual. A run joined by a single interior hyphen or slash is word-shaped too, so the residual covers those spellings at the same lengths: `sent Bearer abc/def upstream` keeps `abc/def`, exactly as `sent Bearer abc-def upstream` keeps `abc-def`. Both are bounded the same way as the plain-letters case and by the same two facts — Note 6's contract means no configured `API_KEYS` entry can be that short, and every provider token this app holds carries a digit, `_` or `.` and is caught on shape at any length. A joiner at the edge or doubled is still a credential, so `/abcdef`, `ab//cd` and `abcdef/` are redacted, as are `-abcdef`, `ab--cd` and `abcdef-`. Above it, an ordinary long word *is* redacted, so `the bearer enthusiastically accepted the seal` loses `enthusiastically` (16 letters), as do `uncharacteristically` and `incomprehensible`. These are the same impossibility from opposite ends: a word and a credential of the same shape are the same string, and no threshold separates them — raising the floor from 8 to 16 moved the boundary rather than removing the mechanism. The fail-closed direction was chosen at both ends.

   **A lever the owner may want to pull.** The setup instructions above tell operators to *generate* keys (`openssl rand -hex 24`), and hex output carries digits, so a correctly-configured key is caught by the non-letter clause at any length and never needs the length rule. That rule earns its place only against a key typed by hand, in letters, against the documented instruction. If generated keys were *required* rather than recommended, the alphabetic length rule could be dropped entirely and the long-word damage above would disappear permanently. That is a posture change to an auth-adjacent contract, so it is recorded here as a decision rather than taken. This is the trade #314 documents: no rule can both spare the noun and hide such a run, because they are the same string. It is bounded by the contract above (no configured entry can be that shape) and by every provider token carrying a non-letter, but it is an assumption about credential shapes rather than a proof, and it is why the auth-side contract in Note 6 had to land first. Separately, the scheme must be followed by whitespace to be read at all, so the query-string form `?auth=1&bearer=xyz` is not redacted; a full URL is redacted whole by `redactUrls`, a bare fragment is not.

## 🔗 Related Files

- Security Primitives: `api/_lib/middleware/security.ts`
- Access Control Guard (auth + rate limit, wired into every route): `api/_lib/middleware/apiAccessControl.ts`
- Primitive Tests: `tests/api-key-auth.test.ts`
- Route Wiring Tests: `tests/api-access-control.test.ts`
- Input Validation: `api/_lib/services/storyService.ts` (lines 1150-1227)
- Rate Limit Constants: `api/_lib/constants.ts`
- Contracts: `api/_lib/types/contracts.ts`

## 🎯 Next Steps

1. Update the frontend to send an API key once `API_KEYS` is configured for a deployment
2. Set up monitoring for security events
3. Consider implementing request logging for audit trails
4. Plan for API key rotation strategy
5. Consider upgrading rate limiting to Redis for multi-instance deployments
