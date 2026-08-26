/**
 * Wire `authenticateRequest` + `checkRateLimit` (`./security.ts`) into a route
 * handler.
 *
 * Both primitives were fully built, tested in isolation, and documented in
 * `SECURITY_IMPLEMENTATION_GUIDE.md` — but had zero callers anywhere in the
 * app. Every route that spends real money on the xAI/Grok API was reachable
 * by anyone, unauthenticated and unthrottled. This is the one call site every
 * such route makes, right after its CORS/method checks and before it does any
 * paid work, so the two primitives stay in one place instead of nine
 * near-identical copies of the guide's documented pattern.
 */

import { authenticateRequest, checkRateLimit } from './security';

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
 * Authenticate the request and check its rate limit, writing a 401 or 429
 * response and returning `{ allowed: false }` if either check fails. A caller
 * that receives `{ allowed: false }` has already had its response sent and
 * must return without doing any further work.
 */
export async function enforceApiAccessControl(
  req: ApiAccessControlRequest,
  res: ApiAccessControlResponse,
  endpoint: string,
  limits: ApiRateLimitConfig
): Promise<ApiAccessControlResult> {
  const auth = await authenticateRequest({
    method: req.method ?? 'GET',
    headers: req.headers,
    body: req.body
  });
  if (!auth.authenticated) {
    res.status(401).json({
      success: false,
      error: auth.error
    });
    return { allowed: false };
  }

  const userId = auth.userId as string;
  const rateLimit = checkRateLimit(userId, endpoint, limits.maxRequests, limits.windowMs);

  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString());

  if (!rateLimit.allowed) {
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

/**
 * Read the API key for a request a browser `EventSource` made.
 *
 * `EventSource` cannot set custom headers — there is no way for a browser
 * stream reader to send `X-API-Key` or `Authorization`, so the two SSE
 * routes (`story-lab/stream/genesis`, `story-lab/jobs/:jobId/events`) can
 * never satisfy `authenticateRequest`'s header check once a deployment sets
 * `API_KEYS`, no matter what the caller does. This reads the same key from an
 * `apiKey` query parameter instead, so those two routes stay reachable from a
 * real browser stream once authentication is actually enforced, and falls
 * back to whatever header the request already carries (a non-browser client
 * that can set one) when the query parameter is absent.
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
