#!/usr/bin/env tsx
// Created: 2026-06-05 01:43 EDT

import {
  CORS_PREFLIGHT_MAX_AGE_SECONDS,
  applyCorsPolicy,
  buildCorsHeaders,
  createCorsMiddleware,
  parseAllowedOrigins,
  type CorsRequestLike,
  type CorsResponseLike
} from '../api/_lib/http/corsPolicy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeResponse implements CorsResponseLike {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): CorsResponseLike {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  end(): void {
    this.ended = true;
  }
}

class EndOnlyResponse implements CorsResponseLike {
  headers: Record<string, string> = {};
  statusCode = 0;
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): CorsResponseLike {
    this.statusCode = code;
    return this;
  }

  end(): void {
    this.ended = true;
  }
}

function request(method: string, origin?: string): CorsRequestLike {
  return {
    method,
    headers: origin ? { origin } : {}
  };
}

const env = {
  STORY_LAB_ALLOWED_ORIGINS: 'https://story.example.com, https://preview.example.com/path?x=1',
  ALLOWED_ORIGINS: '',
  FRONTEND_URL: ''
};

const allowed = parseAllowedOrigins(env);
assert(allowed.includes('https://story.example.com'), 'primary allowed origin should parse');
assert(allowed.includes('https://preview.example.com'), 'allowed origins should normalize away path/query');
assert(!allowed.includes('*'), 'wildcard should never become an allowed origin');

const allowedResponse = new FakeResponse();
const allowedResult = applyCorsPolicy(request('POST', 'https://story.example.com'), allowedResponse, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env
});

assert(!allowedResult.handled, 'allowed POST should continue to route handler');
assert(!allowedResult.rejected, 'allowed POST should not be rejected');
assert(allowedResponse.headers['Access-Control-Allow-Origin'] === 'https://story.example.com', 'CORS should echo exact allowed origin');
assert(allowedResponse.headers['Access-Control-Allow-Credentials'] === 'true', 'credentialed routes should set credentials');
assert(allowedResponse.headers['Vary'] === 'Origin', 'CORS responses should vary by origin');

const preflightResponse = new FakeResponse();
const preflightResult = applyCorsPolicy(request('OPTIONS', 'https://preview.example.com'), preflightResponse, {
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type'],
  credentials: true,
  env
});

assert(preflightResult.handled, 'allowed OPTIONS should be handled by CORS');
assert(preflightResponse.statusCode === 200, 'allowed preflight should return 200');
assert(preflightResponse.ended, 'allowed preflight should end response');
assert(preflightResponse.headers['Access-Control-Allow-Headers'] === 'Content-Type', 'configured headers should be used');

// `Allow-Headers` is the request side — which headers a caller may send. It
// says nothing about what a browser lets the page read back, and the default
// there is a short safelist `X-Request-ID` is not on. So every route set the
// correlation id on the response and a cross-origin caller could not read it:
// the one value this API offers for tracing a request was visible only to a
// same-origin page, which is the caller that needs it least.
//
// `Retry-After` and the two `X-RateLimit-*` headers are on the same footing and
// for higher stakes: `enforceApiAccessControl` sets all three, and a
// cross-origin browser client could see the 429 without a single one of the
// values that say when to come back.
const EXPECTED_EXPOSED_HEADERS = 'Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID';
assert(
  preflightResponse.headers['Access-Control-Expose-Headers'] === EXPECTED_EXPOSED_HEADERS,
  `the correlation id and the rate-limit headers should be readable cross-origin, got ${JSON.stringify(preflightResponse.headers['Access-Control-Expose-Headers'])}`
);

const exposedOnPost = new FakeResponse();
applyCorsPolicy(request('POST', 'https://preview.example.com'), exposedOnPost, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env
});
assert(
  exposedOnPost.headers['Access-Control-Expose-Headers'] === EXPECTED_EXPOSED_HEADERS,
  'the exposure applies to the real response, not only to the preflight'
);

const rejectedResponse = new FakeResponse();
const rejectedResult = applyCorsPolicy(request('POST', 'https://evil.example.com'), rejectedResponse, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env
});

assert(rejectedResult.handled, 'disallowed origin should be handled by CORS rejection');
assert(rejectedResult.rejected, 'disallowed origin should be rejected');
assert(rejectedResponse.statusCode === 403, 'disallowed origin should return 403');
assert(!('Access-Control-Allow-Origin' in rejectedResponse.headers), 'disallowed origin should not receive allow-origin');

