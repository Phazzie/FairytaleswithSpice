#!/usr/bin/env tsx
// Created: 2026-09-01 EDT
//
// Mirrors `story-lab-job-store-config.test.ts`: `rateLimitStoreConfig.ts`
// selects between the process-local default and a Postgres-backed store the
// same way `storyLabJobStoreConfig.ts` does for Story Lab jobs, so it earns
// the same coverage — default stays memory, explicit env doesn't leak
// process env, a postgres request without `DATABASE_URL` fails closed rather
// than silently falling back, and an unknown mode fails closed rather than
// pretending to be supported.

import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import { createRateLimitStoreConfig } from '../api/_lib/middleware/rateLimitStoreConfig';
import { isRateLimitStoreError } from '../api/_lib/middleware/postgresRateLimitStore';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeRateLimitExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][] = [];

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return { rows: (this.queuedRows.shift() ?? []) as T[] };
  }
}

async function main() {
  await testDefaultConfigStaysInMemory();
  await testExplicitEnvDoesNotFallThroughToProcessEnv();
  await testWhitespaceDatabaseUrlIsUnconfigured();
  await testPostgresConfigRequiresDatabaseAndExecutor();
  await testPostgresConfigBuildsDurableStoreWhenExplicitlyConfigured();
  await testUnknownRateLimitStoreModeFailsClosed();

  console.log('Rate limit store config tests passed');
}

async function testDefaultConfigStaysInMemory() {
  let executorFactoryCalls = 0;
  const config = createRateLimitStoreConfig({
    env: {},
    createExecutor() {
      executorFactoryCalls += 1;
      throw new Error('executor factory should not run for default in-memory rate limiting');
    }
  });

  assert(config.mode === 'memory', 'default rate limit store config should stay in-memory');
  assert(config.store?.mode === 'memory', 'default config should expose the in-memory store');
  assert(config.store?.durable === false, 'default config should not claim durable rate limiting');
  assert(config.isConfigured(), 'default in-memory rate limit store should remain configured');
  assert(!config.databaseUrlConfigured, 'default config should not require DATABASE_URL');
  assert(!config.executorConfigured, 'default config should not initialize a database executor');
  assert(executorFactoryCalls === 0, 'default config should not call the executor factory');
}

