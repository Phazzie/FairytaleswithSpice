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
    this.evictOldestJobIfNeeded();

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
    this.jobs.set(jobId, stored);

    return clone(response);
  }

  getJob<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    if (stored && !canAccessStoredJob(stored, input)) {
      return null;
    }

    return stored ? clone(stored.response) : null;
  }

  getEvents<TPublicResult = unknown>(
    jobId: string,
    input: ReadStoryLabJobInput = {}
  ): StoryLabJobEvent<TPublicResult>[] | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    if (stored && !canAccessStoredJob(stored, input)) {
      return null;
    }

    return stored ? clone(stored.events) : null;
  }

  reset(): void {
    this.jobs.clear();
  }

  private evictOldestJobIfNeeded(): void {
    while (this.jobs.size >= this.maxJobs) {
      const oldestJobId = this.jobs.keys().next().value;
      if (!oldestJobId) {
        return;
      }

      this.jobs.delete(oldestJobId);
    }
  }
}

export const nonDurableStoryLabJobStore = new NonDurableStoryLabJobStore();

function canAccessStoredJob(stored: StoredStoryLabJob, input: ReadStoryLabJobInput): boolean {
  return input.ownerUserId === undefined || stored.ownerUserId === input.ownerUserId;
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