const endOnlyRejectedResponse = new EndOnlyResponse();
const endOnlyRejectedResult = applyCorsPolicy(request('POST', 'https://evil.example.com'), endOnlyRejectedResponse, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env
});

assert(endOnlyRejectedResult.handled, 'non-JSON disallowed origin should be handled');
assert(endOnlyRejectedResponse.statusCode === 403, 'non-JSON disallowed origin should return 403');
assert(endOnlyRejectedResponse.ended, 'non-JSON disallowed origin should end the response');

const wildcardResponse = new FakeResponse();
applyCorsPolicy(request('OPTIONS', 'https://evil.example.com'), wildcardResponse, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env: {
    STORY_LAB_ALLOWED_ORIGINS: '*',
    ALLOWED_ORIGINS: '',
    FRONTEND_URL: ''
  }
});

assert(wildcardResponse.statusCode === 403, 'wildcard env should fail closed for credentialed routes');
assert(wildcardResponse.headers['Access-Control-Allow-Origin'] !== '*', 'wildcard should never be echoed');

const noOriginHeaders = buildCorsHeaders(request('POST'), {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env: {}
});

assert(noOriginHeaders['Access-Control-Allow-Origin'] === 'http://localhost:4200', 'missing env should default to local dev origin');
assert(noOriginHeaders['Access-Control-Allow-Origin'] !== '*', 'default local CORS should not be wildcard');

const middlewareEnv = {
  STORY_LAB_ALLOWED_ORIGINS: '',
  ALLOWED_ORIGINS: 'https://story.example.com,https://preview.example.com',
  FRONTEND_URL: ''
};
const middleware = createCorsMiddleware({
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  env: middlewareEnv
});

const middlewareAllowedResponse = new FakeResponse();
let middlewareContinued = false;
middleware(request('POST', 'https://preview.example.com'), middlewareAllowedResponse, () => {
  middlewareContinued = true;
});

assert(middlewareContinued, 'middleware should hand an allowed request to the next handler');
assert(
  middlewareAllowedResponse.headers['Access-Control-Allow-Origin'] === 'https://preview.example.com',
  'middleware should answer with the single origin the request matched, not the whole configured list'
);
assert(middlewareAllowedResponse.headers['Vary'] === 'Origin', 'middleware responses should vary by origin');

const middlewarePreflightResponse = new FakeResponse();
let middlewarePreflightContinued = false;
middleware(request('OPTIONS', 'https://story.example.com'), middlewarePreflightResponse, () => {
  middlewarePreflightContinued = true;
});

assert(!middlewarePreflightContinued, 'middleware should answer preflight itself');
assert(middlewarePreflightResponse.statusCode === 200, 'middleware preflight should return 200');

const middlewareRejectedResponse = new FakeResponse();
let middlewareRejectedContinued = false;
middleware(request('POST', 'https://evil.example.com'), middlewareRejectedResponse, () => {
  middlewareRejectedContinued = true;
});

assert(!middlewareRejectedContinued, 'middleware should not run the route for a disallowed origin');
assert(middlewareRejectedResponse.statusCode === 403, 'middleware should reject a disallowed origin with 403');

// A browser sends `Origin` on every non-GET request, its own included, so a
// deployment that never named its public URL in the env answered 403 to every
// POST the app's own page made.
function sameOriginRequest(
  method: string,
  origin: string,
  headers: Record<string, string> = {}
): CorsRequestLike {
  return {
    method,
    headers: { origin, ...headers }
  };
}

const sameOriginResponse = new FakeResponse();
const sameOriginResult = applyCorsPolicy(
  sameOriginRequest('POST', 'https://spice.example.app', {
    host: 'spice.example.app',
    'x-forwarded-proto': 'https'
  }),
  sameOriginResponse,
  { methods: ['POST', 'OPTIONS'], credentials: true, env: {} }
);

assert(!sameOriginResult.rejected, 'a same-origin POST must not be rejected as cross-origin');
assert(!sameOriginResult.handled, 'a same-origin POST should reach the route');
assert(
  sameOriginResponse.headers['Access-Control-Allow-Origin'] === 'https://spice.example.app',
  'a same-origin request should be answered with its own origin'
);

