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

  // `X-RateLimit-Limit` is what makes `X-RateLimit-Remaining` a fraction rather
  // than a bare number. The three headers are one family and always have been —
  // `SECURITY_FIXES_QUICK_REFERENCE.md` documents all three at this call site —
  // but only two were sent, so a client reading `X-RateLimit-Remaining: 3` could
  // not tell whether it had spent a seventh of its budget or two thirds of it.
  // The budget is not discoverable any other way: it is per route and per tier,
  // and nothing in the response said what this route's was.
  res.setHeader('X-RateLimit-Limit', limits.maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  // Epoch *seconds*, which is the only form anything outside this app reads.
  //
  // `checkRateLimit` reports its reset instant in milliseconds, because that is
  // what `Date.now()` returns, and the value went onto the header unconverted:
  // `X-RateLimit-Reset: 1787012345678`. Read as the header is defined — GitHub,
  // Stripe, and every generated client that knows the name treat it as a UTC
  // epoch in seconds — that is a date some fifty thousand years out, so a client
  // backing off until the reset never came back at all, and one merely
  // displaying it showed the reader a year in the seven digits. No convention
  // anywhere uses milliseconds here.
  //
  // This is the same reading `Retry-After` below already gets, and the reason
  // that header was added: the parts of a rate-limit answer a caller acts on
  // have to be spelled the way callers spell them. `error.resetTime` in the body
  // is unchanged and stays in milliseconds — it is this API's own field, read by
  // this app, and a client that wants the instant rather than the delay can have
  // it there.
  res.setHeader('X-RateLimit-Reset', rateLimitResetSeconds(rateLimit.resetTime).toString());

  if (!rateLimit.allowed) {
    // `Retry-After` is the only part of this answer a caller can act on without
    // knowing the shape of the body. Every HTTP client, proxy, and retry helper
    // reads it; nothing but this app reads `error.resetTime`, and the two
    // `X-RateLimit-*` headers beside it are absolute epoch milliseconds, so a
    // client has to trust its own clock against the server's to turn either one
    // into a delay. So a 429 from here told an ordinary caller nothing at all
    // about when to come back, and the retry it would guess at is the one this
    // limit exists to prevent — on routes whose budget is ten requests per
    // fifteen minutes, the guess is wrong by minutes.
    //
    // Whole seconds, and never below one: RFC 9110 defines the delta-seconds
    // form as a non-negative integer, and a `0` reads as "retry immediately",
    // which is exactly what a caller at its limit must not do. A window that
    // has expired between the check above and this line is the only way to get
    // there, and one second is the honest answer for it.
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
