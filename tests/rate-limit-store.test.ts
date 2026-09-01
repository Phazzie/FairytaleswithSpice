#!/usr/bin/env tsx
// Created: 2026-09-01 EDT
//
// `checkRateLimit` (`api/_lib/middleware/security.ts`) is a module-level
// `Map` — correct for one process, wrong for the serverless deployment this
// app actually runs on (`vercel.json`), where every cold-started or
// concurrently-warm instance gets its own empty map and therefore its own
// independent budget. This file proves two things `tests/api-key-auth.test.ts`
// and `tests/api-access-control.test.ts` don't: that `InMemoryRateLimitStore`
// wraps `checkRateLimit` without changing its behavior, and that
// `PostgresRateLimitStore`'s single atomic upsert produces a *shared* budget
// across what would otherwise be independent instances.

import { InMemoryRateLimitStore } from '../api/_lib/middleware/inMemoryRateLimitStore';
import { createPostgresRateLimitStore, isRateLimitStoreError } from '../api/_lib/middleware/postgresRateLimitStore';
import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import { RecordingQueryExecutor } from './helpers/recordingQueryExecutor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testInMemoryStoreAllowsWithinLimitAndDeniesOverLimit();
  await testInMemoryStoreResetForTestsClearsBuckets();
  await testPostgresStoreFailsClosedWithoutConfiguration();
  await testPostgresStoreSendsExpectedUpsertParams();
  await testPostgresStoreWrapsQueryFailures();
  await testPostgresStoreThrowsWhenNoRowReturned();
  await testPostgresStoreEnforcesASharedBudgetAcrossTwoSimulatedInstances();
  await testPostgresStoreResetsTheWindowOnceItExpires();

  console.log('Rate limit store tests passed');
}

async function testInMemoryStoreAllowsWithinLimitAndDeniesOverLimit() {
  const store = new InMemoryRateLimitStore();
  store.resetForTests();

  assert(store.mode === 'memory', 'in-memory store should report memory mode');
  assert(!store.durable, 'in-memory store should not claim durable persistence');
  assert(store.isConfigured(), 'in-memory store should always be configured');

  const endpoint = 'story/generate';
  const userId = 'user_in_memory_test';
  let lastResult;
  for (let i = 0; i < 3; i += 1) {
    lastResult = store.consume({ userId, endpoint, maxRequests: 3, windowMs: 900000 });
  }
  assert(lastResult?.allowed === true, 'the third request within a limit of 3 should be allowed');
  assert(lastResult?.remaining === 0, 'no budget should remain after exhausting the limit');

  const fourth = store.consume({ userId, endpoint, maxRequests: 3, windowMs: 900000 });
  assert(fourth.allowed === false, 'a fourth request over the limit should be denied');
  assert(fourth.remaining === 0, 'a denied request should report zero remaining');
}

async function testInMemoryStoreResetForTestsClearsBuckets() {
  const store = new InMemoryRateLimitStore();
  store.resetForTests();

  const userId = 'user_reset_test';
  const endpoint = 'story/generate';
  store.consume({ userId, endpoint, maxRequests: 1, windowMs: 900000 });
  const denied = store.consume({ userId, endpoint, maxRequests: 1, windowMs: 900000 });
  assert(!denied.allowed, 'a single-request limit should deny the second call');

  store.resetForTests();
  const afterReset = store.consume({ userId, endpoint, maxRequests: 1, windowMs: 900000 });
  assert(afterReset.allowed, 'resetForTests should clear buckets so the same key is allowed again');
}

async function testPostgresStoreFailsClosedWithoutConfiguration() {
  const store = createPostgresRateLimitStore();
  try {
    await store.consume({ userId: 'user_a', endpoint: 'story/generate', maxRequests: 10, windowMs: 900000 });
    throw new Error('an unconfigured postgres store should not resolve');
  } catch (error) {
    assert(isRateLimitStoreError(error), 'unconfigured postgres store should throw a typed error');
    assert(
      (error as { code: string }).code === 'RATE_LIMIT_STORE_UNCONFIGURED',
      'unconfigured postgres store should use the unconfigured error code'
    );
  }
}

