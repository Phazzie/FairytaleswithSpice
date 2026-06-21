// Created: 2026-06-08 12:30 EDT

import { randomUUID } from 'node:crypto';
import type {
  StoryLabJob,
  StoryLabJobCreationResponse,
  StoryLabJobError,
  StoryLabJobEvent,
  StoryLabJobKind,
  StoryLabJobStatus
} from '../contracts';
import type { StoryLabCloudQueryExecutor } from '../storage/storyLabCloudStorageConfig';
import {
  assertOpaqueStoryLabJobId,
  buildStoryLabJobPaths,
  createOpaqueStoryLabJobId,
  POSTGRES_STORY_LAB_JOB_DURABILITY
} from './jobContracts';
import type { CreateStoryLabJobInput, ReadStoryLabJobInput, StoryLabJobStore, UpdateStoryLabJobInput } from './jobStorePort';
import { logWarn } from '../../utils/logger';

export type StoryLabJobStoreErrorCode =
  | 'STORY_LAB_JOB_STORAGE_UNCONFIGURED'
  | 'STORY_LAB_JOB_STORAGE_DRIVER_MISSING'
  | 'STORY_LAB_JOB_OWNER_REQUIRED'
  | 'STORY_LAB_JOB_STORAGE_FAILED';

export class StoryLabJobStoreError extends Error {
  constructor(
    readonly code: StoryLabJobStoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'StoryLabJobStoreError';
  }
}

export interface PostgresStoryLabJobStoreOptions {
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  executor?: StoryLabCloudQueryExecutor;
  now?: () => string;
  jobIdFactory?: () => string;
  eventIdFactory?: () => string;
}

interface StoryLabJobRow {
  job_id: string;
  owner_user_id?: string;
  kind: StoryLabJobKind;
  status: StoryLabJobStatus;
  current_step: string;
  progress_percent: number;
  created_at: string | Date;
  updated_at: string | Date;
  result_json: unknown;
  error_json: unknown;
}

interface StoryLabJobEventRow {
  event_json: unknown;
}

const INSERT_JOB_SQL = `
insert into story_lab_jobs (
  job_id,
  owner_user_id,
  kind,
  status,
  current_step,
  progress_percent,
  idempotency_key,
  story_id,
  request_json,
  created_at,
  updated_at
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
`;

const UPDATE_JOB_SQL = `
update story_lab_jobs
set
  status = $3,
  current_step = $4,
  progress_percent = $5,
  result_json = $6::jsonb,
  error_json = $7::jsonb,
  updated_at = $8,
  completed_at = case when $3 in ('completed', 'failed', 'cancelled') then $8 else completed_at end
where job_id = $1
  and owner_user_id = $2
returning job_id, owner_user_id, kind, status, current_step, progress_percent, created_at, updated_at, result_json, error_json
`;

const LOAD_JOB_SQL = `
select job_id, kind, status, current_step, progress_percent, created_at, updated_at, result_json, error_json
from story_lab_jobs
where job_id = $1
  and owner_user_id = $2
limit 1
`;

const INSERT_EVENT_SQL = `
insert into story_lab_job_events (
  job_id,
  owner_user_id,
  sequence_number,
  event_json,
  created_at
) values ($1, $2, (
  select coalesce(max(sequence_number), 0) + 1
  from story_lab_job_events
  where job_id = $1
), $3::jsonb, $4)
`;

const LOAD_EVENTS_SQL = `
select event_json
from story_lab_job_events
where job_id = $1
  and owner_user_id = $2
order by sequence_number asc
`;

const MAX_EVENT_INSERT_ATTEMPTS = 3;

export function createPostgresStoryLabJobStore(
  options: PostgresStoryLabJobStoreOptions = {}
): StoryLabJobStore {
  return new PostgresStoryLabJobStore(options);
}

export function isStoryLabJobStoreError(error: unknown): error is StoryLabJobStoreError {
  return error instanceof StoryLabJobStoreError;
}

class PostgresStoryLabJobStore implements StoryLabJobStore {
  readonly mode = 'postgres';
  readonly durable = true;

  constructor(private readonly options: PostgresStoryLabJobStoreOptions) {}

