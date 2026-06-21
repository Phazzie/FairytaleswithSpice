#!/usr/bin/env tsx
// Created: 2026-06-08 12:30 EDT

import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import type { StoryLabJobStore } from '../api/_lib/story-lab/jobs/jobStorePort';
import { NonDurableStoryLabJobStore } from '../api/_lib/story-lab/jobs/jobStore';
import {
  createPostgresStoryLabJobStore,
  isStoryLabJobStoreError
} from '../api/_lib/story-lab/jobs/postgresStoryLabJobStore';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeJobExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][] = [];
  failNextEventInsertConflicts = 0;

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    if (this.failNextEventInsertConflicts > 0 && sql.toLowerCase().includes('insert into story_lab_job_events')) {
      this.failNextEventInsertConflicts -= 1;
      const error = new Error('duplicate key value violates unique constraint "story_lab_job_events_job_sequence_idx"') as Error & {
        code?: string;
        constraint?: string;
      };
      error.code = '23505';
      error.constraint = 'story_lab_job_events_job_sequence_idx';
      throw error;
    }
    return {
      rows: (this.queuedRows.shift() ?? []) as T[]
    };
  }
}

async function main() {
  await testNonDurableStoreImplementsJobStorePort();
  await testNonDurableStoreRejectsCrossOwnerUpdates();
  await testPostgresStoreFailsClosedWithoutDatabaseConfig();
  await testPostgresStoreHonorsExplicitEnvOverride();
  await testPostgresStoreTrimsDatabaseUrl();
  await testPostgresStoreCreatesUpdatesAndLoadsJobSnapshots();
  await testPostgresStoreRetriesEventSequenceConflicts();

  console.log('Story Lab job store port tests passed');
}

async function testPostgresStoreRetriesEventSequenceConflicts() {
  const executor = new FakeJobExecutor();
  executor.failNextEventInsertConflicts = 1;
  const store = createPostgresStoryLabJobStore({
    databaseUrl: 'postgres://story-lab.example/test',
    executor,
    now: () => '2026-06-08T12:30:00.000Z',
    jobIdFactory: () => 'job_22222222-2222-4222-8222-222222222222',
    eventIdFactory: () => 'event_retry'
  });

  const created = await store.createJob({
    kind: 'genesis',
    ownerUserId: 'user_job_owner'
  });
  const eventInsertQueries = executor.queries.filter(query => (
    query.sql.toLowerCase().includes('insert into story_lab_job_events')
  ));

  assert(created.job.jobId === 'job_22222222-2222-4222-8222-222222222222', 'create should still return the created job after event retry');
  assert(eventInsertQueries.length === 2, 'event sequence conflicts should be retried once before succeeding');
}

async function testNonDurableStoreImplementsJobStorePort() {
  const store: StoryLabJobStore = new NonDurableStoryLabJobStore(2);
  assert(store.mode === 'non_durable_memory', 'non-durable job store should expose non-durable mode');
  assert(!store.durable, 'non-durable job store should not claim durable persistence');
  assert(store.isConfigured(), 'non-durable job store should be configured for local/test use');

  const created = await store.createJob({ kind: 'genesis', now: '2026-06-08T12:30:00.000Z' });
  const updated = await store.updateJob(created.job.jobId, {
    status: 'running',
    currentStep: 'generating_story',
    progressPercent: 25,
    now: '2026-06-08T12:31:00.000Z'
  });
  const events = await store.getEvents(created.job.jobId);

  assert(updated?.job.status === 'running', 'job store port should update snapshots');
  assert(events?.length === 2, 'job store port should expose snapshot events');
}

