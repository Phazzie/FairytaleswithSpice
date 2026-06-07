#!/usr/bin/env tsx
// Created: 2026-06-05 02:20 EDT

import {
  assertOpaqueStoryLabJobId,
  buildStoryLabJobPaths,
  createOpaqueStoryLabJobId,
  NON_DURABLE_STORY_LAB_JOB_DURABILITY,
  StoryLabJob,
  StoryLabJobCreationRequest
} from '../api/_lib/story-lab/jobs/jobContracts';
import type { StoryGenerationSeam } from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  let thrown = false;
  try {
    fn();
  } catch {
    thrown = true;
  }

  assert(thrown, message);
}

const uuid = '00000000-0000-4000-8000-000000000000';
const jobId = createOpaqueStoryLabJobId(uuid);
assert(jobId === `job_${uuid}`, 'job id should prefix a UUID with job_');
assert(assertOpaqueStoryLabJobId(jobId), 'generated job id should be valid');
assert(assertOpaqueStoryLabJobId(`job_${uuid.toUpperCase()}`), 'valid UUID casing should be accepted');
assert(!assertOpaqueStoryLabJobId('story_123'), 'story ids should not be valid job ids');
assert(!assertOpaqueStoryLabJobId('job_<script>'), 'markup should not be valid job ids');
assert(!assertOpaqueStoryLabJobId('job_abc?logline=private'), 'query-shaped job ids should not be valid');
assert(!assertOpaqueStoryLabJobId('job_vampire-secret-logline'), 'semantic job ids should not be valid');
assertThrows(() => createOpaqueStoryLabJobId('story_123'), 'creating a job id from a story id should fail');
assertThrows(() => buildStoryLabJobPaths('job_abc?logline=private'), 'paths should reject invalid job ids');

const paths = buildStoryLabJobPaths(jobId);
assert(paths.statusPath === `/api/story-lab/jobs/${jobId}`, 'status path should contain only the opaque job id');
assert(paths.eventsPath === `/api/story-lab/jobs/${jobId}/events`, 'events path should contain only the opaque job id');
assert(!paths.statusPath.includes('?'), 'status path should not use query strings');
assert(!paths.eventsPath.includes('?'), 'events path should not use query strings');

const privateTerms = [
  'story_private',
  'vampire',
  'logline',
  'noGo',
  'secret@example.com',
  'sk-test',
  'Private Title'
];
const combinedPathText = `${paths.statusPath}\n${paths.eventsPath}\n${jobId}`;
for (const privateTerm of privateTerms) {
  assert(!combinedPathText.includes(privateTerm), `job path should not include private term ${privateTerm}`);
}

const blueprint: StoryGenerationSeam['input'] = {
  creature: 'vampire',
  themes: [
    {
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'Desire has consequences.'
    }
  ],
  logline: 'Private Title should stay out of job paths.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 900,
  chapterBatchSize: 1,
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'No coercion.'
  }
};
const creationRequest: StoryLabJobCreationRequest = {
  kind: 'genesis',
  blueprint,
  projectId: 'project_private',
  storyId: 'story_private',
  idempotencyKey: 'client-key-1'
};
const job: StoryLabJob<{ storyId: string }> = {
  jobId,
  kind: creationRequest.kind,
  status: 'queued',
  currentStep: 'queued',
  progressPercent: 0,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
  result: { storyId: 'story_public_reference' }
};
assert(job.jobId === jobId, 'job contract should carry the opaque id');
assert(job.kind === 'genesis', 'job contract should carry the job kind');
assert(job.status === 'queued', 'job contract should carry the job status');
assert(NON_DURABLE_STORY_LAB_JOB_DURABILITY.mode === 'non_durable_memory', 'job scaffold should be explicitly non-durable');
assert(!NON_DURABLE_STORY_LAB_JOB_DURABILITY.durable, 'job scaffold should not claim durable storage');

console.log('Story Lab job contract tests passed');
