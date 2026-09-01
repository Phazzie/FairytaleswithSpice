#!/usr/bin/env tsx
// Created: 2026-08-26 10:40 UTC
//
// `authenticateRequest` + `checkRateLimit` (`api/_lib/middleware/security.ts`)
// were fully built and had their own isolated unit tests, but had zero
// callers anywhere in the app — every route that spends real money on the
// xAI/Grok API was reachable by anyone, unauthenticated and unthrottled.
// `tests/api-key-auth.test.ts` still proves the primitives themselves are
// correct; this file proves the *routes* actually enforce them, driving each
// wired handler the way a real request would rather than calling the
// primitives directly.

import imageGenerateHandler from '../api/image/generate';
import exportHandler from '../api/export/save';
import evaluateHandler from '../api/story-lab/evaluate';
import genesisHandler from '../api/story-lab/stories';
import continuationHandler from '../api/story-lab/stories/[storyId]/continue';
import jobsHandler from '../api/story-lab/jobs';
import { handleStreamStoryLabJobEvents } from '../api/_lib/story-lab/jobs/jobRouteHandlers';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { enforceApiAccessControl, rateLimitResetSeconds, retryAfterSeconds } from '../api/_lib/middleware/apiAccessControl';
import type { RateLimitStore } from '../api/_lib/middleware/rateLimitStorePort';
import { RATE_LIMITS } from '../api/_lib/constants';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;
  chunks: string[] = [];
  destroyed = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  writeHead(code: number, headers: Record<string, string> = {}): this {
    this.statusCode = code;
    Object.assign(this.headers, headers);
    return this;
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  end(): void {
    this.ended = true;
  }
}

function errorCode(res: FakeResponse): unknown {
  return (res.body as { error?: { code?: unknown } } | null)?.error?.code;
}

async function withApiKeys(keys: string[], fn: () => Promise<void>): Promise<void> {
  const previous = process.env['API_KEYS'];
  process.env['API_KEYS'] = keys.join(',');
  resetRateLimitsForTests();
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env['API_KEYS'];
    } else {
      process.env['API_KEYS'] = previous;
    }
    resetRateLimitsForTests();
  }
}

interface HandlerCase {
  name: string;
  limits: { maxRequests: number; windowMs: number };
  call: (headers: Record<string, string>) => Promise<FakeResponse>;
}

