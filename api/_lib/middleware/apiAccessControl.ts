/**
 * Wire `authenticateRequest` (`./security.ts`) and a `RateLimitStore`
 * (`./rateLimitStorePort.ts`) into a route handler.
 *
 * Both primitives were fully built, tested in isolation, and documented in
 * `SECURITY_IMPLEMENTATION_GUIDE.md` — but had zero callers anywhere in the
 * app. Every route that spends real money on the xAI/Grok API was reachable
 * by anyone, unauthenticated and unthrottled. This is the one call site every
 * such route makes, right after its CORS/method checks and before it does any
 * paid work, so the two primitives stay in one place instead of nine
 * near-identical copies of the guide's documented pattern.
 *
 * Rate limiting itself is resolved through `rateLimitStoreConfig.ts` rather
 * than calling `checkRateLimit` directly, so a deployment can opt into a
 * Postgres-backed store (`RATE_LIMIT_STORE=postgres`) that survives across
 * this app's multiple serverless instances — the in-memory default a bare
 * `checkRateLimit` call would have kept is process-local and cannot enforce a
 * shared budget once more than one instance is warm at once.
 */

import { authenticateRequest } from './security';
import { createRateLimitStoreConfig } from './rateLimitStoreConfig';
import type { RateLimitStore } from './rateLimitStorePort';
import { logError } from '../utils/logger';
import { readClerkSessionToken } from '../story-lab/auth/clerkAuthPort';
import { createClerkSessionVerifierFromEnv } from '../story-lab/auth/clerkSessionVerifier';

/**
 * Looser than `security.ts`'s own `AuthenticatedRequest`: every route handler
 * in this repo declares its request parameter with its own (sometimes
 * optional-`method`) shape rather than that interface, and `method` is not
 * actually read by `authenticateRequest` — only `headers` is. Requiring the
 * stricter shape here would force every call site to reshape its request
 * object for a field this module never inspects.
 */
export interface ApiAccessControlRequest {
  method?: string;
  headers?: any;
  body?: any;
}

export interface ApiAccessControlResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

export interface ApiRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export type ApiAccessControlResult =
  | { allowed: true; userId: string }
  | { allowed: false };

/**
 * Authenticate the request and check its rate limit, writing a 401, 429, or
 * 503 response and returning `{ allowed: false }` if any check fails. A
 * caller that receives `{ allowed: false }` has already had its response
 * sent and must return without doing any further work.
 *
 * When `API_KEYS` is configured, a Clerk session token sent via
 * `X-Story-Lab-Session` header (or `__session` cookie) is accepted as an
 * alternative credential — so the browser frontend can call paid routes
 * while `API_KEYS` is set, as long as the caller holds a valid Clerk session.
 *
 * `rateLimitStore` is normally left unset — the configured store
 * (`RATE_LIMIT_STORE`, default in-memory) is resolved fresh per call, the
 * same way `createStoryLabJobStoreConfig()` is resolved fresh per job-route
 * request. Route handlers never need to pass it; it exists so tests can
 * inject a store without mutating process env or module singletons.
 */
export async function enforceApiAccessControl(
  req: ApiAccessControlRequest,
  res: ApiAccessControlResponse,
  endpoint: string,
  limits: ApiRateLimitConfig,
  rateLimitStore?: RateLimitStore
): Promise<ApiAccessControlResult> {
  const auth = await authenticateRequest({
    method: req.method ?? 'GET',
    headers: req.headers,
    body: req.body
  });
  if (auth.authenticated) {
    return completeAccessControl(req, res, endpoint, limits, auth.userId as string, rateLimitStore);
  }

  // `authenticateRequest` failed. When `API_KEYS` is not configured, fail closed:
  // there is no valid credential for this route without an API key.
  // When `API_KEYS` IS configured, try Clerk session as a fallback so the browser
  // frontend (which sends a Clerk token via `X-Story-Lab-Session`) can still reach
  // paid routes without an API key.
  if (!process.env['API_KEYS']?.trim()) {
    res.status(401).json({
      success: false,
      error: auth.error
    });
    return { allowed: false };
  }

  // `API_KEYS` is configured and the request had no valid API key.
  // Check for a Clerk session token as an alternative credential.
  const clerkVerifier = createClerkSessionVerifierFromEnv(process.env);
  if (clerkVerifier) {
    const clerkToken = readClerkSessionToken(req as any);
    if (clerkToken) {
      try {
        const session = await clerkVerifier(clerkToken, req as any);
        if (session) {
          return completeAccessControl(req, res, endpoint, limits, session.userId, rateLimitStore);
        }
      } catch {
        // Clerk verification threw — treat as a failed verification, fall through to 401.
      }
    }
  }

  res.status(401).json({
    success: false,
    error: auth.error
  });
  return { allowed: false };
}

