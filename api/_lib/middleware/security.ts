/**
 * Authentication Middleware
 * 
 * Provides API key authentication for securing endpoints.
 * Usage: Add authenticateRequest() at the start of API handlers
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { logError, logWarn } from '../utils/logger';

export interface AuthenticatedRequest {
  userId?: string;
  apiKey?: string;
  method: string;
  headers: any;
  body: any;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/** The environment variable the configured keys are read from. */
const API_KEYS_ENVIRONMENT_VARIABLE = 'API_KEYS';

/**
 * The `endpoint` label every log entry about the key configuration carries.
 *
 * One declaration rather than a copy per call site: the four entries below are
 * meant to be filterable as one group by an operator reading the log, which a
 * typo in any one of them would silently break.
 */
const API_KEY_CONFIGURATION_LOG_ENDPOINT = 'authenticateRequest';

/**
 * The shortest `API_KEYS` entry that may be used as a credential.
 *
 * `API_KEYS` used to accept any non-empty entry: `abcdef`, `test`, `changeme`,
 * or the four characters left behind by a half-finished copy-paste all became
 * live credentials for every paid route in the app, and nothing said so. The
 * key is the sole authentication for routes that spend real money on the xAI
 * API, so the floor is set where an API key's floor usually is rather than at
 * the weakest value that is still technically a secret: sixteen characters of
 * {@link API_KEY_CREDENTIAL_GRAMMAR}'s alphabet is roughly ninety-five bits, and
 * the eight-character values a person actually types by hand are not. Measured
 * on the token body — see {@link credentialBodyOf}, since padding is not secret.
 *
 * Exported so a test can assert the boundary against the contract instead of
 * against a copy of the number, and so anything else that needs to reason about
 * what a credential can look like here reads it from one place. See #314: the
 * absence of any floor at all is why the log redactor cannot safely apply a
 * shape check to a bearer token, and closing this hole is what would make such
 * a check sound for *this app's own* keys.
 */
export const API_KEY_MINIMUM_LENGTH = 16;

/**
 * The shape an `API_KEYS` entry may take: RFC 6750's `b64token` grammar, which
 * is what a bearer credential is allowed to look like on the wire.
 *
 * Note that this is the *grammar*, not merely the alphabet. `=` is padding, and
 * padding is only ever trailing, after at least one character of actual token —
 * which is why the body and the padding are separate terms here rather than one
 * character class. Spelling it as a flat class was a real hole rather than a
 * pedantic one: `================` is sixteen characters drawn entirely from the
 * alphabet, so it satisfied a flat class *and* the length floor below while
 * carrying no credential at all, and it authenticated. See
 * {@link credentialBodyOf} for the other half of that repair.
 *
 * An entry carrying a quote, an interior newline, or a control character did not
 * come from a key generator — it came from a shell that kept the quoting or a
 * value pasted with its line ending. Refusing it by name is the difference
 * between an operator seeing why their key does not work and seeing only
 * unexplained 401s.
 *
 * One real behaviour change rather than a clarification: a passphrase-style
 * entry with an interior space (`correct horse battery staple`) was usable
 * through `X-API-Key` and is now refused. That is intended. Such a value cannot
 * be sent through the `Authorization: Bearer` scheme at all — a space ends the
 * credential — so it was only ever half a key, working on one of the two
 * documented transports and failing on the other for reasons nothing explained.
 *
 * What this does *not* govern is whitespace around an entry. `API_KEYS` is a
 * comma-separated list and `key-one, key-two` is the ordinary way to write one,
 * so the whitespace between a comma and an entry belongs to the *list*, not to
 * the entry: it is stripped before an entry reaches this grammar, and a value
 * configured as `sk-…-value\n` is the same credential as `sk-…-value`. That
 * matches {@link readHeader}, which trims a presented key for the same reason.
 */
const API_KEY_CREDENTIAL_GRAMMAR = /^[A-Za-z0-9._~+/-]+=*$/;

/**
 * The part of an entry that is credential rather than padding.
 *
 * The minimum length is a claim about how much *secret* a value carries, and
 * base64 padding is not secret — it is a length artefact, at most two characters
 * on a real token. Measuring the whole string let padding stand in for the
 * entropy the floor exists to require: `a===============` is sixteen characters
 * and one character of credential, and it cleared a floor set at sixteen.
 */
function credentialBodyOf(entry: string): string {
  return entry.replace(/=+$/, '');
}

/**
 * Whether `API_KEYS` says nothing at all, as opposed to saying something that
 * turns out to hold no key.
 *
 * The empty string counts as nothing: `API_KEYS=` is how a `.env` file spells
 * an absent value, and the deployment docs have always described that as the
 * development-mode trigger. Anything with content in it does not count, however
 * little of it survives parsing — see the branch in `authenticateRequest`.
 */