const forwardedHostResponse = new FakeResponse();
const forwardedHostResult = applyCorsPolicy(
  sameOriginRequest('POST', 'https://spice.example.app', {
    host: 'internal-lambda.local:3000',
    'x-forwarded-host': 'spice.example.app, internal-proxy.local',
    'x-forwarded-proto': 'https,http'
  }),
  forwardedHostResponse,
  { methods: ['POST', 'OPTIONS'], credentials: true, env: {} }
);

assert(
  !forwardedHostResult.rejected,
  'the client-facing forwarded host is the origin the browser saw, so it decides same-origin'
);

const forwardedProtocolMismatch = new FakeResponse();
const forwardedProtocolResult = applyCorsPolicy(
  sameOriginRequest('POST', 'http://spice.example.app', {
    host: 'spice.example.app',
    'x-forwarded-proto': 'https'
  }),
  forwardedProtocolMismatch,
  { methods: ['POST', 'OPTIONS'], credentials: true, env: {} }
);

assert(
  forwardedProtocolResult.rejected,
  'a scheme the request was not served over is a different origin and stays rejected'
);

const crossOriginWithHostResponse = new FakeResponse();
const crossOriginWithHostResult = applyCorsPolicy(
  sameOriginRequest('POST', 'https://evil.example.com', {
    host: 'spice.example.app',
    'x-forwarded-proto': 'https'
  }),
  crossOriginWithHostResponse,
  { methods: ['POST', 'OPTIONS'], credentials: true, env: {} }
);

assert(crossOriginWithHostResult.rejected, 'an unlisted cross-origin POST is still rejected');
assert(
  !('Access-Control-Allow-Origin' in crossOriginWithHostResponse.headers),
  'an unlisted cross-origin request should not receive allow-origin'
);

const canonicalCasingResponse = new FakeResponse();
const canonicalCasingResult = applyCorsPolicy(
  {
    method: 'POST',
    headers: {
      Origin: 'https://spice.example.app',
      Host: 'spice.example.app',
      'X-Forwarded-Proto': 'https'
    }
  },
  canonicalCasingResponse,
  { methods: ['POST', 'OPTIONS'], credentials: true, env: {} }
);

assert(
  !canonicalCasingResult.rejected,
  'header names are case-insensitive, so a canonical-cased bag resolves the same way'
);

// Nothing set `Access-Control-Max-Age`, and the absence is not neutral: a
// browser with no value falls back to its own, five seconds in Chromium and in
// Safari. Every paid POST route here is preflighted — the app sends
// `Content-Type: application/json`, which is not CORS-safelisted — so a
// split-origin deployment paid a second round trip for generation,
// continuation, export, and image, and paid it again five seconds later, for an
// answer that never varies with the request.
const maxAgeResponse = new FakeResponse();
applyCorsPolicy(request('OPTIONS', 'https://story.example.com'), maxAgeResponse, {
  methods: ['POST', 'OPTIONS'],
  credentials: true,
  env
});

assert(
  maxAgeResponse.headers['Access-Control-Max-Age'] === String(CORS_PREFLIGHT_MAX_AGE_SECONDS),
  `a preflight should say how long it may be cached, got ${JSON.stringify(maxAgeResponse.headers['Access-Control-Max-Age'])}`
);
assert(
  CORS_PREFLIGHT_MAX_AGE_SECONDS > 0 && CORS_PREFLIGHT_MAX_AGE_SECONDS <= 600,
  'the cache window has to be positive and inside the smallest cap a major browser enforces'
);
assert(
  Number.isInteger(CORS_PREFLIGHT_MAX_AGE_SECONDS),
  'delta-seconds is a non-negative integer, so a fractional value is not a value a browser reads'
);

// The jobs route answers its own `OPTIONS` through `applyCorsPolicy` and the
// Node deployment answers through `createCorsMiddleware`, so the header has to
// come from the shared header set rather than from one preflight branch.
const middlewareMaxAgeResponse = new FakeResponse();
middleware(request('OPTIONS', 'https://preview.example.com'), middlewareMaxAgeResponse, () => {
  throw new Error('the middleware should answer a preflight itself');
});

assert(
  middlewareMaxAgeResponse.headers['Access-Control-Max-Age'] === String(CORS_PREFLIGHT_MAX_AGE_SECONDS),
  'every path that answers a preflight should carry the cache window'
);

console.log('CORS policy tests passed');
