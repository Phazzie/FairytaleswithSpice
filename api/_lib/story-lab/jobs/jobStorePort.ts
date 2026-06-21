// Created: 2026-06-08 12:30 EDT

import type {
  StoryLabJobCreationResponse,
  StoryLabJobError,
  StoryLabJobEvent,
  StoryLabJobKind,
  StoryLabJobStatus
} from '../contracts';

export type StoryLabJobStorageMode = 'non_durable_memory' | 'postgres';
export type MaybePromise<T> = T | Promise<T>;

export interface CreateStoryLabJobInput {
  kind: StoryLabJobKind;
  ownerUserId?: string;
  currentStep?: string;
  idempotencyKey?: string;
  storyId?: string;
  request?: unknown;
  now?: string;
}

export interface UpdateStoryLabJobInput<TPublicResult = unknown> {
  ownerUserId?: string;
  status: StoryLabJobStatus;
  currentStep: string;
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