async function testPostgresStoreSendsExpectedUpsertParams() {
  const executor = new RecordingQueryExecutor();
  executor.enqueueRows([{ window_start: '2026-09-01T12:00:00.000Z', count: 1 }]);
  const store = createPostgresRateLimitStore({
    databaseUrl: 'postgres://rate-limits.example/db',
    executor
  });

  const now = new Date('2026-09-01T12:00:00.000Z').getTime();
  const result = await store.consume({
    userId: 'user_params_test',
    endpoint: 'story/generate',
    maxRequests: 10,
    windowMs: 900000,
    now
  });

  assert(result.allowed, 'first request in a fresh window should be allowed');
  assert(result.remaining === 9, 'remaining should be maxRequests minus the returned count');
  assert(result.resetTime === now + 900000, 'resetTime should be window_start plus windowMs');

  assert(executor.queries.length === 1, 'consume should issue exactly one query');
  const [query] = executor.queries;
  assert(query.sql.toLowerCase().includes('insert into rate_limit_buckets'), 'consume should upsert into rate_limit_buckets');
  assert(query.sql.toLowerCase().includes('on conflict (user_id, endpoint)'), 'consume should key the upsert by user and endpoint');
  const [userIdParam, endpointParam, nowParam, cutoffParam] = query.params as [string, string, string, string];
  assert(userIdParam === 'user_params_test', 'the first param should be the user id');
  assert(endpointParam === 'story/generate', 'the second param should be the endpoint');
  assert(nowParam === new Date(now).toISOString(), 'the third param should be the current instant');
  assert(
    cutoffParam === new Date(now - 900000).toISOString(),
    'the fourth param should be the window cutoff (now minus windowMs)'
  );
}

async function testPostgresStoreWrapsQueryFailures() {
  const failingExecutor: StoryLabCloudQueryExecutor = {
    async query() {
      throw new Error('connection reset');
    }
  };
  const store = createPostgresRateLimitStore({
    databaseUrl: 'postgres://rate-limits.example/db',
    executor: failingExecutor
  });

  try {
    await store.consume({ userId: 'user_a', endpoint: 'story/generate', maxRequests: 10, windowMs: 900000 });
    throw new Error('a failing query should not resolve');
  } catch (error) {
    assert(isRateLimitStoreError(error), 'a query failure should surface as a typed store error');
    assert(
      (error as { code: string }).code === 'RATE_LIMIT_STORE_FAILED',
      'a query failure should use the failed error code'
    );
  }
}

async function testPostgresStoreThrowsWhenNoRowReturned() {
  const executor = new RecordingQueryExecutor();
  executor.enqueueRows([]);
  const store = createPostgresRateLimitStore({
    databaseUrl: 'postgres://rate-limits.example/db',
    executor
  });

  try {
    await store.consume({ userId: 'user_a', endpoint: 'story/generate', maxRequests: 10, windowMs: 900000 });
    throw new Error('an upsert with no returned row should not resolve');
  } catch (error) {
    assert(isRateLimitStoreError(error), 'a missing row should surface as a typed store error');
    assert(
      (error as { code: string }).code === 'RATE_LIMIT_STORE_FAILED',
      'a missing row should use the failed error code'
    );
  }
}

/**
 * A tiny in-process stand-in for the fixed-window upsert `CONSUME_SQL`
 * performs in real Postgres, keyed the same way (`user_id`, `endpoint`) and
 * driven by the same params the store sends (`userId`, `endpoint`, `now`,
 * `cutoff`). One instance of this class stands in for the *database*, not a
 * process — so handing the same instance to two separately-constructed
 * `PostgresRateLimitStore`s is exactly the scenario the in-memory `Map`
 * cannot support: two "instances" of the app consuming one shared budget.
 */