async function testExplicitEnvDoesNotFallThroughToProcessEnv() {
  const previousMode = process.env['RATE_LIMIT_STORE'];
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  process.env['RATE_LIMIT_STORE'] = 'postgres';
  process.env['DATABASE_URL'] = 'postgres://secret-process-env/rate-limits';
  try {
    let executorFactoryCalls = 0;
    const defaultConfig = createRateLimitStoreConfig({
      env: {},
      createExecutor() {
        executorFactoryCalls += 1;
        throw new Error('explicit empty env should not read process env');
      }
    });

    assert(defaultConfig.mode === 'memory', 'explicit empty env should keep default in-memory mode');
    assert(!defaultConfig.databaseUrlConfigured, 'explicit empty env should not report process DATABASE_URL');
    assert(!defaultConfig.executorConfigured, 'explicit empty env should not create an executor');

    const postgresConfig = createRateLimitStoreConfig({
      env: { RATE_LIMIT_STORE: 'postgres' },
      createExecutor() {
        executorFactoryCalls += 1;
        throw new Error('postgres config without env DATABASE_URL should not create an executor');
      }
    });

    assert(postgresConfig.mode === 'postgres', 'explicit env postgres mode should still be honored');
    assert(!postgresConfig.databaseUrlConfigured, 'explicit env without DATABASE_URL should not use process DATABASE_URL');
    assert(!postgresConfig.executorConfigured, 'explicit env without DATABASE_URL should not create an executor');
    assert(!postgresConfig.isConfigured(), 'explicit env without DATABASE_URL should fail closed');
    assert(executorFactoryCalls === 0, 'explicit env overrides should avoid process-env executor setup');
  } finally {
    if (previousMode === undefined) {
      delete process.env['RATE_LIMIT_STORE'];
    } else {
      process.env['RATE_LIMIT_STORE'] = previousMode;
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testWhitespaceDatabaseUrlIsUnconfigured() {
  const config = createRateLimitStoreConfig({
    env: { RATE_LIMIT_STORE: 'postgres', DATABASE_URL: '   ' },
    createExecutor() {
      throw new Error('whitespace DATABASE_URL should not create an executor');
    }
  });

  assert(config.mode === 'postgres', 'postgres mode should still be reported for whitespace DATABASE_URL');
  assert(!config.databaseUrlConfigured, 'whitespace DATABASE_URL should be treated as missing');
  assert(!config.executorConfigured, 'whitespace DATABASE_URL should not create an executor');
  assert(!config.isConfigured(), 'whitespace DATABASE_URL should fail closed');
}

async function testPostgresConfigRequiresDatabaseAndExecutor() {
  const config = createRateLimitStoreConfig({
    env: { RATE_LIMIT_STORE: 'postgres' }
  });

  assert(config.mode === 'postgres', 'explicit postgres rate limit store should report postgres mode');
  assert(config.store?.mode === 'postgres', 'explicit postgres config should expose a postgres store');
  assert(config.store?.durable, 'explicit postgres config should expose durable intent');
  assert(!config.databaseUrlConfigured, 'postgres rate limit store without DATABASE_URL should report missing database URL');
  assert(!config.executorConfigured, 'postgres rate limit store without DATABASE_URL should not configure an executor');
  assert(!config.isConfigured(), 'postgres rate limit store without database config should not be configured');

  try {
    await config.store?.consume({ userId: 'user_a', endpoint: 'story/generate', maxRequests: 10, windowMs: 900000 });
    throw new Error('postgres config without DATABASE_URL should fail closed');
  } catch (error) {
    assert(isRateLimitStoreError(error), 'unconfigured postgres rate limit store should throw a typed store error');
    assert(
      (error as { code: string }).code === 'RATE_LIMIT_STORE_UNCONFIGURED',
      'missing postgres database should use the unconfigured error code'
    );
  }
}

async function testPostgresConfigBuildsDurableStoreWhenExplicitlyConfigured() {
  const executor = new FakeRateLimitExecutor();
  executor.enqueueRows([{ window_start: '2026-09-01T00:00:00.000Z', count: 1 }]);
  const config = createRateLimitStoreConfig({
    env: { RATE_LIMIT_STORE: 'postgres', DATABASE_URL: 'postgres://rate-limits.example/db' },
    createExecutor(databaseUrl) {
      assert(databaseUrl === 'postgres://rate-limits.example/db', 'executor factory should receive DATABASE_URL');
      return executor;
    },
    now: () => new Date('2026-09-01T00:00:00.000Z').getTime()
  });

  assert(config.mode === 'postgres', 'configured postgres rate limit store should report postgres mode');
  assert(config.databaseUrlConfigured, 'configured postgres rate limit store should report DATABASE_URL');
  assert(config.executorConfigured, 'configured postgres rate limit store should report executor');
  assert(config.isConfigured(), 'configured postgres rate limit store should be configured');

  const result = await config.store?.consume({
    userId: 'user_config_test',
    endpoint: 'story/generate',
    maxRequests: 10,
    windowMs: 900000
  });

  assert(result?.allowed === true, 'a fresh bucket should be allowed');
  assert(
    executor.queries.some(query => query.sql.toLowerCase().includes('insert into rate_limit_buckets')),
    'configured postgres store should use the provided executor'
  );
}

async function testUnknownRateLimitStoreModeFailsClosed() {
  const config = createRateLimitStoreConfig({
    env: { RATE_LIMIT_STORE: 'planet-scale', DATABASE_URL: 'postgres://rate-limits.example/db' },
    createExecutor() {
      throw new Error('unknown rate limit store mode should not initialize an executor');
    }
  });

  assert(config.mode === 'unsupported', 'unknown rate limit store mode should not pretend to be a supported store');
  assert(config.requestedMode === 'planet-scale', 'unknown mode should preserve the requested mode for diagnostics');
  assert(config.store === null, 'unknown rate limit store mode should not silently fall back to memory');
  assert(config.errorCode === 'RATE_LIMIT_STORE_UNSUPPORTED_MODE', 'unknown mode should expose a typed config error');
  assert(!config.isConfigured(), 'unknown rate limit store mode should fail closed');
  assert(!config.executorConfigured, 'unknown rate limit store mode should not initialize an executor');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