async function completeAccessControl(
  req: ApiAccessControlRequest,
  res: ApiAccessControlResponse,
  endpoint: string,
  limits: ApiRateLimitConfig,
  userId: string,
  rateLimitStore?: RateLimitStore
): Promise<ApiAccessControlResult> {
  const store = rateLimitStore ?? createRateLimitStoreConfig().store;
  if (!store || !store.isConfigured()) {
    respondRateLimitStoreUnavailable(res);
    return { allowed: false };
  }

  let rateLimit;
  try {
    rateLimit = await store.consume({
      userId,
      endpoint,
      maxRequests: limits.maxRequests,
      windowMs: limits.windowMs
    });
  } catch (error) {
    logError('Rate limit store failed to answer consume()', error, { endpoint });
    respondRateLimitStoreUnavailable(res);
    return { allowed: false };
  }

  res.setHeader('X-RateLimit-Limit', limits.maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimitResetSeconds(rateLimit.resetTime).toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds(rateLimit.resetTime)));
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        resetTime: rateLimit.resetTime
      }
    });
    return { allowed: false };
  }

  return { allowed: true, userId };
}

function respondRateLimitStoreUnavailable(res: ApiAccessControlResponse): void {
  res.status(503).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
      message: 'Rate limiting is misconfigured for this deployment.'
    }
  });
}

/**
 * Turn the absolute reset instant `checkRateLimit` reports into the delay
 * `Retry-After` carries.
 *
 * Exported so the conversion can be asserted on directly rather than through a
 * header string on a driven route, which would have to reconstruct `Date.now()`
 * to say what the right answer was.
 */
export function retryAfterSeconds(resetTime: number, now: number = Date.now()): number {
  if (!Number.isFinite(resetTime)) {
    return 1;
  }

  return Math.max(1, Math.ceil((resetTime - now) / 1000));
}

/**
 * Turn the reset instant `checkRateLimit` reports into the epoch seconds
 * `X-RateLimit-Reset` carries.
 *
 * Rounded up, so the second the header names is one the window has actually
 * ended in: rounding down would name a second the caller is still limited
 * during, and a client that waits until exactly that instant would be refused
 * again — the same reasoning as the `Math.ceil` in `retryAfterSeconds`.
 *
 * A non-finite instant cannot be spelled as a date, so it is reported as `0`,
 * the epoch — a value a client reads as "already past" and falls back to
 * `Retry-After` for, rather than a `NaN` in a header field.
 *
 * Exported for the same reason `retryAfterSeconds` is: asserting on the header
 * string a driven route produced would mean reconstructing the clock that
 * produced it.
 */
export function rateLimitResetSeconds(resetTime: number): number {
  return Number.isFinite(resetTime) ? Math.max(0, Math.ceil(resetTime / 1000)) : 0;
}

/**
 * Read the API key for a request a browser `EventSource` made.
 *
 * `EventSource` cannot set custom headers — there is no way for a browser
 * stream reader to send `X-API-Key` or `Authorization`, so an SSE route
 * (`story-lab/jobs/:jobId/events`) can never satisfy `authenticateRequest`'s
 * header check once a deployment sets `API_KEYS`, no matter what the caller
 * does. This reads the same key from an `apiKey` query parameter instead, so
 * that route stays reachable from a real browser stream once authentication
 * is actually enforced, and falls back to whatever header the request
 * already carries (a non-browser client that can set one) when the query
 * parameter is absent.
 */
export function withEventStreamAuth(req: {
  method?: string;
  headers?: any;
  query?: Record<string, string | string[] | undefined>;
}): ApiAccessControlRequest {
  const apiKeyParam = req.query?.['apiKey'];
  const apiKey = Array.isArray(apiKeyParam) ? apiKeyParam[0] : apiKeyParam;

  return {
    method: req.method ?? 'GET',
    headers: apiKey ? { ...req.headers, 'x-api-key': apiKey } : req.headers,
    body: undefined
  };
}
