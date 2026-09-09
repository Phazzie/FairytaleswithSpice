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
import { STORY_LAB_TERMINAL_JOB_STATUSES } from '../contracts';
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

/**
 * The terminal statuses as a SQL list, built from
 * `STORY_LAB_TERMINAL_JOB_STATUSES` rather than written out in the statement.
 *
 * The values are the contract's own literals — no caller string reaches this —
 * and quoting them here is what lets the one list decide when `completed_at` is
 * stamped, the same way it decides when the event stream closes and when the
 * workbench stops waiting. See that constant for what the three separate copies
 * of this set could not do.
 */
const TERMINAL_JOB_STATUS_SQL_LIST = STORY_LAB_TERMINAL_JOB_STATUSES
  .map(status => `'${status}'`)
  .join(', ');

/**
 * Writes the job row and its append-only event snapshot as ONE statement via a
 * CTE, instead of two separate `query()` round trips. The Neon HTTP executor
 * behind `StoryLabCloudQueryExecutor` has no cross-call transaction — each
 * `query()` call commits on its own — so two separate writes here previously
 * meant a job could finish `completed` in Postgres (already billed, real
 * result) while the event-log write that followed it failed and the whole
 * `updateJob` call threw, which every caller in `jobRouteHandlers.ts` turns
 * into a client-facing 503 for a job that had, in fact, already succeeded. A
 * single statement is atomic by definition: either both rows land or neither
 * does, and the caller's failure and the database's state can no longer
 * disagree.
 *
 * Retrying the *whole* statement on an event sequence-number race (see
 * `writeJobAndEvent` below) needs no special idempotency handling on either
 * leg: a failed CTE statement is one failed Postgres statement, so a failed
 * attempt's job insert/update is rolled back along with its event insert —
 * nothing from it is left committed for the next attempt to collide with.
 * `CREATE_JOB_SQL`'s insert is deliberately left to fail on a genuine
 * duplicate `job_id` (not a retry of its own attempt), the same as before
 * this change; an `ON CONFLICT` upsert there would silently attach a new
 * caller's event onto a pre-existing, possibly different-owner job instead.
 */
const CREATE_JOB_SQL = `
with inserted as (
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
  returning job_id, owner_user_id
),
event_insert as (
  insert into story_lab_job_events (job_id, owner_user_id, sequence_number, event_json, created_at)
  select
    i.job_id,
    i.owner_user_id,
    (select coalesce(max(sequence_number), 0) + 1 from story_lab_job_events where job_id = i.job_id),
    $12::jsonb,
    $10
  from inserted i
  returning job_id
)
select job_id from event_insert
`;

const UPDATE_JOB_SQL = `
with updated as (
  update story_lab_jobs
  set
    status = $3,
    current_step = $4,
    progress_percent = $5,
    result_json = $6::jsonb,
    error_json = $7::jsonb,
    updated_at = $8,
    completed_at = case when $3 in (${TERMINAL_JOB_STATUS_SQL_LIST}) then $8 else completed_at end
  where job_id = $1
    and owner_user_id = $2
  returning job_id, owner_user_id, kind, status, current_step, progress_percent, created_at, updated_at, result_json, error_json
),
event_insert as (
  insert into story_lab_job_events (job_id, owner_user_id, sequence_number, event_json, created_at)
  select
    u.job_id,
    u.owner_user_id,
    (select coalesce(max(sequence_number), 0) + 1 from story_lab_job_events where job_id = u.job_id),
    jsonb_build_object(
      'eventId', $9::text,
      'type', 'snapshot',
      'emittedAt', $8::text,
      'job', (
        jsonb_build_object(
          'jobId', u.job_id,
          'kind', u.kind,
          'status', u.status,
          'currentStep', u.current_step,
          'progressPercent', u.progress_percent,
          'createdAt', u.created_at,
          'updatedAt', u.updated_at
        )
        || case when u.result_json is null then '{}'::jsonb else jsonb_build_object('result', u.result_json) end
        || case when u.error_json is null then '{}'::jsonb else jsonb_build_object('error', u.error_json) end
      )
    ),
    $8
  from updated u
  returning job_id
)
select job_id, owner_user_id, kind, status, current_step, progress_percent, created_at, updated_at, result_json, error_json
from updated
`;

const LOAD_JOB_SQL = `
select job_id, kind, status, current_step, progress_percent, created_at, updated_at, result_json, error_json
from story_lab_jobs
where job_id = $1
  and owner_user_id = $2
limit 1
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
      await this.writeJobAndEvent(CREATE_JOB_SQL, [
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
        job.updatedAt,
        JSON.stringify(event)
      ]);
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
      const result = await this.writeJobAndEvent<StoryLabJobRow>(UPDATE_JOB_SQL, [
        jobId,
        ownerUserId,
        input.status,
        input.currentStep,
        normalizeProgressPercent(input.progressPercent),
        nullableJson(input.result),
        nullableJson(input.error),
        now,
        this.nextEventId()
      ]);
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return clone(createResponse(jobFromRow<TPublicResult>(row)));
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

  /**
   * Runs one of the combined job-write + event-write CTE statements, retrying
   * the whole statement when the event leg's sequence-number subquery races
   * a concurrent write for the same job (see `isJobEventSequenceConflict`
   * below). Retrying the *whole* statement is safe because a failed attempt
   * commits nothing — the job insert/update in a failed CTE statement rolls
   * back along with its event insert, so the next attempt starts clean
   * rather than colliding with a partially-applied previous one.
   */
  private async writeJobAndEvent<T = unknown>(
    sql: string,
    params: readonly unknown[]
  ): Promise<{ rows: T[] }> {
    for (let attempt = 1; attempt <= MAX_EVENT_INSERT_ATTEMPTS; attempt += 1) {
      try {
        return await this.executor().query<T>(sql, params);
      } catch (error) {
        if (!isJobEventSequenceConflict(error) || attempt === MAX_EVENT_INSERT_ATTEMPTS) {
          throw error;
        }
      }
    }
    throw new Error('unreachable: writeJobAndEvent exhausted retries without returning or throwing');
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
      return this.options.databaseUrl.trim();
    }

    if (this.options.env) {
      return (this.options.env['DATABASE_URL'] ?? '').trim();
    }

    return (process.env['DATABASE_URL'] ?? '').trim();
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
      eventId: this.nextEventId(),
      type: 'snapshot',
      emittedAt,
      job: clone(job)
    };
  }

  private nextEventId(): string {
    return this.options.eventIdFactory?.() ?? `event_${randomUUID()}`;
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