async function testNonDurableStoreRejectsCrossOwnerUpdates() {
  const store: StoryLabJobStore = new NonDurableStoryLabJobStore();
  const created = await store.createJob({
    kind: 'genesis',
    ownerUserId: 'owner_a',
    now: '2026-06-08T12:30:00.000Z'
  });

  const denied = await store.updateJob(created.job.jobId, {
    ownerUserId: 'owner_b',
    status: 'completed',
    currentStep: 'completed',
    progressPercent: 100,
    now: '2026-06-08T12:31:00.000Z'
  });
  const ownerlessDenied = await store.updateJob(created.job.jobId, {
    status: 'completed',
    currentStep: 'completed',
    progressPercent: 100,
    now: '2026-06-08T12:32:00.000Z'
  });
  const ownerSnapshot = await store.getJob(created.job.jobId, { ownerUserId: 'owner_a' });
  const ownerlessSnapshot = await store.getJob(created.job.jobId);
  const otherEvents = await store.getEvents(created.job.jobId, { ownerUserId: 'owner_b' });
  const ownerlessEvents = await store.getEvents(created.job.jobId);

  assert(denied === null, 'non-durable owner-scoped update should reject a different owner');
  assert(ownerlessDenied === null, 'non-durable owner-scoped update should reject missing owner context');
  assert(ownerSnapshot?.job.status === 'queued', 'denied non-durable update should leave the original snapshot unchanged');
  assert(ownerlessSnapshot === null, 'missing owner context should not read owner-scoped non-durable jobs');
  assert(otherEvents === null, 'different owner should not read non-durable job events');
  assert(ownerlessEvents === null, 'missing owner context should not read owner-scoped non-durable job events');
}

async function testPostgresStoreFailsClosedWithoutDatabaseConfig() {
  const store = createPostgresStoryLabJobStore({
    env: {},
    now: () => '2026-06-08T12:30:00.000Z'
  });

  assert(store.mode === 'postgres', 'Postgres job store should report postgres mode');
  assert(store.durable, 'Postgres job store should report durable intent');
  assert(!store.isConfigured(), 'Postgres job store without DATABASE_URL should not be configured');

  try {
    await store.createJob({ kind: 'genesis' });
    throw new Error('unconfigured Postgres job store should fail closed');
  } catch (error) {
    assert(isStoryLabJobStoreError(error), 'unconfigured job store should throw a typed store error');
    assert(error.code === 'STORY_LAB_JOB_STORAGE_UNCONFIGURED', 'missing database URL should use unconfigured code');
    assert(!error.message.includes('postgres://secret'), 'job store error should not leak database details');
  }
}

