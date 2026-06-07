// Created: 2026-06-07 06:55 EDT

import { randomUUID } from 'node:crypto';
import type {
  StoryLabJob,
  StoryLabJobCreationResponse,
  StoryLabJobError,
  StoryLabJobEvent,
  StoryLabJobKind,
  StoryLabJobStatus
} from '../contracts';
import {
  buildStoryLabJobPaths,
  createOpaqueStoryLabJobId,
  NON_DURABLE_STORY_LAB_JOB_DURABILITY
} from './jobContracts';

export interface CreateStoryLabJobInput {
  kind: StoryLabJobKind;
  currentStep?: string;
  now?: string;
}

export interface UpdateStoryLabJobInput<TPublicResult = unknown> {
  status: StoryLabJobStatus;
  currentStep: string;
  progressPercent: number;
  result?: TPublicResult;
  error?: StoryLabJobError;
  now?: string;
}

interface StoredStoryLabJob<TPublicResult = unknown> {
  response: StoryLabJobCreationResponse<TPublicResult>;
  events: StoryLabJobEvent<TPublicResult>[];
}

export class NonDurableStoryLabJobStore {
  private readonly jobs = new Map<string, StoredStoryLabJob>();

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

  getJob<TPublicResult = unknown>(jobId: string): StoryLabJobCreationResponse<TPublicResult> | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    return stored ? clone(stored.response) : null;
  }

  getEvents<TPublicResult = unknown>(jobId: string): StoryLabJobEvent<TPublicResult>[] | null {
    const stored = this.jobs.get(jobId) as StoredStoryLabJob<TPublicResult> | undefined;
    return stored ? clone(stored.events) : null;
  }

  reset(): void {
    this.jobs.clear();
  }
}

export const nonDurableStoryLabJobStore = new NonDurableStoryLabJobStore();

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