function isUnsetApiKeysValue(rawApiKeys: string | undefined): boolean {
  return rawApiKeys === undefined || rawApiKeys === '';
}

/** Why one configured entry cannot be used. Counted, never logged with values. */
type ApiKeyRejection = 'below-minimum-length' | 'outside-credential-grammar';

function rejectionFor(entry: string): ApiKeyRejection | undefined {
  // Grammar first: the length below is measured on the token body, which only
  // means anything once the value is known to be a well-formed token at all.
  if (!API_KEY_CREDENTIAL_GRAMMAR.test(entry)) {
    return 'outside-credential-grammar';
  }
  if (credentialBodyOf(entry).length < API_KEY_MINIMUM_LENGTH) {
    return 'below-minimum-length';
  }
  return undefined;
}

/**
 * Split the configured entries into the ones that may authenticate a request
 * and a tally of why the rest may not.
 *
 * The rejected entries are counted rather than collected. Everything this
 * function hands back is destined for a log line, and an unusable entry is
 * still whatever the operator typed — quite possibly a real credential that is
 * merely too short, which is exactly the value that must not be written down.
 */
function partitionConfiguredApiKeys(entries: string[]): {
  usableKeys: string[];
  rejections: ApiKeyRejection[];
} {
  const usableKeys: string[] = [];
  const rejections: ApiKeyRejection[] = [];

  for (const entry of entries) {
    const rejection = rejectionFor(entry);
    if (rejection) {
      rejections.push(rejection);
    } else {
      usableKeys.push(entry);
    }
  }

  return { usableKeys, rejections };
}

/**
 * Authenticate API request using API key
 *
 * Checks for API key in:
 * 1. X-API-Key header
 * 2. Authorization Bearer token
 *
 * To enable authentication, set API_KEYS environment variable:
 * API_KEYS=sk-live-9f3c2a71b40e,sk-live-2d81ff60ac95
 *
 * Each entry must satisfy {@link API_KEY_CREDENTIAL_GRAMMAR} and carry at least
 * {@link API_KEY_MINIMUM_LENGTH} characters of token body; entries that do not
 * are refused rather than trusted. If every configured entry is refused — or
 * `API_KEYS` holds no entry at all while being set to something — the
 * deployment fails closed rather than falling back to development mode.
 *
 * @param req - Request object
 * @returns Authentication result with user ID if successful
 */
export async function authenticateRequest(req: AuthenticatedRequest): Promise<AuthResult> {
  // Validate against configured API keys first. Checking for a caller-supplied
  // key before this used to answer MISSING_API_KEY to every request that sent
  // none — which is every request the app's own frontend has ever made, since
  // it has never sent one — regardless of whether API_KEYS was configured at
  // all. That made the documented "no keys configured → allow in development
  // mode" fallback reachable only by a caller that happened to send some key
  // anyway; the one request shape this module exists to let through when
  // unconfigured was the one shape it never actually let through.
  const rawApiKeys = process.env[API_KEYS_ENVIRONMENT_VARIABLE];
  const configuredEntries = (rawApiKeys || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  const { usableKeys, rejections } = partitionConfiguredApiKeys(configuredEntries);

  noteApiKeyConfiguration(rawApiKeys, configuredEntries.length, usableKeys.length, rejections);

  // Nothing was written at all: the variable is absent, or is the empty string
  // that `API_KEYS=` in a `.env` file produces, which is the idiomatic way to
  // spell "unset" and is what the deployment docs have always meant by it.
  //
  // A value with content in it that yields no entry -- `API_KEYS=" "` from a
  // secret substitution that silently produced nothing, or `API_KEYS=","` --
  // is a different thing: someone wrote something and got it wrong. That falls
  // through to the fail-closed branch below rather than being read as "unset",
  // because a blank secret is exactly the case where reading it as "unset"
  // turns a broken deploy into an app with no authentication at all.
  if (configuredEntries.length === 0 && isUnsetApiKeysValue(rawApiKeys)) {
    // No API keys configured - allow request in development mode
    return {
      authenticated: true,
      userId: 'development_user'
    };
  }

  // Configured, but nothing configured is usable. This is deliberately *not*
  // the development-mode branch above, and the distinction is the whole point
  // of the contract: "the operator set no keys" and "the operator set keys that
  // are all unusable" are opposite intentions, and collapsing them would turn a
  // typo in `API_KEYS` into an unauthenticated deployment serving every caller
  // as `development_user`. A deployment that asked for authentication and did
  // not get it refuses requests instead.
  if (usableKeys.length === 0) {
    return {
      authenticated: false,
      error: {
        code: 'API_KEY_CONFIGURATION_INVALID',
        message: 'API key authentication is misconfigured on the server and no request can be authenticated'
      }
    };
  }

  // Extract API key from header
  const apiKey =
    readHeader(req.headers, 'x-api-key') ||
    stripBearerPrefix(readHeader(req.headers, 'authorization'));

  if (!apiKey) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key required. Include X-API-Key header or Authorization Bearer token'
      }
    };
  }

  if (!usableKeys.some(validKey => matchesApiKey(validKey, apiKey))) {
    return {
      authenticated: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    };
  }

  // Map API key to user ID (in production, this would query a database)
  return {
    authenticated: true,
    userId: deriveUserId(apiKey)
  };
}

