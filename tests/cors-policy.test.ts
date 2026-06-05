#!/usr/bin/env tsx
// Created: 2026-06-05 01:43 EDT

import {
  applyCorsPolicy,
  buildCorsHeaders,
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

console.log('CORS policy tests passed');