async function testPostgresStoreHonorsExplicitEnvOverride() {
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  process.env['DATABASE_URL'] = 'postgres://secret-process-env/jobs';
  try {
    const store = createPostgresStoryLabJobStore({
      env: {},
      executor: new FakeJobExecutor()
    });

    assert(!store.isConfigured(), 'explicit empty env should not fall through to process DATABASE_URL');
    try {
      await store.createJob({ kind: 'genesis', ownerUserId: 'user_job_owner' });
      throw new Error('explicit empty env should keep Postgres storage unconfigured');
    } catch (error) {
      assert(isStoryLabJobStoreError(error), 'explicit empty env should fail with a typed store error');
      assert(error.code === 'STORY_LAB_JOB_STORAGE_UNCONFIGURED', 'explicit empty env should use unconfigured error code');
    }
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testPostgresStoreTrimsDatabaseUrl() {
  const store = createPostgresStoryLabJobStore({
    databaseUrl: '   ',
    executor: new FakeJobExecutor()
  });

  assert(!store.isConfigured(), 'whitespace-only explicit DATABASE_URL should not configure Postgres job storage');
}

async function testPostgresStoreCreatesUpdatesAndLoadsJobSnapshots() {
  const executor = new FakeJobExecutor();
  const fixedJobId = 'job_11111111-1111-4111-8111-111111111111';
  const createdAt = '2026-06-08T12:30:00.000Z';
  const updatedAt = '2026-06-08T12:31:00.000Z';
  const store = createPostgresStoryLabJobStore({
    databaseUrl: 'postgres://story-lab.example/test',
    executor,
    now: () => createdAt,
    jobIdFactory: () => fixedJobId,
    eventIdFactory: () => 'event_created'
  });

  assert(store.isConfigured(), 'Postgres job store with URL and executor should be configured');
  const created = await store.createJob<{ storyId: string }>({
    kind: 'genesis',
    ownerUserId: 'user_job_owner',
    currentStep: 'queued',
    storyId: 'story_owner_safe',
    idempotencyKey: 'job-client-key-1',
    request: {
      projectId: 'project_owner_safe',
      storyId: 'story_owner_safe'
    }
  });

  assert(created.durability.mode === 'postgres', 'created Postgres jobs should report durable postgres mode');
  assert(created.durability.durable, 'created Postgres jobs should report durable true');
  assert(created.job.jobId === fixedJobId, 'Postgres create should use the injected job id');
  assert(executor.queries[0]?.sql.toLowerCase().includes('insert into story_lab_jobs'), 'create should insert a job snapshot');
  assert(executor.queries[1]?.sql.toLowerCase().includes('insert into story_lab_job_events'), 'create should insert an initial event snapshot');

  executor.enqueueRows([
    {
      job_id: fixedJobId,
      owner_user_id: 'user_job_owner',
      kind: 'genesis',
      status: 'completed',
      current_step: 'completed',
      progress_percent: 100,
      created_at: createdAt,
      updated_at: updatedAt,
      result_json: { storyId: 'story_owner_safe' },
      error_json: null
    }
  ]);
  const updated = await store.updateJob(fixedJobId, {
    ownerUserId: 'user_job_owner',
    status: 'completed',
    currentStep: 'completed',
    progressPercent: 200,
    result: {
      storyId: 'story_owner_safe'
    },
    now: updatedAt
  });

  assert(updated?.job.status === 'completed', 'Postgres update should return the updated job snapshot');
  assert(updated?.job.progressPercent === 100, 'Postgres update should normalize progress percent');
  const updateQuery = executor.queries.find(query => query.sql.toLowerCase().includes('update story_lab_jobs'));
  assert(updateQuery, 'update should update a job snapshot');
  assert(updateQuery.sql.toLowerCase().includes('owner_user_id'), 'Postgres update should be scoped by owner user id');
  assert(updateQuery.params.includes('user_job_owner'), 'Postgres update should pass owner user id to the query');

  executor.enqueueRows([
    {
      job_id: fixedJobId,
      kind: 'genesis',
      status: 'completed',
      current_step: 'completed',
      progress_percent: 100,
      created_at: createdAt,
      updated_at: updatedAt,
      result_json: { storyId: 'story_owner_safe' },
      error_json: null
    }
  ]);
  const loaded = await store.getJob<{ storyId: string }>(fixedJobId, { ownerUserId: 'user_job_owner' });
  assert(loaded?.job.result?.storyId === 'story_owner_safe', 'Postgres getJob should map result json');
  const loadJobQuery = executor.queries.find(query => {
    const sql = query.sql.toLowerCase();
    return sql.includes('select job_id') && sql.includes('from story_lab_jobs');
  });
  assert(loadJobQuery?.params.includes('user_job_owner'), 'Postgres getJob should filter by owner user id');

  executor.enqueueRows([]);
  const denied = await store.getJob<{ storyId: string }>(fixedJobId, { ownerUserId: 'other_user' });
  assert(denied === null, 'Postgres getJob should return null when owner does not match');

  executor.enqueueRows([
    {
      event_json: {
        eventId: 'event_loaded',
        type: 'snapshot',
        emittedAt: updatedAt,
        job: loaded?.job
      }
    }
  ]);
  const events = await store.getEvents<{ storyId: string }>(fixedJobId, { ownerUserId: 'user_job_owner' });
  assert(events?.[0]?.eventId === 'event_loaded', 'Postgres getEvents should map event json');
  const loadEventsQuery = executor.queries.find(query => {
    const sql = query.sql.toLowerCase();
    return sql.includes('select event_json') && sql.includes('from story_lab_job_events');
  });
  assert(loadEventsQuery?.params.includes('user_job_owner'), 'Postgres getEvents should filter by owner user id');

  executor.enqueueRows([]);
  const missingEvents = await store.getEvents<{ storyId: string }>(fixedJobId, { ownerUserId: 'other_user' });
  assert(missingEvents === null, 'Postgres getEvents should return null when no owner-scoped event stream exists');

  const queryCountBeforeMissingOwnerUpdate = executor.queries.length;
  let missingOwnerError: unknown;
  try {
    await store.updateJob(fixedJobId, {
      status: 'completed',
      currentStep: 'completed',
      progressPercent: 100,
      now: updatedAt
    });
  } catch (error) {
    missingOwnerError = error;
  }
  assert(
    isStoryLabJobStoreError(missingOwnerError),
    'Postgres update without owner should fail closed with a typed store error'
  );
  assert(
    missingOwnerError.code === 'STORY_LAB_JOB_OWNER_REQUIRED',
    'Postgres update without owner should use owner-required code'
  );
  assert(
    executor.queries.length === queryCountBeforeMissingOwnerUpdate,
    'Postgres update without owner should fail before issuing SQL'
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