/**
 * The `API_KEYS` value this process last saw, or `null` before the first
 * request.
 *
 * The "no API keys configured" warning was a bare `console.warn` on the
 * unconfigured branch above, and that branch is not an event — it is the
 * deployment's configuration, read again on every call.
 * `enforceApiAccessControl` runs `authenticateRequest` once per request on
 * every paid route, and `API_KEYS` is unset by default, so an ordinary
 * deployment wrote that line for every story generation, continuation, export,
 * image, evaluation, and job request it ever served. A line repeated at request
 * rate is not a warning: it is the bulk of the deployment log, it costs money
 * on a platform billed by ingested log volume, and it buries the entries that
 * describe something that actually happened once.
 *
 * Keeping the value rather than a "have warned" flag is what makes the rule
 * "say it when there is something new to say" rather than "say it once ever":
 * a process that loses its configuration warns again, and a process that gains
 * one stops. Nothing else here would notice either transition.
 */
let lastObservedApiKeysValue: { raw: string | undefined } | null = null;

function noteApiKeyConfiguration(
  rawApiKeys: string | undefined,
  configuredCount: number,
  usableCount: number,
  rejections: ApiKeyRejection[]
): void {
  if (lastObservedApiKeysValue && lastObservedApiKeysValue.raw === rawApiKeys) {
    return;
  }

  lastObservedApiKeysValue = { raw: rawApiKeys };

  if (configuredCount === 0 && isUnsetApiKeysValue(rawApiKeys)) {
    // Through the logger rather than the console, for the reason every other
    // warning on this surface goes through it: the console line carried no
    // structure, never reached the recent-log buffer an operator reads a failure
    // out of, and skipped the redaction every logged string passes through. The
    // message names no value — the point is that there is none to name.
    logWarn(
      'No API keys are configured; every request is being served as the development user.',
      { endpoint: API_KEY_CONFIGURATION_LOG_ENDPOINT },
      { environmentVariable: API_KEYS_ENVIRONMENT_VARIABLE }
    );
    return;
  }

  if (configuredCount === 0) {
    // Set to something that holds no key: a secret substitution that produced
    // whitespace, or separators with nothing between them. Named separately
    // from both neighbours because the operator's mistake is a different one —
    // the value is not missing, it is empty of keys — and because unlike the
    // warning above, this deployment is serving nothing.
    logError(
      'API_KEYS is set but contains no key; all authenticated routes are refusing every request.',
      undefined,
      { endpoint: API_KEY_CONFIGURATION_LOG_ENDPOINT },
      { environmentVariable: API_KEYS_ENVIRONMENT_VARIABLE, configuredCount: 0, usableCount: 0 }
    );
    return;
  }

  if (rejections.length === 0) {
    return;
  }

  // Counts and reasons only. The metadata on these two entries is the one place
  // in this module where a rejected entry could plausibly be written down, and a
  // rejected entry is still a value the operator believed was a credential.
  const metadata = {
    environmentVariable: API_KEYS_ENVIRONMENT_VARIABLE,
    configuredCount,
    usableCount,
    rejectedCount: rejections.length,
    belowMinimumLength: rejections.filter(reason => reason === 'below-minimum-length').length,
    outsideCredentialGrammar: rejections.filter(reason => reason === 'outside-credential-grammar').length,
    minimumLength: API_KEY_MINIMUM_LENGTH
  };

  if (usableCount === 0) {
    // An error rather than a warning, because nothing is being served: this
    // deployment asked for authentication, configured only unusable values, and
    // is now refusing every request to every authenticated route. That is an
    // outage with a one-line cause, and it should read like one.
    logError(
      'Every configured API key is unusable; all authenticated routes are refusing every request.',
      undefined,
      { endpoint: API_KEY_CONFIGURATION_LOG_ENDPOINT },
      metadata
    );
    return;
  }

  logWarn(
    'Some configured API keys are unusable and cannot authenticate a request.',
    { endpoint: API_KEY_CONFIGURATION_LOG_ENDPOINT },
    metadata
  );
}

