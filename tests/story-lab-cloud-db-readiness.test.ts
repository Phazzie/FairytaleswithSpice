#!/usr/bin/env tsx
// Created: 2026-06-08 11:10 EDT

import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import { checkStoryLabCloudDatabaseReadiness } from '../api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeReadinessExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][] = [];
  shouldThrow = false;

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    if (this.shouldThrow) {
      throw new Error('raw database outage with secret details');
    }

    return {
      rows: (this.queuedRows.shift() ?? []) as T[]
    };
  }
}

async function main() {
  await testReadyDatabaseReportsReady();
  await testMissingTableOrIndexReportsNotReady();
  await testDatabaseErrorsFailClosedWithoutLeakingProviderDetails();

  console.log('Story Lab cloud DB readiness tests passed');
}

async function testReadyDatabaseReportsReady() {
  const executor = new FakeReadinessExecutor();
  executor.enqueueRows([
    {
      story_lab_profiles: 'public.story_lab_profiles',
      story_projects: 'public.story_projects',
      story_lab_jobs: 'public.story_lab_jobs',
      story_lab_job_events: 'public.story_lab_job_events'
    }
  ]);
  executor.enqueueRows([
    { indexname: 'story_projects_owner_updated_idx' },
    { indexname: 'story_projects_owner_story_idx' },
    { indexname: 'story_lab_jobs_owner_updated_idx' },
    { indexname: 'story_lab_jobs_owner_idempotency_idx' },
    { indexname: 'story_lab_job_events_job_sequence_idx' }
  ]);

  const result = await checkStoryLabCloudDatabaseReadiness(executor, {
    now: () => '2026-06-08T11:10:00.000Z'
  });

  assert(result.ready, 'database with required tables and indexes should be ready');
  assert(result.checkedAt === '2026-06-08T11:10:00.000Z', 'readiness should use injected clock');
  assert(result.missing.length === 0, 'ready database should not report missing items');
  assert(executor.queries[0]?.sql.includes('to_regclass'), 'readiness should check required tables');
  assert(executor.queries[0]?.sql.includes('::text'), 'readiness should cast regclass values to text for drivers');
  assert(executor.queries[1]?.sql.includes('pg_indexes'), 'readiness should check required indexes');
}

async function testMissingTableOrIndexReportsNotReady() {
  const executor = new FakeReadinessExecutor();
  executor.enqueueRows([
    {
      story_lab_profiles: null,
      story_projects: 'story_projects',
      story_lab_jobs: 'story_lab_jobs',
      story_lab_job_events: null
    }
  ]);
  executor.enqueueRows([
    { indexname: 'story_projects_owner_updated_idx' },
    { indexname: 'story_projects_owner_story_idx' },
    { indexname: 'story_lab_jobs_owner_updated_idx' },
    { indexname: 'story_lab_job_events_job_sequence_idx' }
  ]);

  const result = await checkStoryLabCloudDatabaseReadiness(executor, {
    now: () => '2026-06-08T11:10:00.000Z'
  });

  assert(!result.ready, 'missing table/index should report not ready');
  assert(result.missing.includes('story_lab_profiles'), 'missing profile table should be reported');
  assert(result.missing.includes('story_lab_job_events'), 'missing job events table should be reported');
  assert(result.missing.includes('story_lab_jobs_owner_idempotency_idx'), 'missing owner idempotency index should be reported');
}

async function testDatabaseErrorsFailClosedWithoutLeakingProviderDetails() {
  const executor = new FakeReadinessExecutor();
  executor.shouldThrow = true;

  const result = await checkStoryLabCloudDatabaseReadiness(executor, {
    now: () => '2026-06-08T11:10:00.000Z'
  });

  assert(!result.ready, 'database errors should report not ready');
  assert(result.error === 'Story Lab cloud database readiness check failed.', 'readiness error should use safe message');
  assert(!JSON.stringify(result).includes('secret details'), 'readiness result should not leak provider error details');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
