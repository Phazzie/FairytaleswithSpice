#!/usr/bin/env tsx
// Created: 2026-06-07 07:17 EDT

import createJobHandler from '../api/story-lab/jobs';
import getJobHandler from '../api/story-lab/jobs/[jobId]';
import eventsHandler from '../api/story-lab/jobs/[jobId]/events';
import type { StoryGenerationSeam, StoryLabJobCreationRequest } from '../api/_lib/story-lab/contracts';
import { nonDurableStoryLabJobStore } from '../api/_lib/story-lab/jobs/jobStore';

interface FakeRequest {
  method: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  chunks: string[] = [];
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): FakeResponse {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  writeHead(statusCode: number, headers: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = {
      ...this.headers,
      ...headers
    };
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  end(): void {
    this.ended = true;
  }
}

const originalEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  VERCEL_ENV: process.env['VERCEL_ENV'],
  STORY_LAB_FORCE_MOCK: process.env['STORY_LAB_FORCE_MOCK'],
  XAI_API_KEY: process.env['XAI_API_KEY']
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createRequest(method: string, body?: unknown, jobId?: string): FakeRequest {
  return {
    method,
    body,
    query: jobId ? { jobId } : {},
    url: jobId ? `/api/story-lab/jobs/${encodeURIComponent(jobId)}` : '/api/story-lab/jobs',
    headers: {}
  };
}

function createBlueprint(logline = 'Private moonlit vault bargain.'): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [
      {
        id: 'forbidden_love',
        label: 'Forbidden Love',
        description: 'A romance that risks court punishment.'
      }
    ],
    logline,
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
}

function createGenesisJobRequest(logline?: string): StoryLabJobCreationRequest {
  return {
    kind: 'genesis',
    blueprint: createBlueprint(logline),
    projectId: 'project_private',
    storyId: 'story_private',
    idempotencyKey: 'client-key-1'
  };
}

function setMockRuntime(): void {
  process.env['NODE_ENV'] = 'test';
  delete process.env['VERCEL_ENV'];
  process.env['STORY_LAB_FORCE_MOCK'] = '1';
  delete process.env['XAI_API_KEY'];
}

function setProductionMissingProviderRuntime(): void {
  process.env['NODE_ENV'] = 'production';
  process.env['VERCEL_ENV'] = 'production';
  delete process.env['STORY_LAB_FORCE_MOCK'];
  delete process.env['XAI_API_KEY'];
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function postGenesisJob(request = createGenesisJobRequest()): Promise<FakeResponse> {
  const response = new FakeResponse();
  await createJobHandler(createRequest('POST', request), response);
  return response;
}

async function testGenesisJobCompletesInMockMode(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const privateLogline = 'Private moonlit vault bargain with sk-test-hidden clue.';
  const response = await postGenesisJob(createGenesisJobRequest(privateLogline));

  assert(response.statusCode === 200, 'genesis job create should return 200');
  const body = response.body as any;
  assert(body.success === true, 'genesis job response should be successful');
  assert(body.data.job.jobId.startsWith('job_'), 'genesis job should expose an opaque job id');
  assert(body.data.job.status === 'completed', 'genesis job should complete in mock mode');
  assert(body.data.job.result.summary.storyId, 'completed genesis job should include the story payload');
  assert(body.data.durability.mode === 'non_durable_memory', 'job response should label non-durable storage');
  assert(!body.data.paths.statusPath.includes(privateLogline), 'status path should not contain private logline');
  assert(!body.data.paths.statusPath.includes('vampire'), 'status path should not contain story semantics');

  const statusResponse = new FakeResponse();
  await getJobHandler(createRequest('GET', undefined, body.data.job.jobId), statusResponse);
  assert(statusResponse.statusCode === 200, 'known job id should return 200');
  const statusBody = statusResponse.body as any;
  assert(statusBody.data.job.status === 'completed', 'status route should return the completed snapshot');
}

async function testEventsReplaySnapshotsAndClose(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const response = await postGenesisJob();
  const jobId = (response.body as any).data.job.jobId as string;
  const eventsResponse = new FakeResponse();
  await eventsHandler(createRequest('GET', undefined, jobId), eventsResponse);

  assert(eventsResponse.statusCode === 200, 'events route should return 200 for known job id');
  assert(eventsResponse.headers['Content-Type'] === 'text/event-stream', 'events route should use SSE content type');
  const output = eventsResponse.chunks.join('');
  assert(output.includes('"status":"queued"'), 'events stream should replay queued snapshot');
  assert(output.includes('"status":"running"'), 'events stream should replay running snapshot');
  assert(output.includes('"status":"completed"'), 'events stream should replay completed snapshot');
  assert(eventsResponse.ended, 'events response should close after replaying current snapshots');
}

async function testInvalidAndUnknownJobIds(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const invalidResponse = new FakeResponse();
  await getJobHandler(createRequest('GET', undefined, 'job_<script>'), invalidResponse);
  assert(invalidResponse.statusCode === 400, 'invalid job ids should return 400');

  const unknownResponse = new FakeResponse();
  await getJobHandler(createRequest('GET', undefined, 'job_00000000-0000-4000-8000-000000000000'), unknownResponse);
  assert(unknownResponse.statusCode === 404, 'unknown valid job ids should return 404');
}

async function testReservedJobKindsAreRejected(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const response = new FakeResponse();
  await createJobHandler(createRequest('POST', { kind: 'audio', storyId: 'story_private' }), response);
  assert(response.statusCode === 400, 'reserved audio job should return 400');
  const body = response.body as any;
  assert(body.error.code === 'UNSUPPORTED_JOB_KIND', 'reserved job response should explain unsupported kind');
}

async function testProductionMissingProviderCreatesFailedJob(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setProductionMissingProviderRuntime();

  const response = await postGenesisJob();

  assert(response.statusCode === 200, 'job creation should still return a job envelope when work fails');
  const body = response.body as any;
  assert(body.success === true, 'failed work should still be represented by a successful job envelope');
  assert(body.data.job.status === 'failed', 'missing production provider should fail the job');
  assert(body.data.job.error.code === 'AI_UNAVAILABLE', 'failed job should expose the engine error code');
  assert(body.data.job.result === undefined, 'failed job should not include a story result');
}

async function run(): Promise<void> {
  await testGenesisJobCompletesInMockMode();
  await testEventsReplaySnapshotsAndClose();
  await testInvalidAndUnknownJobIds();
  await testReservedJobKindsAreRejected();
  await testProductionMissingProviderCreatesFailedJob();

  console.log('Story Lab job route tests passed');
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    restoreEnv();
  });