class SimulatedRateLimitDatabase implements StoryLabCloudQueryExecutor {
  private readonly buckets = new Map<string, { windowStart: number; count: number }>();

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    const [userId, endpoint, nowIso, cutoffIso] = params as [string, string, string, string];
    const key = `${userId}:${endpoint}`;
    const now = new Date(nowIso).getTime();
    const cutoff = new Date(cutoffIso).getTime();
    const existing = this.buckets.get(key);

    const bucket = !existing || existing.windowStart <= cutoff
      ? { windowStart: now, count: 1 }
      : { windowStart: existing.windowStart, count: existing.count + 1 };

    this.buckets.set(key, bucket);

    return {
      rows: [{ window_start: new Date(bucket.windowStart).toISOString(), count: bucket.count }] as T[]
    };
  }
}

async function testPostgresStoreEnforcesASharedBudgetAcrossTwoSimulatedInstances() {
  const sharedDatabase = new SimulatedRateLimitDatabase();
  const instanceA = createPostgresRateLimitStore({ databaseUrl: 'postgres://rate-limits.example/db', executor: sharedDatabase });
  const instanceB = createPostgresRateLimitStore({ databaseUrl: 'postgres://rate-limits.example/db', executor: sharedDatabase });

  const userId = 'user_shared_budget_test';
  const endpoint = 'story/generate';
  const maxRequests = 10;
  const windowMs = 900000;
  const now = new Date('2026-09-01T12:00:00.000Z').getTime();

  // Two "instances" alternate five requests each — the in-memory `Map` this
  // replaces would have let each instance independently allow all ten,
  // effectively doubling the budget to twenty.
  let lastFromA;
  let lastFromB;
  for (let i = 0; i < 5; i += 1) {
    lastFromA = await instanceA.consume({ userId, endpoint, maxRequests, windowMs, now: now + i * 1000 });
    lastFromB = await instanceB.consume({ userId, endpoint, maxRequests, windowMs, now: now + i * 1000 + 500 });
  }

  assert(lastFromA?.allowed === true, 'the ninth combined request should still be within the shared budget of ten');
  assert(lastFromB?.allowed === true, 'the tenth combined request should still be within the shared budget of ten');
  assert(lastFromB?.remaining === 0, 'the shared budget should be exhausted after ten combined requests');

  const eleventhFromA = await instanceA.consume({ userId, endpoint, maxRequests, windowMs, now: now + 6000 });
  assert(eleventhFromA.allowed === false, 'an eleventh combined request should be denied by the shared budget');
}

async function testPostgresStoreResetsTheWindowOnceItExpires() {
  const sharedDatabase = new SimulatedRateLimitDatabase();
  const store = createPostgresRateLimitStore({ databaseUrl: 'postgres://rate-limits.example/db', executor: sharedDatabase });

  const userId = 'user_window_reset_test';
  const endpoint = 'story/generate';
  const maxRequests = 2;
  const windowMs = 900000;
  const windowStart = new Date('2026-09-01T12:00:00.000Z').getTime();

  await store.consume({ userId, endpoint, maxRequests, windowMs, now: windowStart });
  await store.consume({ userId, endpoint, maxRequests, windowMs, now: windowStart + 1000 });
  const deniedWithinWindow = await store.consume({ userId, endpoint, maxRequests, windowMs, now: windowStart + 2000 });
  assert(deniedWithinWindow.allowed === false, 'a third request within the same window should be denied');

  const afterWindowExpires = await store.consume({
    userId,
    endpoint,
    maxRequests,
    windowMs,
    now: windowStart + windowMs + 1
  });
  assert(afterWindowExpires.allowed === true, 'a request after the window has expired should reset the budget');
  assert(afterWindowExpires.remaining === 1, 'a freshly reset window should report the full remaining budget minus this request');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
