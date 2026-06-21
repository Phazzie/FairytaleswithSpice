// Created: 2026-06-05 02:20 EDT

import { randomUUID } from 'node:crypto';

export type {
  StoryLabJob,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobDurability,
  StoryLabJobError,
  StoryLabJobEvent,
  StoryLabJobKind,
  StoryLabJobPaths,
  StoryLabJobStatus
} from '../contracts';

import type { StoryLabJobDurability, StoryLabJobPaths } from '../contracts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_ID_PATTERN = /^job_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const NON_DURABLE_STORY_LAB_JOB_DURABILITY: StoryLabJobDurability = {
  mode: 'non_durable_memory',
  durable: false,
  warning: 'Story Lab jobs are stored in process memory in this scaffold. They are not durable across serverless cold starts, deploys, or crashes.'
};

export const POSTGRES_STORY_LAB_JOB_DURABILITY: StoryLabJobDurability = {
  mode: 'postgres',
  durable: true,
  warning: 'Story Lab jobs are stored in Postgres, but durable runner behavior still depends on route and workflow integration.'
};

export function createOpaqueStoryLabJobId(randomId = randomUUID()): string {
  const uuid = randomId.startsWith('job_') ? randomId.slice('job_'.length) : randomId;
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error('Story Lab job id seed must be a UUID.');
  }

  return `job_${uuid.toLowerCase()}`;
}

export function assertOpaqueStoryLabJobId(jobId: string): boolean {
  return JOB_ID_PATTERN.test(jobId);
}

export function buildStoryLabJobPaths(jobId: string): StoryLabJobPaths {
  if (!assertOpaqueStoryLabJobId(jobId)) {
    throw new Error('Invalid Story Lab job id.');
  }

  const encodedJobId = encodeURIComponent(jobId);
  return {
    statusPath: `/api/story-lab/jobs/${encodedJobId}`,
    eventsPath: `/api/story-lab/jobs/${encodedJobId}/events`
  };
}
