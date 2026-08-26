// Created: 2026-06-05 01:43 EDT

type HeaderValue = string | string[] | undefined;

export interface CorsRequestLike {
  method?: string;
  headers?: Record<string, HeaderValue>;
}

export interface CorsResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): CorsResponseLike;
  json?(body: unknown): void;
  end?(): void;
}

export interface CorsPolicyOptions {
  methods: string[];
  headers?: string[];
  credentials?: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * A connect/Express middleware. `next` takes the optional error argument that
 * signature carries, so an `express.RequestHandler` can be passed straight to
 * one of these and one of these straight to `app.use`, with no adapter in
 * between; the policy itself never calls `next` with an error.
 */
export type CorsMiddleware = (
  req: CorsRequestLike,
  res: CorsResponseLike,
  next: (error?: unknown) => void
) => void;

export interface CorsPolicyResult {
  handled: boolean;
  rejected: boolean;
  allowedOrigin: string | null;
  headers: Record<string, string>;
}

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4200'];
const ORIGIN_ENV_KEYS = ['STORY_LAB_ALLOWED_ORIGINS', 'ALLOWED_ORIGINS', 'FRONTEND_URL'] as const;
/**
 * The response headers a cross-origin caller is allowed to read.
 *
 * `Access-Control-Allow-Headers` above is the request side — which headers a
 * caller may *send*. It says nothing about what a browser will let the page
 * read back, and the default there is a short safelist that `X-Request-ID` is
 * not on. So the routes set the correlation id on the response and a
 * cross-origin caller could not see it: the one value the API offers for
 * tracing a request was readable only by a same-origin page, which is exactly
 * the caller that needs it least.
 *
 * The rate-limit headers are here for the same reason, and `Retry-After` with
 * them. It is not on the safelist either — that list is `Cache-Control`,
 * `Content-Language`, `Content-Length`, `Content-Type`, `Expires`,
 * `Last-Modified`, and `Pragma`, and nothing else — so `enforceApiAccessControl`
 * setting it on a 429 reached a same-origin page and no other. Every deployment
 * that serves the app from one origin and the API from another therefore had a
 * browser client that could see the 429 and not a single one of the three
 * values that say what to do about it, which is the state this whole set of
 * headers exists to prevent.
 */
const EXPOSED_HEADERS = [
  'Retry-After',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-ID'
];

const DEFAULT_HEADERS = [
  'Authorization',
  'Cache-Control',
  'Content-MD5',
  'Content-Type',
  'Date',
  'X-API-Key',
  'X-Api-Version',
  'X-CSRF-Token',
  'X-Request-ID',
  'X-Requested-With'
];

export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const rawValues = ORIGIN_ENV_KEYS
    .map(key => env[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!rawValues.length) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  return unique(
    rawValues
      .flatMap(value => value.split(','))
      .map(value => normalizeOrigin(value.trim()))
      .filter((value): value is string => Boolean(value))
  );
}

export function buildCorsHeaders(
  req: CorsRequestLike,
  options: CorsPolicyOptions
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(req, options);
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': normalizeMethods(options.methods),
    'Access-Control-Allow-Headers': unique(options.headers ?? DEFAULT_HEADERS).join(', '),
    'Access-Control-Expose-Headers': unique(EXPOSED_HEADERS).join(', ')
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function applyCorsPolicy(
  req: CorsRequestLike,
  res: CorsResponseLike,
  options: CorsPolicyOptions
): CorsPolicyResult {
  const headers = buildCorsHeaders(req, options);
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }

  const requestOrigin = getRequestOrigin(req);
  const allowedOrigin = headers['Access-Control-Allow-Origin'] ?? null;
  const rejected = Boolean(requestOrigin && !allowedOrigin);

  if (rejected) {
    sendCorsForbidden(res);
    return { handled: true, rejected: true, allowedOrigin, headers };
  }

  if ((req.method ?? '').toUpperCase() === 'OPTIONS') {
    res.status(200).end?.();
    return { handled: true, rejected: false, allowedOrigin, headers };
  }

  return { handled: false, rejected: false, allowedOrigin, headers };
}

/**
 * Wrap the policy as connect/Express middleware.
 *
 * The Node server wrote its own CORS headers, and echoed whatever
 * `ALLOWED_ORIGINS` held into `Access-Control-Allow-Origin` verbatim. That env
 * var is documented as a comma-separated list and is parsed as one everywhere
 * else, so any deployment naming two origins sent
 * `Access-Control-Allow-Origin: https://a.example, https://b.example` — not a
 * value any browser accepts, which blocks every cross-origin call to the
 * deployment, including from the origins it was trying to allow. The header
 * also never varied on `Origin`, so a shared cache could hand one origin's
 * response to another. Routing the server through the same policy the
 * serverless routes use answers each request with the single origin it
 * actually matched.
 */
export function createCorsMiddleware(options: CorsPolicyOptions): CorsMiddleware {
  return (req, res, next) => {
    if (applyCorsPolicy(req, res, options).handled) {
      return;
    }

    next();
  };
}

function resolveAllowedOrigin(req: CorsRequestLike, options: CorsPolicyOptions): string | null {
  const requestOrigin = normalizeOrigin(getRequestOrigin(req) ?? '');
  const allowedOrigins = parseAllowedOrigins(options.env);

  if (requestOrigin) {
    if (allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }

    return requestOrigin === getRequestTargetOrigin(req) ? requestOrigin : null;
  }

  return allowedOrigins[0] ?? null;
}

/**
 * The origin this request was actually sent to, so a same-origin request is
 * never rejected as cross-origin.
 *
 * A browser attaches `Origin` to every request whose method is not GET or HEAD,
 * same-origin ones included, and the allow-list defaults to
 * `http://localhost:4200` when none of the origin env vars is set. Matching the
 * header against the list alone therefore answered 403 ORIGIN_NOT_ALLOWED to
 * every `POST` the app's own page made — story generation, continuation,
 * export, job creation, profile writes — on any deployment that had not thought
 * to name its own public URL in `ALLOWED_ORIGINS`. The frontend and the API are
 * served from one origin on both the Vercel and the Node/Docker deployments, so
 * that is the whole app, failing on a list whose purpose is to keep *other*
 * origins out.
 *
 * The forwarded headers come first because a proxied deployment terminates TLS
 * ahead of this process, so `Host` alone would rebuild the origin with the
 * wrong scheme. Only the first entry of each is read: a chain of proxies
 * appends, and the client-facing hop is the one the browser saw.
 *
 * This does not widen what a *browser* can reach. `Origin` and the request
 * target both come from the URL the page fetched, so they agree only when the
 * page is already on this origin; a cross-origin page cannot make them agree,
 * because `X-Forwarded-Host` is not a CORS-safelisted request header and a
 * proxy overwrites it in any case. A non-browser client that sets both headers
 * by hand was never constrained by CORS to begin with — it is not a browser
 * enforcing the response.
 */
function getRequestTargetOrigin(req: CorsRequestLike): string | null {
  const host = firstForwardedValue(readRequestHeader(req, 'x-forwarded-host'))
    ?? readRequestHeader(req, 'host');
  if (!host) {
    return null;
  }

  const protocol = firstForwardedValue(readRequestHeader(req, 'x-forwarded-proto')) ?? 'https';
  return normalizeOrigin(`${protocol}://${host}`);
}

function firstForwardedValue(value: string | undefined): string | undefined {
  const first = value?.split(',')[0]?.trim();
  return first ? first : undefined;
}

function getRequestOrigin(req: CorsRequestLike): string | undefined {
  return readRequestHeader(req, 'origin');
}

/**
 * Read one request header, tolerating the `string[]` form a repeated header
 * arrives in and the casing a hand-built header bag may carry. Node lowercases
 * incoming header names, so the direct hit is the common path.
 */
function readRequestHeader(req: CorsRequestLike, name: string): string | undefined {
  const headers = req.headers;
  if (!headers) {
    return undefined;
  }

  // Indexed access: the Angular app type-checks this module through the Node
  // server, and its config forbids property access on an index signature.
  const direct = headers[name];
  const raw = direct !== undefined
    ? direct
    : Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOrigin(value: string): string | null {
  if (!value || value === '*') {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeMethods(methods: string[]): string {
  return unique(methods.map(method => method.toUpperCase())).join(', ');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(value => value.trim().length > 0)));
}

function sendCorsForbidden(res: CorsResponseLike): void {
  const response = res.status(403);
  const body = {
    success: false,
    error: {
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'Request origin is not allowed.'
    }
  };

  if (response.json) {
    response.json(body);
    return;
  }

  response.end?.();
}