  isConfigured(): boolean {
    return Boolean(this.getDatabaseUrl() && this.options.executor);
  }

  async createJob<TPublicResult = unknown>(
    input: CreateStoryLabJobInput
  ): Promise<StoryLabJobCreationResponse<TPublicResult>> {
    this.assertReady();
    const ownerUserId = requireOwnerUserId(input.ownerUserId);
    const now = input.now ?? this.getNow();
    const jobId = this.createJobId();
    const job: StoryLabJob<TPublicResult> = {
      jobId,
      kind: input.kind,
      status: 'queued',
      currentStep: input.currentStep ?? 'queued',
      progressPercent: 0,
      createdAt: now,
      updatedAt: now
    };
    const response = createResponse(job);
    const event = this.createSnapshotEvent(job, now);

    try {
      await this.executor().query(INSERT_JOB_SQL, [
        job.jobId,
        ownerUserId,
        job.kind,
        job.status,
        job.currentStep,
        job.progressPercent,
        input.idempotencyKey ?? null,
        input.storyId ?? null,
        JSON.stringify(input.request ?? {}),
        job.createdAt,
        job.updatedAt
      ]);
      await this.insertEvent(job.jobId, ownerUserId, event, now);
      return clone(response);
    } catch (error) {
      throw storageError('create_job', error);
    }
  }

  async updateJob<TPublicResult = unknown>(
    jobId: string,
    input: UpdateStoryLabJobInput<TPublicResult>
  ): Promise<StoryLabJobCreationResponse<TPublicResult> | null> {
    this.assertReady();
    assertValidJobId(jobId);
    const ownerUserId = requireOwnerUserId(input.ownerUserId);
    const now = input.now ?? this.getNow();

    try {
      const result = await this.executor().query<StoryLabJobRow>(UPDATE_JOB_SQL, [
        jobId,
        ownerUserId,
        input.status,
        input.currentStep,
        normalizeProgressPercent(input.progressPercent),
        nullableJson(input.result),
        nullableJson(input.error),
        now
      ]);
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const job = jobFromRow<TPublicResult>(row);
      const event = this.createSnapshotEvent(job, now);
      await this.insertEvent(jobId, ownerUserId, event, now);
      return clone(createResponse(job));
    } catch (error) {
      throw storageError('update_job', error);
    }
  }

