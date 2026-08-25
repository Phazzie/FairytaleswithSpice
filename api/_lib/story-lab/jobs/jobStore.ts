// Created: 2026-06-07 06:55 EDT

import { randomUUID } from 'node:crypto';
import type {
  StoryLabJob,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
} from '../contracts';
import type { CreateStoryLabJobInput, ReadStoryLabJobInput, StoryLabJobStore, UpdateStoryLabJobInput } from './jobStorePort';
import {
  buildStoryLabJobPaths,
  createOpaqueStoryLabJobId,
  NON_DURABLE_STORY_LAB_JOB_DURABILITY
} from './jobContracts';

export type { CreateStoryLabJobInput, UpdateStoryLabJobInput } from './jobStorePort';

interface StoredStoryLabJob<TPublicResult = unknown> {
  ownerUserId?: string;
  response: StoryLabJobCreationResponse<TPublicResult>;
  events: StoryLabJobEvent<TPublicResult>[];
}

const DEFAULT_MAX_STORY_LAB_JOBS = 1000;

export class NonDurableStoryLabJobStore implements StoryLabJobStore {
  readonly mode = 'non_durable_memory';
  readonly durable = false;
  private readonly jobs = new Map<string, StoredStoryLabJob>();

  constructor(private readonly maxJobs = DEFAULT_MAX_STORY_LAB_JOBS) {}

  isConfigured(): boolean {
    return true;
  }

  createJob<TPublicResult = unknown>(input: CreateStoryLabJobInput): StoryLabJobCreationResponse<TPublicResult> {
    const now = input.now ?? new Date().toISOString();
    const job: StoryLabJob<TPublicResult> = {
      jobId: createOpaqueStoryLabJobId(),
      kind: input.kind,
      status: 'queued',
      currentStep: input.currentStep ?? 'queued',
      progressPercent: 0,
      createdAt: now,
      updatedAt: now
    };
    const response: StoryLabJobCreationResponse<TPublicResult> = {
      job,
      paths: buildStoryLabJobPaths(job.jobId),
      durability: NON_DURABLE_STORY_LAB_JOB_DURABILITY
    };
    const stored: StoredStoryLabJob<TPublicResult> = {
      ownerUserId: input.ownerUserId,
      response: clone(response),
      events: [createSnapshotEvent(job, now)]
    };
    this.jobs.set(job.jobId, stored);
    this.evictLeastRecentlyUsedJobs();

    return clone(response);
  }

  updateJob<TPublicResult = unknown>(
    jobId: string,
    input: UpdateStoryLabJobInput<TPublicResult>
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    if (!stored) {
      return null;
    }
    if (!canAccessStoredJob(stored, input)) {
      return null;
    }

    const now = input.now ?? new Date().toISOString();
    const job: StoryLabJob<TPublicResult> = {
      ...stored.response.job,
      status: input.status,
      currentStep: input.currentStep,
      progressPercent: normalizeProgressPercent(input.progressPercent),
      updatedAt: now,
      result: input.result,
      error: input.error
    };
    const response: StoryLabJobCreationResponse<TPublicResult> = {
      ...stored.response,
      job
    };

    stored.response = clone(response);
    stored.events.push(createSnapshotEvent(job, now));
    this.markJobAsRecentlyUsed(jobId, stored);

    return clone(response);
  }

  getJob<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    const stored = this.readStoredJob<TPublicResult>(jobId, input);

    return stored ? clone(stored.response) : null;
  }

  getEvents<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): StoryLabJobEvent<TPublicResult>[] | null {
    const stored = this.readStoredJob<TPublicResult>(jobId, input);

    return stored ? clone(stored.events) : null;
  }

  reset(): void {
    this.jobs.clear();
  }

  /**
   * Look a job up for a reader, and count the lookup as a use.
   *
   * A job the caller may not read is not a use of it: an unauthorized probe
   * must not be able to keep someone else's job alive, or to reorder the
   * eviction queue at all.
   */
  private readStoredJob<TPublicResult>(
    jobId: string,
    input: ReadStoryLabJobInput
  ): StoredStoryLabJob<TPublicResult> | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    if (!stored || !canAccessStoredJob(stored, input)) {
      return null;
    }

    this.markJobAsRecentlyUsed(jobId, stored);

    return stored;
  }

  /**
   * Move a job to the newest end of the eviction order.
   *
   * A `Map` orders by first insertion and re-setting an existing key does not
   * move it, so eviction without this was by job *age*. The route creates a job,
   * marks it `running`, and only then does the work — a generation that takes
   * tens of seconds — so the job being worked on is always among the oldest in
   * the map. On a warm instance at capacity it was therefore the first one
   * dropped, ahead of jobs created after it and already finished: `updateJob`
   * then found nothing and returned `null`, and the route answered 503
   * `STORY_LAB_JOB_STORAGE_FAILED` for a generation that had actually
   * succeeded, while a client polling `/jobs/{id}` or its event stream was
   * answered 404 for a job still in flight.
   *
   * Deleting before setting is what makes the order least-recently-used, and a
   * read counts as a use because polling a job is how a client waits for one.
   * The sibling transient snapshot store orders itself the same way.
   */
  private markJobAsRecentlyUsed(jobId: string, stored: StoredStoryLabJob): void {
    this.jobs.delete(jobId);
    this.jobs.set(jobId, stored);
  }

  /**
   * Trim the store back to its bound, oldest use first.
   *
   * Run after the insert rather than before it — the same `maxJobs` jobs are
   * kept either way, but "hold at most `maxJobs`" is what the loop now says,
   * rather than "make room for one below `maxJobs`, then add one".
   */
  private evictLeastRecentlyUsedJobs(): void {
    while (this.jobs.size > this.maxJobs) {
      const oldestJobId = this.jobs.keys().next().value;
      if (oldestJobId === undefined) {
        return;
      }

      this.jobs.delete(oldestJobId);
    }
  }
}

export const nonDurableStoryLabJobStore = new NonDurableStoryLabJobStore();

function canAccessStoredJob(stored: StoredStoryLabJob, input: ReadStoryLabJobInput): boolean {
  if (stored.ownerUserId === undefined) {
    return true;
  }

  return input.ownerUserId !== undefined && stored.ownerUserId === input.ownerUserId;
}

function createSnapshotEvent<TPublicResult>(
  job: StoryLabJob<TPublicResult>,
  emittedAt: string
): StoryLabJobEvent<TPublicResult> {
  return {
    eventId: `event_${randomUUID()}`,
    type: 'snapshot',
    emittedAt,
    job: clone(job)
  };
}

function normalizeProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
