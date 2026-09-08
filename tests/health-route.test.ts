#!/usr/bin/env tsx
// Created: 2026-09-05 UTC
//
// `api/health.ts` used to be structurally unable to report anything but
// `status: 'healthy'` — the type was a literal, not a union, and the only
// check it ran was `!!process.env['XAI_API_KEY']`, presence rather than
// validity. It never looked at the rate-limit store or Story Lab job store
// at all, so an unsupported store mode or an unreachable `postgres` store
// could never surface here, on the one route an uptime monitor actually
// polls. This suite pins the real degraded path those stores now feed.

import handler from '../api/health';

interface FakeRequest {
  method: string;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
  }

  end(): void {
    // No-op: this route never calls end() without json().
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withEnv(updates: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createRequest(): FakeRequest {
  return { method: 'GET', headers: {} };
}

async function get(env: Record<string, string | undefined>): Promise<FakeResponse> {
  const response = new FakeResponse();
  await withEnv(env, async () => {
    await handler(createRequest(), response);
  });
  return response;
}

function dataOf(response: FakeResponse): {
  status: string;
  services: {
    grok: string;
    rateLimitStore: { mode: string; configured: boolean };
    storyLabJobStore: { mode: string; configured: boolean };
    storyLabCloudStorage: { mode: string; configured: boolean };
    criticalAlerting: { mode: string; configured: boolean };
  };
} {
  return (response.body as { data: ReturnType<typeof dataOf> }).data;
}

// Story Lab cloud storage is only ever `healthy` in a reachable `postgres`
// mode (see `isStoryLabCloudStorageDegraded` in `api/health.ts`), so every
// test below whose subject is a *different* service needs this to reach an
// overall `healthy`/200 response, or its degraded assertion would be
// attributable to cloud storage instead of (or as well as) the thing it's
// actually testing.
const RECONCILED_CLOUD_STORAGE_ENV = {
  STORY_LAB_CLOUD_STORAGE: 'postgres',
  DATABASE_URL: 'postgresql://user:password@example.invalid/story_lab'
};

async function main(): Promise<void> {
  await testHealthyWithDefaultMemoryStores();
  await testHealthyWithConfiguredGrokKey();
  await testDegradedOnUnsupportedRateLimitStoreMode();
  await testDegradedOnUnsupportedJobStoreMode();
  await testDegradedOnUnreachablePostgresRateLimitStore();
  await testDegradedOnUnreachablePostgresJobStore();
  await testDegradedOnCloudStorageDefaultingToUnconfiguredPostgres();
  await testDegradedOnUnsupportedCloudStorageMode();
  await testDegradedWhenCloudStorageOptsIntoNonDurableMemory();
  await testHealthyWhenCloudStoragePostgresConfigured();
  await testCriticalAlertingDefaultsToConsole();
  await testCriticalAlertingReportsWebhookModeInProductionWithoutDegradingHealth();
  await testCriticalAlertingReportsConsoleOutsideProductionEvenWhenUrlConfigured();
  await testCriticalAlertingDegradedOnMalformedWebhookUrl();

  console.log('Health route tests passed');
}

async function testHealthyWithDefaultMemoryStores(): Promise<void> {
  const response = await get({
    XAI_API_KEY: undefined,
    RATE_LIMIT_STORE: undefined,
    STORY_LAB_JOB_STORE: undefined,
    ...RECONCILED_CLOUD_STORAGE_ENV
  });

  assert(response.statusCode === 200, 'default memory-backed stores should answer 200');
  const data = dataOf(response);
  assert(data.status === 'healthy', 'default memory-backed stores should report healthy');
  assert(data.services.grok === 'mock', 'no XAI_API_KEY should report grok as mock');
  assert(data.services.rateLimitStore.mode === 'memory', 'default rate limit store should report memory mode');
  assert(data.services.rateLimitStore.configured, 'default in-memory rate limit store should be configured');
  assert(data.services.storyLabJobStore.mode === 'non_durable_memory', 'default job store should report non_durable_memory mode');
  assert(data.services.storyLabJobStore.configured, 'default non-durable job store should be configured');
}

async function testHealthyWithConfiguredGrokKey(): Promise<void> {
  const response = await get({ XAI_API_KEY: 'sk-test-key', ...RECONCILED_CLOUD_STORAGE_ENV });

  assert(response.statusCode === 200, 'a configured XAI key should still answer 200');
  assert(dataOf(response).services.grok === 'configured', 'a set XAI_API_KEY should report grok as configured');
}

async function testDegradedOnUnsupportedRateLimitStoreMode(): Promise<void> {
  // Reconciled so this test's degraded/503 assertions are attributable only
  // to the rate limit store, not to cloud storage's own default.
  const response = await get({ RATE_LIMIT_STORE: 'planet-scale', ...RECONCILED_CLOUD_STORAGE_ENV });

  assert(response.statusCode === 503, 'an unsupported rate limit store mode should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an unsupported rate limit store mode should report degraded');
  assert(data.services.rateLimitStore.mode === 'unsupported', 'the unsupported mode should be surfaced verbatim');
  assert(!data.services.rateLimitStore.configured, 'an unsupported mode should not be configured');
}

async function testDegradedOnUnsupportedJobStoreMode(): Promise<void> {
  const response = await get({ STORY_LAB_JOB_STORE: 'planet-scale', ...RECONCILED_CLOUD_STORAGE_ENV });

  assert(response.statusCode === 503, 'an unsupported job store mode should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an unsupported job store mode should report degraded');
  assert(data.services.storyLabJobStore.mode === 'unsupported', 'the unsupported mode should be surfaced verbatim');
}

// `DATABASE_URL` is one shared env var read by all three durable-store
// configs (`durableStoreEnvResolution.ts`), so a test that needs it absent
// to exercise the rate-limit store's own unreachable-postgres path cannot
// also give cloud storage a reachable one — cloud storage is unavoidably
// degraded here too, by design (see `isStoryLabCloudStorageDegraded`). The
// overall `status`/`statusCode` assertions below are therefore not, on their
// own, proof this test still targets the rate-limit store specifically; the
// direct `data.services.rateLimitStore.mode`/`.configured` assertions are —
// they read straight off that store's own config, independent of either
// aggregation function, so they still catch a regression in its own
// mode/configured computation even though the overall status can't isolate it.
async function testDegradedOnUnreachablePostgresRateLimitStore(): Promise<void> {
  const response = await get({ RATE_LIMIT_STORE: 'postgres', DATABASE_URL: undefined });

  assert(response.statusCode === 503, 'a postgres rate limit store with no DATABASE_URL should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an unreachable postgres rate limit store should report degraded');
  assert(data.services.rateLimitStore.mode === 'postgres', 'the requested postgres mode should be surfaced');
  assert(!data.services.rateLimitStore.configured, 'a postgres store with no DATABASE_URL should not be configured');
}

// See the comment on `testDegradedOnUnreachablePostgresRateLimitStore` above —
// the same shared-`DATABASE_URL` constraint applies here.
async function testDegradedOnUnreachablePostgresJobStore(): Promise<void> {
  const response = await get({ STORY_LAB_JOB_STORE: 'postgres', DATABASE_URL: undefined });

  assert(response.statusCode === 503, 'a postgres job store with no DATABASE_URL should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an unreachable postgres job store should report degraded');
  assert(data.services.storyLabJobStore.mode === 'postgres', 'the requested postgres mode should be surfaced');
  assert(!data.services.storyLabJobStore.configured, 'a postgres store with no DATABASE_URL should not be configured');
}

// The whole point of this addition: cloud storage's default mode is
// `postgres` (unlike its two siblings), so a deployment that never set
// `DATABASE_URL` reports fully `healthy` no longer — this is exactly the
// class of gap `/api/health` was rewritten in #338 to catch, one store deep.
async function testDegradedOnCloudStorageDefaultingToUnconfiguredPostgres(): Promise<void> {
  const response = await get({ STORY_LAB_CLOUD_STORAGE: undefined, DATABASE_URL: undefined });

  assert(response.statusCode === 503, 'cloud storage defaulting to an unreachable postgres store should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'cloud storage defaulting to an unreachable postgres store should report degraded');
  assert(data.services.storyLabCloudStorage.mode === 'postgres', 'the default postgres mode should be surfaced');
  assert(!data.services.storyLabCloudStorage.configured, 'a postgres store with no DATABASE_URL should not be configured');
}

async function testDegradedOnUnsupportedCloudStorageMode(): Promise<void> {
  const response = await get({ STORY_LAB_CLOUD_STORAGE: 'planet-scale' });

  assert(response.statusCode === 503, 'an unsupported cloud storage mode should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an unsupported cloud storage mode should report degraded');
  assert(data.services.storyLabCloudStorage.mode === 'unsupported', 'the unsupported mode should be surfaced verbatim');
  assert(!data.services.storyLabCloudStorage.configured, 'an unsupported mode should not be configured');
}

// `non_durable_memory` reports `configured: true` (the store itself works),
// but the Angular client's `CloudLibraryService` treats that same
// `storageMode` as `cloud_unavailable` — read-only-for-inspection, with
// save/load/delete disabled. `/api/health` has to agree with the client
// here: a store that "works" but whose own product surface calls it
// unavailable is a degraded dependency, not a healthy one.
async function testDegradedWhenCloudStorageOptsIntoNonDurableMemory(): Promise<void> {
  const response = await get({ STORY_LAB_CLOUD_STORAGE: 'non_durable_memory', DATABASE_URL: undefined });

  assert(response.statusCode === 503, 'an explicit non-durable-memory opt-in should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'an explicit non-durable-memory opt-in should report degraded');
  assert(data.services.storyLabCloudStorage.mode === 'non_durable_memory', 'the opted-in mode should be surfaced');
  assert(data.services.storyLabCloudStorage.configured, 'the non-durable memory store itself still reports configured');
}

async function testHealthyWhenCloudStoragePostgresConfigured(): Promise<void> {
  const response = await get(RECONCILED_CLOUD_STORAGE_ENV);

  assert(response.statusCode === 200, 'a reachable postgres cloud storage store should answer 200');
  const data = dataOf(response);
  assert(data.status === 'healthy', 'a reachable postgres cloud storage store should report healthy');
  assert(data.services.storyLabCloudStorage.mode === 'postgres', 'the requested postgres mode should be surfaced');
  assert(data.services.storyLabCloudStorage.configured, 'a reachable postgres store should report configured');
}

async function testCriticalAlertingDefaultsToConsole(): Promise<void> {
  const response = await get({ CRITICAL_ALERT_WEBHOOK_URL: undefined, ...RECONCILED_CLOUD_STORAGE_ENV });

  assert(response.statusCode === 200, 'an unconfigured critical alert destination should not affect health status');
  const data = dataOf(response);
  assert(data.services.criticalAlerting.mode === 'console', 'default critical alerting should report console mode');
  assert(data.services.criticalAlerting.configured, 'console-mode critical alerting should report configured');
}

async function testCriticalAlertingReportsWebhookModeInProductionWithoutDegradingHealth(): Promise<void> {
  const response = await get({
    NODE_ENV: 'production',
    CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert',
    ...RECONCILED_CLOUD_STORAGE_ENV
  });

  assert(response.statusCode === 200, 'a configured critical alert webhook should still answer 200');
  const data = dataOf(response);
  assert(data.status === 'healthy', 'a configured critical alert webhook is not itself a degraded state');
  assert(data.services.criticalAlerting.mode === 'webhook', 'a configured webhook URL should report webhook mode in production');
  assert(data.services.criticalAlerting.configured, 'a configured webhook URL should report configured');
}

// `Logger.critical()` only ever dispatches beyond the console in production
// (see `logger.ts`), so reporting `webhook` mode in any other environment —
// including the README's own documented `NODE_ENV=development` setup — would
// claim a destination nothing can actually reach yet.
async function testCriticalAlertingReportsConsoleOutsideProductionEvenWhenUrlConfigured(): Promise<void> {
  const response = await get({
    NODE_ENV: 'development',
    CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert',
    ...RECONCILED_CLOUD_STORAGE_ENV
  });

  assert(response.statusCode === 200, 'a valid webhook outside production should not affect health status');
  const data = dataOf(response);
  assert(
    data.services.criticalAlerting.mode === 'console',
    'a valid webhook URL outside production should report console mode, since dispatch never reaches it there'
  );
}

// A malformed URL used to report `configured: true` while every delivery
// attempt would fail — indistinguishable from working alerting until the
// first real emergency.
async function testCriticalAlertingDegradedOnMalformedWebhookUrl(): Promise<void> {
  const response = await get({
    NODE_ENV: 'production',
    CRITICAL_ALERT_WEBHOOK_URL: 'not-a-url',
    ...RECONCILED_CLOUD_STORAGE_ENV
  });

  assert(response.statusCode === 503, 'a malformed critical alert webhook URL should answer 503');
  const data = dataOf(response);
  assert(data.status === 'degraded', 'a malformed critical alert webhook URL should report degraded');
  assert(data.services.criticalAlerting.mode === 'webhook', 'the requested webhook mode should be surfaced verbatim');
  assert(!data.services.criticalAlerting.configured, 'a malformed URL should not be configured');
  assert(data.services.storyLabCloudStorage.mode === 'postgres', 'cloud storage should be reconciled to healthy here too');
  assert(data.services.storyLabCloudStorage.configured, 'cloud storage should not be what makes this response degraded');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