  async getJob<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): Promise<StoryLabJobCreationResponse<TPublicResult> | null> {
    this.assertReady();
    assertValidJobId(jobId);
    const ownerUserId = requireOwnerUserId(input.ownerUserId);

    try {
      const result = await this.executor().query<StoryLabJobRow>(LOAD_JOB_SQL, [jobId, ownerUserId]);
      const row = result.rows[0];
      return row ? createResponse(jobFromRow<TPublicResult>(row)) : null;
    } catch (error) {
      throw storageError('get_job', error);
    }
  }

  async getEvents<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): Promise<StoryLabJobEvent<TPublicResult>[] | null> {
    this.assertReady();
    assertValidJobId(jobId);
    const ownerUserId = requireOwnerUserId(input.ownerUserId);

    try {
      const result = await this.executor().query<StoryLabJobEventRow>(LOAD_EVENTS_SQL, [jobId, ownerUserId]);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows.map(row => eventFromRow<TPublicResult>(row)).filter((event): event is StoryLabJobEvent<TPublicResult> => Boolean(event));
    } catch (error) {
      throw storageError('get_events', error);
    }
  }

  private async insertEvent<TPublicResult>(
    jobId: string,
    ownerUserId: string,
    event: StoryLabJobEvent<TPublicResult>,
    now: string
  ): Promise<void> {
    for (let attempt = 1; attempt <= MAX_EVENT_INSERT_ATTEMPTS; attempt += 1) {
      try {
        await this.executor().query(INSERT_EVENT_SQL, [
          jobId,
          ownerUserId,
          JSON.stringify(event),
          now
        ]);
        return;
      } catch (error) {
        if (!isJobEventSequenceConflict(error) || attempt === MAX_EVENT_INSERT_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private assertReady(): void {
    if (!this.getDatabaseUrl()) {
      throw new StoryLabJobStoreError(
        'STORY_LAB_JOB_STORAGE_UNCONFIGURED',
        'Story Lab job storage is not configured.'
      );
    }

    if (!this.options.executor) {
      throw new StoryLabJobStoreError(
        'STORY_LAB_JOB_STORAGE_DRIVER_MISSING',
        'Story Lab job storage driver is not configured.'
      );
    }
  }

  private getDatabaseUrl(): string {
    if (this.options.databaseUrl !== undefined) {
      return this.options.databaseUrl;
    }

    if (this.options.env) {
      return this.options.env['DATABASE_URL'] ?? '';
    }

    return process.env['DATABASE_URL'] ?? '';
  }

  private getNow(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private createJobId(): string {
    const jobId = this.options.jobIdFactory?.() ?? createOpaqueStoryLabJobId();
    assertValidJobId(jobId);
    return jobId;
  }

  private createSnapshotEvent<TPublicResult>(
    job: StoryLabJob<TPublicResult>,
    emittedAt: string
  ): StoryLabJobEvent<TPublicResult> {
    return {
      eventId: this.options.eventIdFactory?.() ?? `event_${randomUUID()}`,
      type: 'snapshot',
      emittedAt,
      job: clone(job)
    };
  }

  private executor(): StoryLabCloudQueryExecutor {
    const executor = this.options.executor;
    if (!executor) {
      throw new Error('Postgres job executor missing after readiness check.');
    }
    return executor;
  }
}

function createResponse<TPublicResult>(
  job: StoryLabJob<TPublicResult>
): StoryLabJobCreationResponse<TPublicResult> {
  return {
    job,
    paths: buildStoryLabJobPaths(job.jobId),
    durability: POSTGRES_STORY_LAB_JOB_DURABILITY
  };
}

function jobFromRow<TPublicResult>(row: StoryLabJobRow): StoryLabJob<TPublicResult> {
  return {
    jobId: row.job_id,
    kind: row.kind,
    status: row.status,
    currentStep: row.current_step,
    progressPercent: normalizeProgressPercent(Number(row.progress_percent)),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    result: jsonValue<TPublicResult>(row.result_json),
    error: jsonValue<StoryLabJobError>(row.error_json)
  };
}

function eventFromRow<TPublicResult>(row: StoryLabJobEventRow): StoryLabJobEvent<TPublicResult> | null {
  const value = row.event_json;
  if (!value || typeof value !== 'object') {
    return null;
  }
  return clone(value as StoryLabJobEvent<TPublicResult>);
}

function requireOwnerUserId(ownerUserId: string | undefined): string {
  const normalized = ownerUserId?.trim();
  if (!normalized) {
    throw new StoryLabJobStoreError(
      'STORY_LAB_JOB_OWNER_REQUIRED',
      'Story Lab job storage requires an authenticated owner.'
    );
  }
  return normalized;
}

function assertValidJobId(jobId: string): void {
  if (!assertOpaqueStoryLabJobId(jobId)) {
    throw new StoryLabJobStoreError(
      'STORY_LAB_JOB_STORAGE_FAILED',
      'Story Lab job storage received an invalid job id.'
    );
  }
}

function nullableJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function jsonValue<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return clone(value as T);
}

function normalizeProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function storageError(operation: string, error?: unknown): StoryLabJobStoreError {
  logWarn('Story Lab job storage operation failed', {
    endpoint: '/api/story-lab/jobs'
  }, {
    operation,
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode: typeof (error as { code?: unknown } | null)?.code === 'string'
      ? (error as { code: string }).code
      : undefined
  });
  return new StoryLabJobStoreError(
    'STORY_LAB_JOB_STORAGE_FAILED',
    'Story Lab job storage failed.'
  );
}

function isJobEventSequenceConflict(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    constraint?: unknown;
    message?: unknown;
  } | null;
  if (candidate?.code !== '23505') {
    return false;
  }

  return candidate.constraint === 'story_lab_job_events_job_sequence_idx'
    || String(candidate.message ?? '').includes('story_lab_job_events_job_sequence_idx')
    || String(candidate.message ?? '').includes('sequence_number');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
