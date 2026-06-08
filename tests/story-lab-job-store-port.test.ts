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

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return {
      rows: (this.queuedRows.shift() ?? []) as T[]
    };
  }
}

async function main() {
  await testNonDurableStoreImplementsJobStorePort();
  await testPostgresStoreFailsClosedWithoutDatabaseConfig();
  await testPostgresStoreCreatesUpdatesAndLoadsJobSnapshots();

  console.log('Story Lab job store port tests passed');
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
  assert(executor.queries.some(query => query.sql.toLowerCase().includes('update story_lab_jobs')), 'update should update a job snapshot');

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
  const loaded = await store.getJob<{ storyId: string }>(fixedJobId);
  assert(loaded?.job.result?.storyId === 'story_owner_safe', 'Postgres getJob should map result json');

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
  const events = await store.getEvents<{ storyId: string }>(fixedJobId);
  assert(events?.[0]?.eventId === 'event_loaded', 'Postgres getEvents should map event json');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
