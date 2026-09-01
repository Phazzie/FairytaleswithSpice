// Created: 2026-06-08 11:10 EDT

import type { StoryLabCloudQueryExecutor } from './storyLabCloudStorageConfig';

export interface StoryLabCloudDatabaseReadinessOptions {
  now?: () => string;
}

export interface StoryLabCloudDatabaseReadinessResult {
  ready: boolean;
  missing: string[];
  checkedAt: string;
  error?: string;
}

interface TableReadinessRow {
  story_lab_profiles: string | null;
  story_projects: string | null;
  story_lab_jobs: string | null;
  story_lab_job_events: string | null;
  rate_limit_buckets: string | null;
}

interface IndexReadinessRow {
  indexname: string;
}

const REQUIRED_TABLES = [
  'story_lab_profiles',
  'story_projects',
  'story_lab_jobs',
  'story_lab_job_events',
  'rate_limit_buckets'
] as const;
const REQUIRED_INDEXES = [
  'story_projects_owner_updated_idx',
  'story_projects_owner_story_idx',
  'story_lab_jobs_owner_updated_idx',
  'story_lab_jobs_owner_idempotency_idx',
  'story_lab_job_events_job_sequence_idx',
  'story_lab_job_events_owner_job_idx'
] as const;

const TABLE_READINESS_SQL = `
select
  to_regclass('public.story_lab_profiles')::text as story_lab_profiles,
  to_regclass('public.story_projects')::text as story_projects,
  to_regclass('public.story_lab_jobs')::text as story_lab_jobs,
  to_regclass('public.story_lab_job_events')::text as story_lab_job_events,
  to_regclass('public.rate_limit_buckets')::text as rate_limit_buckets
`;

const INDEX_READINESS_SQL = `
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('story_projects', 'story_lab_jobs', 'story_lab_job_events')
  and indexname in (
    'story_projects_owner_updated_idx',
    'story_projects_owner_story_idx',
    'story_lab_jobs_owner_updated_idx',
    'story_lab_jobs_owner_idempotency_idx',
    'story_lab_job_events_job_sequence_idx',
    'story_lab_job_events_owner_job_idx'
  )
`;

export async function checkStoryLabCloudDatabaseReadiness(
  executor: StoryLabCloudQueryExecutor,
  options: StoryLabCloudDatabaseReadinessOptions = {}
): Promise<StoryLabCloudDatabaseReadinessResult> {
  const checkedAt = options.now?.() ?? new Date().toISOString();

  try {
    const tableResult = await executor.query<TableReadinessRow>(TABLE_READINESS_SQL, []);
    const indexResult = await executor.query<IndexReadinessRow>(INDEX_READINESS_SQL, []);
    const tableRow = tableResult.rows[0];
    const foundIndexes = new Set(indexResult.rows.map(row => row.indexname));
    const missing = [
      ...missingTables(tableRow),
      ...REQUIRED_INDEXES.filter(indexName => !foundIndexes.has(indexName))
    ];

    return {
      ready: missing.length === 0,
      missing,
      checkedAt
    };
  } catch {
    return {
      ready: false,
      missing: [...REQUIRED_TABLES, ...REQUIRED_INDEXES],
      checkedAt,
      error: 'Story Lab cloud database readiness check failed.'
    };
  }
}

function missingTables(row: TableReadinessRow | undefined): string[] {
  if (!row) {
    return [...REQUIRED_TABLES];
  }

  return REQUIRED_TABLES.filter(tableName => !matchesTableName(row[tableName], tableName));
}

function matchesTableName(value: string | null, tableName: string): boolean {
  return value?.split('.').pop() === tableName;
}
