/**
 * Authentication Middleware
 * 
 * Provides API key authentication for securing endpoints.
 * Usage: Add authenticateRequest() at the start of API handlers
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { logWarn } from '../utils/logger';

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

/**
 * Authenticate API request using API key
 * 
 * Checks for API key in:
 * 1. X-API-Key header
 * 2. Authorization Bearer token
 * 
 * To enable authentication, set API_KEYS environment variable:
 * API_KEYS=key1,key2,key3
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
  const rawApiKeys = process.env['API_KEYS'];
  const validKeys = (rawApiKeys || '')
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  noteApiKeyConfiguration(rawApiKeys, validKeys.length > 0);

  if (validKeys.length === 0) {
    // No API keys configured - allow request in development mode
    return {
      authenticated: true,
      userId: 'development_user'
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

  if (!validKeys.some(validKey => matchesApiKey(validKey, apiKey))) {
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

function noteApiKeyConfiguration(rawApiKeys: string | undefined, configured: boolean): void {
  if (lastObservedApiKeysValue && lastObservedApiKeysValue.raw === rawApiKeys) {
    return;
  }

  lastObservedApiKeysValue = { raw: rawApiKeys };
  if (configured) {
    return;
  }

  // Through the logger rather than the console, for the reason every other
  // warning on this surface goes through it: the console line carried no
  // structure, never reached the recent-log buffer an operator reads a failure
  // out of, and skipped the redaction every logged string passes through. The
  // message names no value — the point is that there is none to name.
  logWarn(
    'No API keys are configured; every request is being served as the development user.',
    { endpoint: 'authenticateRequest' },
    { environmentVariable: 'API_KEYS' }
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
