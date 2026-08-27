// Created: 2026-06-08 12:30 EDT

import type {
  StoryLabJobCreationResponse,
  StoryLabJobError,
  StoryLabJobEvent,
  StoryLabJobKind,
  StoryLabJobStatus,
  StoryLabJobStep
} from '../contracts';

export type StoryLabJobStorageMode = 'non_durable_memory' | 'postgres';
export type MaybePromise<T> = T | Promise<T>;

export interface CreateStoryLabJobInput {
  kind: StoryLabJobKind;
  ownerUserId?: string;
  /** A step from `STORY_LAB_JOB_STEPS`; omitted means `'queued'`. */
  currentStep?: StoryLabJobStep;
  idempotencyKey?: string;
  storyId?: string;
  request?: unknown;
  now?: string;
}

export interface UpdateStoryLabJobInput<TPublicResult = unknown> {
  ownerUserId?: string;
  status: StoryLabJobStatus;
  /**
   * The step this update moves the job onto, from `STORY_LAB_JOB_STEPS`.
   *
   * This is the field that makes the vocabulary closed. Every writer in the
   * repository goes through here, so a step that is not in the table cannot be
   * stored, and the reader's `STORY_LAB_JOB_STEP_LABELS` — total by type — has
   * a sentence for every step that can be.
   */
  currentStep: StoryLabJobStep;
  progressPercent: number;
  result?: TPublicResult;
  error?: StoryLabJobError;
  now?: string;
}

export interface ReadStoryLabJobInput {
  ownerUserId?: string;
}

export interface StoryLabJobStore {
  readonly mode: StoryLabJobStorageMode;
  readonly durable: boolean;
  isConfigured(): boolean;
  createJob<TPublicResult = unknown>(input: CreateStoryLabJobInput): MaybePromise<StoryLabJobCreationResponse<TPublicResult>>;
  updateJob<TPublicResult = unknown>(
    jobId: string,
    input: UpdateStoryLabJobInput<TPublicResult>
  ): MaybePromise<StoryLabJobCreationResponse<TPublicResult> | null>;
  getJob<TPublicResult = unknown>(
    jobId: string,
    input?: ReadStoryLabJobInput
  ): MaybePromise<StoryLabJobCreationResponse<TPublicResult> | null>;
  getEvents<TPublicResult = unknown>(
    jobId: string,
    input?: ReadStoryLabJobInput
  ): MaybePromise<StoryLabJobEvent<TPublicResult>[] | null>;
}