/**
 * Test-only: forget the configuration seen so far, so a test can assert how
 * many times one configuration produces the warning above.
 *
 * The state is process-wide and deliberately survives individual requests,
 * which is the whole point of it; a test asserting "once, however many requests
 * arrive" has to be able to start from nothing. Named beside
 * `resetRateLimitsForTests` below, which exists for the same reason.
 */
export function resetApiKeyConfigurationWarningForTests(): void {
  lastObservedApiKeysValue = null;
}

/**
 * Derive a caller identifier from an API key.
 *
 * The identifier is attached to log entries and returned to callers, so it must
 * not carry key material: it used to be the key's first eight characters, which
 * handed anyone with log access a live credential's prefix and made the
 * constant-time comparison below pointless — there is no need to recover a key
 * byte by byte from response timings when a third of it is printed next to
 * every request. A SHA-256 prefix keeps the property the identifier is actually
 * used for — the same key always maps to the same id, different keys to
 * different ids — without being reversible to the key.
 */
function deriveUserId(apiKey: string): string {
  return `user_${createHash('sha256').update(apiKey, 'utf8').digest('hex').slice(0, 16)}`;
}

/**
 * Read a single header value, tolerating the string[] form Node uses for
 * repeated headers.
 *
 * HTTP header names are case-insensitive (RFC 7230 §3.2), and callers reach
 * this function with header bags that have not always been through Node's
 * lowercasing `IncomingMessage.headers` — a hand-built object, a fetch-style
 * adapter, or a test fixture may carry the canonical `X-API-Key` /
 * `Authorization` casing that the documentation and the MISSING_API_KEY
 * message tell clients to send. Match on the lowercased key so every casing
 * resolves to the same header.
 */
function readHeader(headers: any, name: string): string | undefined {
  const raw = findHeaderValue(headers, name);
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function findHeaderValue(headers: any, name: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  // Node lowercases incoming header names, so the direct hit is the common path.
  const target = name.toLowerCase();
  const direct = headers[target];
  if (direct !== undefined) {
    return direct;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }

  return undefined;
}

/**
 * Strip an `Authorization: Bearer <key>` prefix. The scheme is case-insensitive
 * per RFC 7235 and only counts at the start of the value. A Bearer scheme with
 * no credentials after it counts as no key at all, so the caller reports it as
 * missing rather than as an invalid key named "Bearer".
 */
function stripBearerPrefix(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const scheme = 'bearer';
  if (value.slice(0, scheme.length).toLowerCase() !== scheme) {
    return value;
  }

  const separator = value.charAt(scheme.length);
  if (separator !== '' && separator.trim() !== '') {
    // Something like `bearerkey`: the value only starts with the scheme name,
    // so it is a key in its own right.
    return value;
  }

  return value.slice(scheme.length).trim() || undefined;
}

/**
 * Compare a candidate key against a configured key in constant time so that
 * timing differences cannot be used to recover a valid key byte by byte.
 */
function matchesApiKey(validKey: string, candidate: string): boolean {
  const validBuffer = Buffer.from(validKey, 'utf8');
  const candidateBuffer = Buffer.from(candidate, 'utf8');

  if (validBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(validBuffer, candidateBuffer);
}

/**
 * Rate Limiting Middleware
 *
 * Implements in-memory rate limiting to prevent abuse.
 * In production, use a distributed cache like Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage (suitable only for single-instance or development environments).
// For multi-instance deployments (e.g., horizontal scaling, serverless, load-balanced setups), replace with a distributed cache like Redis.
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request exceeds rate limit
 * 
 * @param userId - User identifier (from API key)
 * @param endpoint - Endpoint being accessed
 * @param maxRequests - Maximum requests allowed in window
 * @param windowMs - Time window in milliseconds
 * @returns Whether request should be allowed
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Initialize or reset if window has passed
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }
  
  // Increment count and allow
  entry.count++;
  
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Test-only: clear every rate limit bucket immediately, rather than waiting
 * for a window to expire.
 *
 * `rateLimitStore` is one process-wide map. A test file that drives a route
 * handler many times in one run to exercise behaviour that has nothing to do
 * with rate limiting — a validation rule, a response shape, an owner check —
 * shares that map with every other call the same file makes, and would
 * otherwise trip the real budget partway through for a reason the test was
 * never checking.
 */
export function resetRateLimitsForTests(): void {
  rateLimitStore.clear();
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes. Unref'd so the timer never keeps a serverless
// invocation, CLI run, or test process alive on its own.
const rateLimitCleanupTimer = setInterval(cleanupRateLimits, 5 * 60 * 1000);
rateLimitCleanupTimer.unref?.();