const POST_JSON_CASES: HandlerCase[] = [
  {
    name: '/api/image/generate',
    limits: RATE_LIMITS.IMAGE_GENERATION,
    call: async headers => {
      const res = new FakeResponse();
      await imageGenerateHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  },
  {
    name: '/api/export/save',
    limits: RATE_LIMITS.EXPORT,
    call: async headers => {
      const res = new FakeResponse();
      await exportHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  },
  {
    name: '/api/story-lab/evaluate',
    limits: RATE_LIMITS.STORY_LAB_EVALUATE,
    call: async headers => {
      const res = new FakeResponse();
      await evaluateHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  },
  {
    name: '/api/story-lab/stories',
    limits: RATE_LIMITS.STORY_LAB_GENESIS,
    call: async headers => {
      const res = new FakeResponse();
      await genesisHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  },
  {
    name: '/api/story-lab/stories/:storyId/continue',
    limits: RATE_LIMITS.STORY_LAB_CONTINUATION,
    call: async headers => {
      const res = new FakeResponse();
      await continuationHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  },
  {
    name: '/api/story-lab/jobs (create)',
    limits: RATE_LIMITS.STORY_LAB_JOB_CREATE,
    call: async headers => {
      const res = new FakeResponse();
      await jobsHandler({ method: 'POST', headers, body: {} }, res);
      return res;
    }
  }
];

async function testMissingKeyIsRejected(): Promise<void> {
  await withApiKeys(['sk-live-real-key'], async () => {
    for (const testCase of POST_JSON_CASES) {
      const res = await testCase.call({});
      assert(
        res.statusCode === 401,
        `${testCase.name} should answer 401 for a request with no key, got ${res.statusCode}`
      );
      assert(
        errorCode(res) === 'MISSING_API_KEY',
        `${testCase.name} should report MISSING_API_KEY, got ${errorCode(res)}`
      );
    }
  });
}

async function testWrongKeyIsRejected(): Promise<void> {
  await withApiKeys(['sk-live-real-key'], async () => {
    for (const testCase of POST_JSON_CASES) {
      const res = await testCase.call({ 'x-api-key': 'sk-live-wrong-key' });
      assert(
        res.statusCode === 401,
        `${testCase.name} should answer 401 for a wrong key, got ${res.statusCode}`
      );
      assert(
        errorCode(res) === 'INVALID_API_KEY',
        `${testCase.name} should report INVALID_API_KEY, got ${errorCode(res)}`
      );
    }
  });
}

async function testValidKeyPassesThrough(): Promise<void> {
  await withApiKeys(['sk-live-real-key'], async () => {
    for (const testCase of POST_JSON_CASES) {
      const res = await testCase.call({ 'x-api-key': 'sk-live-real-key' });
      assert(
        res.statusCode !== 401 && res.statusCode !== 429,
        `${testCase.name} should not be rejected on access control for a valid key, got ${res.statusCode} ${JSON.stringify(res.body)}`
      );
      assert(
        res.headers['X-RateLimit-Remaining'] !== undefined,
        `${testCase.name} should report a remaining-quota header once authenticated`
      );
      // Without the limit, `Remaining` is a bare number: a client cannot tell
      // whether `3` is most of the budget or the last of it, and the budget is
      // per route and per tier so nothing else in the response says.
      assert(
        res.headers['X-RateLimit-Limit'] === String(testCase.limits.maxRequests),
        `${testCase.name} should report its own budget as X-RateLimit-Limit, got ${JSON.stringify(res.headers['X-RateLimit-Limit'])}`
      );
      // Epoch seconds, which is the only form anything outside this app reads.
      // Sent unconverted from `Date.now()`, the value is a date fifty thousand
      // years out, and a client backing off until it never returns.
      const resetHeader = res.headers['X-RateLimit-Reset'];
      const resetSeconds = Number(resetHeader);
      const nowSeconds = Date.now() / 1000;
      assert(
        typeof resetHeader === 'string' && /^[0-9]+$/.test(resetHeader),
        `${testCase.name} should answer a whole-number X-RateLimit-Reset, got ${JSON.stringify(resetHeader)}`
      );
      assert(
        resetSeconds >= nowSeconds
          && resetSeconds <= nowSeconds + Math.ceil(testCase.limits.windowMs / 1000) + 1,
        `${testCase.name} should reset within its own window in epoch seconds, got ${resetHeader} against ${Math.floor(nowSeconds)}`
      );
    }
  });
}

async function testRateLimitIsEnforced(): Promise<void> {
  await withApiKeys(['sk-live-real-key'], async () => {
    for (const testCase of POST_JSON_CASES) {
      resetRateLimitsForTests();

      let lastRes: FakeResponse | null = null;
      for (let i = 0; i < testCase.limits.maxRequests; i += 1) {
        lastRes = await testCase.call({ 'x-api-key': 'sk-live-real-key' });
        assert(
          lastRes.statusCode !== 429,
          `${testCase.name} should allow request ${i + 1} of ${testCase.limits.maxRequests}, got 429`
        );
      }

      const overLimitRes = await testCase.call({ 'x-api-key': 'sk-live-real-key' });
      assert(
        overLimitRes.statusCode === 429,
        `${testCase.name} should answer 429 once its budget of ${testCase.limits.maxRequests} is spent, got ${overLimitRes.statusCode}`
      );
      assert(
        errorCode(overLimitRes) === 'RATE_LIMITED',
        `${testCase.name} should report RATE_LIMITED, got ${errorCode(overLimitRes)}`
      );
      // The part of a 429 an ordinary client acts on without consulting its own
      // clock. `error.resetTime` in the body is still absolute epoch
      // milliseconds — this API's own field — and `X-RateLimit-Reset` is the
      // same instant in the epoch seconds the header name means everywhere
      // else; both are instants, so turning either into a delay means trusting
      // the caller's clock against the server's. This one is already a delay.
      const retryAfter = overLimitRes.headers['Retry-After'];
      assert(
        typeof retryAfter === 'string' && /^[0-9]+$/.test(retryAfter) && Number(retryAfter) >= 1,
        `${testCase.name} should answer 429 with a whole-second Retry-After of at least 1, got ${JSON.stringify(retryAfter)}`
      );
      assert(
        Number(retryAfter) <= Math.ceil(testCase.limits.windowMs / 1000),
        `${testCase.name} should not ask a caller to wait longer than its own window, got ${retryAfter}s for ${testCase.limits.windowMs}ms`
      );
    }
  });
}

/**
 * `Retry-After` carries a delay, not an instant, so the conversion is asserted
 * on directly: a header string on a driven route cannot say what the right
 * answer was without reconstructing the `Date.now()` that produced it.
 */
function testRetryAfterSeconds(): void {
  assert(retryAfterSeconds(60_000, 0) === 60, 'a full minute of window should round to 60 seconds');
  assert(retryAfterSeconds(1_500, 0) === 2, 'a partial second should round up, so the caller never returns early');
  // RFC 9110 defines delta-seconds as a non-negative integer, and `0` reads as
  // "retry immediately" — the one thing a caller at its limit must not do.
  assert(retryAfterSeconds(0, 0) === 1, 'a window that has just expired should still ask for one second');
  assert(retryAfterSeconds(-5_000, 0) === 1, 'a window that expired between the check and the header should not go negative');
  assert(retryAfterSeconds(Number.NaN, 0) === 1, 'an unreadable reset instant should still produce a usable delay');
}

/**
 * `X-RateLimit-Reset` carries an instant, in the epoch seconds the header name
 * means everywhere it is read. `checkRateLimit` reports milliseconds, and the
 * unconverted value is a date fifty thousand years out — a client backing off
 * until it never comes back, and one displaying it shows a seven-digit year.
 */
function testRateLimitResetSeconds(): void {
  assert(rateLimitResetSeconds(1_700_000_000_000) === 1_700_000_000, 'a whole second should convert exactly');
  // Rounded up for the same reason `Retry-After` is: the second the header names
  // has to be one the window has actually ended in, or a client that waits for
  // exactly that instant is refused again.
  assert(rateLimitResetSeconds(1_700_000_000_400) === 1_700_000_001, 'a partial second should round up past the window');
  assert(rateLimitResetSeconds(Number.NaN) === 0, 'an unreadable reset instant should not put NaN in a header');
  assert(rateLimitResetSeconds(-1_000) === 0, 'a reset instant before the epoch should not go negative');
}

/**
 * The bug this file exists to catch on its own: `authenticateRequest` used to
 * check "is a key present?" before checking "are any keys configured?", so a
 * request with no key at all — every request the app's own frontend has ever
 * sent — was rejected even when `API_KEYS` was never set. Wiring the guard
 * into every route without this would have 401'd every real user the moment
 * this PR shipped.
 */
async function testUnconfiguredDeploymentStillServesRequestsWithNoKey(): Promise<void> {
  const previous = process.env['API_KEYS'];
  delete process.env['API_KEYS'];
  resetRateLimitsForTests();
  try {
    for (const testCase of POST_JSON_CASES) {
      const res = await testCase.call({});
      assert(
        res.statusCode !== 401,
        `${testCase.name} should not be rejected when no API_KEYS are configured, got 401 ${JSON.stringify(res.body)}`
      );
    }
  } finally {
    if (previous === undefined) {
      delete process.env['API_KEYS'];
    } else {
      process.env['API_KEYS'] = previous;
    }
    resetRateLimitsForTests();
  }
}

/**
 * Unauthenticated callers on an unconfigured deployment all collapse onto the
 * same `development_user` id, so `checkRateLimit` gives them one *shared*
 * budget per endpoint — the meaningful cap the fail-open path still offers
 * without requiring a key.
 */
async function testUnconfiguredDeploymentStillRateLimitsTheSharedBucket(): Promise<void> {
  const previous = process.env['API_KEYS'];
  delete process.env['API_KEYS'];
  resetRateLimitsForTests();
  try {
    const testCase = POST_JSON_CASES[0];
    for (let i = 0; i < testCase.limits.maxRequests; i += 1) {
      const res = await testCase.call({});
      assert(res.statusCode !== 429, `request ${i + 1} should be within the shared budget, got 429`);
    }

    const overLimitRes = await testCase.call({});
    assert(
      overLimitRes.statusCode === 429,
      `an unconfigured deployment's shared bucket should still cap volume, got ${overLimitRes.statusCode}`
    );
  } finally {
    if (previous === undefined) {
      delete process.env['API_KEYS'];
    } else {
      process.env['API_KEYS'] = previous;
    }
    resetRateLimitsForTests();
  }
}

/**
 * `EventSource` cannot set custom headers, so the job event stream route reads
 * the key from an `apiKey` query parameter instead (`withEventStreamAuth`).
 * This drives that path directly rather than through headers.
 */
async function testEventStreamRoutesAcceptTheQueryParameterKey(): Promise<void> {
  await withApiKeys(['sk-live-real-key'], async () => {
    const noKey = new FakeResponse();
    await handleStreamStoryLabJobEvents({ method: 'GET', headers: {}, query: {} }, noKey);
    assert(noKey.statusCode === 401, `jobs/:jobId/events with no key should answer 401, got ${noKey.statusCode}`);
    assert(errorCode(noKey) === 'MISSING_API_KEY', 'jobs/:jobId/events with no key should report MISSING_API_KEY');

    const wrongKey = new FakeResponse();
    await handleStreamStoryLabJobEvents({ method: 'GET', headers: {}, query: { apiKey: 'wrong' } }, wrongKey);
    assert(wrongKey.statusCode === 401, `jobs/:jobId/events with a wrong query key should answer 401, got ${wrongKey.statusCode}`);
    assert(errorCode(wrongKey) === 'INVALID_API_KEY', 'jobs/:jobId/events with a wrong query key should report INVALID_API_KEY');

    const validKey = new FakeResponse();
    await handleStreamStoryLabJobEvents(
      { method: 'GET', headers: {}, query: { apiKey: 'sk-live-real-key' } },
      validKey
    );
    assert(
      validKey.statusCode !== 401,
      `jobs/:jobId/events with a valid query key should not be rejected on access control, got ${validKey.statusCode}`
    );
  });
}

/**
 * `RATE_LIMIT_STORE=postgres` with a missing/unconfigured `DATABASE_URL` must
 * fail closed (503) rather than silently letting a paid route through
 * unthrottled — the same posture `resolveJobStoreOrRespond` in
 * `jobRouteHandlers.ts` takes for an unconfigured durable job store. Driven
 * directly against `enforceApiAccessControl` with an injected unconfigured
 * store, so this does not depend on any particular route's wiring.
 */
async function testUnconfiguredPostgresRateLimitStoreFailsClosed(): Promise<void> {
  const unconfiguredStore: RateLimitStore = {
    mode: 'postgres',
    durable: true,
    isConfigured: () => false,
    consume: () => {
      throw new Error('an unconfigured store should never be asked to consume');
    }
  };

  await withApiKeys(['sk-live-real-key'], async () => {
    const res = new FakeResponse();
    await enforceApiAccessControl(
      { method: 'POST', headers: { 'x-api-key': 'sk-live-real-key' }, body: {} },
      res,
      'story/generate',
      RATE_LIMITS.STORY_GENERATION,
      unconfiguredStore
    );

    assert(res.statusCode === 503, `an unconfigured rate limit store should answer 503, got ${res.statusCode}`);
    assert(
      errorCode(res) === 'RATE_LIMIT_STORE_UNAVAILABLE',
      `an unconfigured rate limit store should report RATE_LIMIT_STORE_UNAVAILABLE, got ${errorCode(res)}`
    );
  });
}

/**
 * A store can report itself configured and still fail per-request — a
 * dropped Postgres connection, a query error. Copilot flagged that
 * `enforceApiAccessControl` did not catch `store.consume()` throwing, so the
 * exception would bubble past this function as an unhandled rejection and
 * the route would answer a generic 500 instead of the deliberate 503 this
 * guard exists to give. Driven with a store whose `isConfigured()` returns
 * `true` but whose `consume()` throws, to isolate this path from the
 * "never configured" one above.
 */
async function testRateLimitStoreConsumeFailureFailsClosed(): Promise<void> {
  const failingStore: RateLimitStore = {
    mode: 'postgres',
    durable: true,
    isConfigured: () => true,
    consume: () => {
      throw new Error('connection reset');
    }
  };

  await withApiKeys(['sk-live-real-key'], async () => {
    const res = new FakeResponse();
    await enforceApiAccessControl(
      { method: 'POST', headers: { 'x-api-key': 'sk-live-real-key' }, body: {} },
      res,
      'story/generate',
      RATE_LIMITS.STORY_GENERATION,
      failingStore
    );

    assert(res.statusCode === 503, `a consume() failure should answer 503, got ${res.statusCode}`);
    assert(
      errorCode(res) === 'RATE_LIMIT_STORE_UNAVAILABLE',
      `a consume() failure should report RATE_LIMIT_STORE_UNAVAILABLE, got ${errorCode(res)}`
    );
  });
}

/**
 * Every route-driven test in this file exercises `enforceApiAccessControl`'s
 * default store resolution (no store is injected), which reads
 * `RATE_LIMIT_STORE`/`DATABASE_URL` straight from `process.env`. Without
 * pinning it here, a runner with `RATE_LIMIT_STORE=postgres` set ambiently
 * would make every route call resolve a Postgres store instead: with no
 * `DATABASE_URL` that store answers 503 and every "should not be rejected"
 * assertion below fails; with one configured, this file would perform real
 * upserts against it, leaving buckets that can make a later run fail before
 * its expected limit. `resetRateLimitsForTests()` only ever clears the
 * in-memory map, so it can't protect against either case on its own — the
 * mode itself has to be pinned.
 */
async function withMemoryRateLimitStore(fn: () => Promise<void>): Promise<void> {
  const previous = process.env['RATE_LIMIT_STORE'];
  process.env['RATE_LIMIT_STORE'] = 'memory';
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env['RATE_LIMIT_STORE'];
    } else {
      process.env['RATE_LIMIT_STORE'] = previous;
    }
  }
}

async function main(): Promise<void> {
  await withMemoryRateLimitStore(async () => {
    await testMissingKeyIsRejected();
    await testWrongKeyIsRejected();
    await testValidKeyPassesThrough();
    await testRateLimitIsEnforced();
    testRetryAfterSeconds();
    testRateLimitResetSeconds();
    await testUnconfiguredDeploymentStillServesRequestsWithNoKey();
    await testUnconfiguredDeploymentStillRateLimitsTheSharedBucket();
    await testEventStreamRoutesAcceptTheQueryParameterKey();
    await testUnconfiguredPostgresRateLimitStoreFailsClosed();
    await testRateLimitStoreConsumeFailureFailsClosed();
  });

  console.log('API access control route tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
