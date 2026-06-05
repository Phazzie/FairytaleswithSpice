import { randomUUID } from 'node:crypto';

export type StoryLabJobKind = 'genesis' | 'continuation' | 'export' | 'audio';

export type StoryLabJobStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StoryLabJobCreationRequest {
  kind: StoryLabJobKind;
  projectId?: string;
  storyId?: string;
  idempotencyKey?: string;
}

export interface StoryLabJobError {
  code: string;
  message: string;
}

export interface StoryLabJob<TPublicResult = unknown> {
  jobId: string;
  kind: StoryLabJobKind;
  status: StoryLabJobStatus;
  currentStep: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  result?: TPublicResult;
  error?: StoryLabJobError;
}

export interface StoryLabJobPaths {
  statusPath: string;
  eventsPath: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_ID_PATTERN = /^job_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
