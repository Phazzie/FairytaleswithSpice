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
import type { StoryGenerationSeam, StoryLabJobKind, StoryLabJobStatus } from '../api/_lib/story-lab/contracts';
import {
  STORY_LAB_DEFERRED_JOB_KINDS,
  STORY_LAB_GENERATION_JOB_KINDS,
  STORY_LAB_TERMINAL_JOB_STATUSES,
  isDeferredStoryLabJobKind,
  isTerminalStoryLabJobStatus
} from '../api/_lib/story-lab/contracts';
import { readFileSync } from 'node:fs';

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

// ==================== terminal statuses ====================
// The set of statuses a job does not leave was decided in three places at once
// — the event stream's close, the workbench's "is this over", and the SQL that
// stamps `completed_at` — each with its own copy of the same three names beside
// a union of six. Each assertion below is one of those three readers proving it
// reads the list rather than a copy.

assert(
  isTerminalStoryLabJobStatus('completed')
    && isTerminalStoryLabJobStatus('failed')
    && isTerminalStoryLabJobStatus('cancelled'),
  'a finished job should read as finished however it finished'
);
assert(
  !isTerminalStoryLabJobStatus('queued')
    && !isTerminalStoryLabJobStatus('running')
    && !isTerminalStoryLabJobStatus('waiting_for_review'),
  'a job still in flight should not read as finished'
);

// `waiting_for_review` is the status that makes this worth asserting: it is the
// one of the six that arrived after the other five, and the one a fourth
// terminal status would arrive the same way as.
const everyStatus: StoryLabJobStatus[] = [
  'queued',
  'running',
  'waiting_for_review',
  'completed',
  'failed',
  'cancelled'
];
assert(
  everyStatus.filter(isTerminalStoryLabJobStatus).length === STORY_LAB_TERMINAL_JOB_STATUSES.length,
  'the terminal list should name terminal statuses and nothing else'
);

// The SQL is the third reader, and the only one a type cannot check: it is a
// string. So it is asserted here that the statement quotes the list rather than
// restating it, which is the whole reason `TERMINAL_JOB_STATUS_SQL_LIST` exists.
const postgresJobStoreSource = readFileSync(
  new URL('../api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts', import.meta.url),
  'utf8'
);
assert(
  postgresJobStoreSource.includes('${TERMINAL_JOB_STATUS_SQL_LIST}'),
  'the update statement should take its terminal statuses from the shared list'
);
for (const status of STORY_LAB_TERMINAL_JOB_STATUSES) {
  assert(
    !postgresJobStoreSource.includes(`in ('${status}'`),
    `the update statement should not restate ${status} by hand`
  );
}

// ==================== the kinds this scaffold runs, and the ones it defers ====================
// `StoryLabJobKind` has four members and these routes serve two: `POST
// /api/story-lab/jobs` answers `export` and `audio` with `UNSUPPORTED_JOB_KIND`
// and reserves them for the durable runner. That split is the vocabulary the
// code actually works in, and it had no name — so the pair was written out by
// hand in three places, the worst of them a local `type StoryLabJobKind =
// 'genesis' | 'continuation'` in `AppComponent` shadowing the contract's own
// four-member union for that whole file. A narrower union is assignable to a
// wider one, so nothing reported it.

const everyJobKind: StoryLabJobKind[] = ['genesis', 'continuation', 'export', 'audio'];

assert(
  everyJobKind.filter(isDeferredStoryLabJobKind).length === STORY_LAB_DEFERRED_JOB_KINDS.length,
  'the deferred list should name deferred kinds and nothing else'
);
assert(
  everyJobKind.length === STORY_LAB_GENERATION_JOB_KINDS.length + STORY_LAB_DEFERRED_JOB_KINDS.length,
  'every job kind should be either one these routes run or one they defer — a fifth needs a home'
);
for (const kind of STORY_LAB_GENERATION_JOB_KINDS) {
  assert(
    !isDeferredStoryLabJobKind(kind),
    `${kind} is a kind these routes run and should not read as deferred`
  );
}

// The Angular component is the reader a type could not check while it was
// declaring the name it imports. Read as text for the reason
// `story-lab-picker-vocabulary` gives: it is a component, and the root test
// runner has no `@angular/core`.
const appComponentSource = readFileSync(
  new URL('../story-generator/src/app/app.ts', import.meta.url),
  'utf8'
);
assert(
  !/type\s+StoryLabJobKind\s*=/.test(appComponentSource),
  'the component should read the contract\'s job-kind vocabulary rather than declare one over it'
);

// And the route's refusal, which named the deferred kinds in prose beside a
// branch that matched them as two literals.
const jobRouteHandlersSource = readFileSync(
  new URL('../api/_lib/story-lab/jobs/jobRouteHandlers.ts', import.meta.url),
  'utf8'
);
for (const kind of STORY_LAB_DEFERRED_JOB_KINDS) {
  assert(
    !jobRouteHandlersSource.includes(`request.kind === '${kind}'`),
    `the route should refuse ${kind} by reading the deferred list, not by matching it`
  );
}

console.log('Story Lab job contract tests passed');
