#!/usr/bin/env tsx
// Created: 2026-06-08 16:10 EDT

import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import { isStoryLabJobStoreError } from '../api/_lib/story-lab/jobs/postgresStoryLabJobStore';
import { createStoryLabJobStoreConfig } from '../api/_lib/story-lab/jobs/storyLabJobStoreConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeJobExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return { rows: [] };
  }
}

async function main() {
  await testDefaultConfigKeepsNonDurableMemoryStore();
  await testExplicitEnvDoesNotFallThroughToProcessEnv();
  await testPostgresConfigRequiresDatabaseAndExecutor();
  await testPostgresConfigBuildsDurableStoreWhenExplicitlyConfigured();
  await testUnknownJobStoreModeFailsClosed();

  console.log('Story Lab job store config tests passed');
}

async function testDefaultConfigKeepsNonDurableMemoryStore() {
  let executorFactoryCalls = 0;
  const config = createStoryLabJobStoreConfig({
    env: {},
    createExecutor() {
      executorFactoryCalls += 1;
      throw new Error('executor factory should not run for default non-durable jobs');
    }
  });

  assert(config.mode === 'non_durable_memory', 'default job store config should stay non-durable');
  assert(config.store?.mode === 'non_durable_memory', 'default config should expose the non-durable store');
  assert(config.store?.durable === false, 'default config should not claim durable jobs');
  assert(config.isConfigured(), 'default non-durable job store should remain configured');
  assert(!config.databaseUrlConfigured, 'default config should not require DATABASE_URL');
  assert(!config.executorConfigured, 'default config should not initialize a database executor');
  assert(executorFactoryCalls === 0, 'default config should not call the executor factory');
}

async function testExplicitEnvDoesNotFallThroughToProcessEnv() {
  const previousJobStore = process.env['STORY_LAB_JOB_STORE'];
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  process.env['STORY_LAB_JOB_STORE'] = 'postgres';
  process.env['DATABASE_URL'] = 'postgres://secret-process-env/jobs';
  try {
    let executorFactoryCalls = 0;
    const defaultConfig = createStoryLabJobStoreConfig({
      env: {},
      createExecutor() {
        executorFactoryCalls += 1;
        throw new Error('explicit empty env should not read process env');
      }
    });

    assert(defaultConfig.mode === 'non_durable_memory', 'explicit empty env should keep default non-durable mode');
    assert(!defaultConfig.databaseUrlConfigured, 'explicit empty env should not report process DATABASE_URL');
    assert(!defaultConfig.executorConfigured, 'explicit empty env should not create an executor');

    const postgresConfig = createStoryLabJobStoreConfig({
      env: {
        STORY_LAB_JOB_STORE: 'postgres'
      },
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
    if (previousJobStore === undefined) {
      delete process.env['STORY_LAB_JOB_STORE'];
    } else {
      process.env['STORY_LAB_JOB_STORE'] = previousJobStore;
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testPostgresConfigRequiresDatabaseAndExecutor() {
  const config = createStoryLabJobStoreConfig({
    env: { STORY_LAB_JOB_STORE: 'postgres' }
  });

  assert(config.mode === 'postgres', 'explicit postgres job store should report postgres mode');
  assert(config.store?.mode === 'postgres', 'explicit postgres config should expose a postgres store');
  assert(config.store?.durable, 'explicit postgres config should expose durable intent');
  assert(!config.databaseUrlConfigured, 'postgres job store without DATABASE_URL should report missing database URL');
  assert(!config.executorConfigured, 'postgres job store without DATABASE_URL should not configure an executor');
  assert(!config.isConfigured(), 'postgres job store without database config should not be configured');

  try {
    await config.store?.createJob({ kind: 'genesis', ownerUserId: 'user_job_owner' });
    throw new Error('postgres config without DATABASE_URL should fail closed');
  } catch (error) {
    assert(isStoryLabJobStoreError(error), 'unconfigured postgres job store should throw a typed store error');
    assert(error.code === 'STORY_LAB_JOB_STORAGE_UNCONFIGURED', 'missing postgres database should use unconfigured error code');
  }
}

async function testPostgresConfigBuildsDurableStoreWhenExplicitlyConfigured() {
  const executor = new FakeJobExecutor();
  const config = createStoryLabJobStoreConfig({
    env: {
      STORY_LAB_JOB_STORE: 'postgres',
      DATABASE_URL: 'postgres://story-lab.example/jobs'
    },
    createExecutor(databaseUrl) {
      assert(databaseUrl === 'postgres://story-lab.example/jobs', 'executor factory should receive DATABASE_URL');
      return executor;
    },
    now: () => '2026-06-08T16:10:00.000Z',
    jobIdFactory: () => 'job_22222222-2222-4222-8222-222222222222',
    eventIdFactory: () => 'event_config_created'
  });

  assert(config.mode === 'postgres', 'configured postgres job store should report postgres mode');
  assert(config.databaseUrlConfigured, 'configured postgres job store should report DATABASE_URL');
  assert(config.executorConfigured, 'configured postgres job store should report executor');
  assert(config.isConfigured(), 'configured postgres job store should be configured');

  const created = await config.store?.createJob({
    kind: 'genesis',
    ownerUserId: 'user_job_owner',
    storyId: 'story_job_config'
  });

  assert(created?.durability.mode === 'postgres', 'configured postgres job creation should report durable postgres mode');
  assert(executor.queries.some(query => query.sql.toLowerCase().includes('insert into story_lab_jobs')), 'configured postgres store should use the provided executor');
}

async function testUnknownJobStoreModeFailsClosed() {
  const config = createStoryLabJobStoreConfig({
    env: {
      STORY_LAB_JOB_STORE: 'planet-scale',
      DATABASE_URL: 'postgres://story-lab.example/jobs'
    },
    createExecutor() {
      throw new Error('unknown job store mode should not initialize an executor');
    }
  });

  assert(config.mode === 'unsupported', 'unknown job store mode should not pretend to be a supported store');
  assert(config.requestedMode === 'planet-scale', 'unknown job store mode should preserve the requested mode for diagnostics');
  assert(config.store === null, 'unknown job store mode should not silently fall back to non-durable memory');
  assert(config.errorCode === 'STORY_LAB_JOB_STORE_UNSUPPORTED_MODE', 'unknown job store mode should expose a typed config error');
  assert(!config.isConfigured(), 'unknown job store mode should fail closed');
  assert(!config.executorConfigured, 'unknown job store mode should not initialize an executor');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
