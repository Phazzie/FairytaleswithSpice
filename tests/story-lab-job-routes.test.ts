#!/usr/bin/env tsx
// Created: 2026-06-07 07:17 EDT

import jobHandler from '../api/story-lab/jobs';
import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { AuthError } from '../api/_lib/story-lab/auth/authPort';
import type {
  StoryGenerationSeam,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse
} from '../api/_lib/story-lab/contracts';
import { createStoryLabJobsRouteHandler } from '../api/_lib/story-lab/jobs/jobRouteHandlers';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { NonDurableStoryLabJobStore, nonDurableStoryLabJobStore } from '../api/_lib/story-lab/jobs/jobStore';
import { StoryLabJobStoreError } from '../api/_lib/story-lab/jobs/postgresStoryLabJobStore';
import type { CreateStoryLabJobInput, StoryLabJobStore, UpdateStoryLabJobInput } from '../api/_lib/story-lab/jobs/jobStorePort';
import type { StoryLabJobStoreConfig } from '../api/_lib/story-lab/jobs/storyLabJobStoreConfig';

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

  status(code: number): this {
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

  // The lifecycle flag Node sets when the socket underneath the response is
  // gone, and the throw it answers a write with once it is. The events route
  // awaits its store lookups, so a reader can leave before a single frame has
  // been written.
  destroyed = false;

  write(chunk: string): void {
    if (this.destroyed) {
      throw Object.assign(new Error('Cannot call write after a stream was destroyed'), {
        code: 'ERR_STREAM_DESTROYED'
      });
    }

    this.chunks.push(chunk);
  }

  end(): void {
    if (this.destroyed) {
      throw Object.assign(new Error('Cannot call end after a stream was destroyed'), {
        code: 'ERR_STREAM_DESTROYED'
      });
    }

    this.ended = true;
  }
}

const originalEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  VERCEL_ENV: process.env['VERCEL_ENV'],
  STORY_LAB_FORCE_MOCK: process.env['STORY_LAB_FORCE_MOCK'],
  XAI_API_KEY: process.env['XAI_API_KEY'],
  STORY_LAB_JOB_STORE: process.env['STORY_LAB_JOB_STORE'],
  DATABASE_URL: process.env['DATABASE_URL']
};
const owner: AuthUser = {
  userId: 'user_job_owner',
  email: 'owner@example.com'
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createRequest(method: string, body?: unknown, jobId?: string, events = false): FakeRequest {
  // This file drives the same route handler many times to exercise unrelated
  // job-lifecycle and ownership behaviour, sharing the process-wide rate
  // limit store with every other call. Reset it per request rather than let
  // an earlier scenario's budget carry over and fail a later one with 429.
  resetRateLimitsForTests();

  return {
    method,
    body,
    query: jobId ? { jobId, ...(events ? { events: '1' } : {}) } : {},
    url: jobId ? `/api/story-lab/jobs/${encodeURIComponent(jobId)}${events ? '/events' : ''}` : '/api/story-lab/jobs',
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
  delete process.env['STORY_LAB_JOB_STORE'];
  delete process.env['DATABASE_URL'];
}

function setProductionMissingProviderRuntime(): void {
  process.env['NODE_ENV'] = 'production';
  process.env['VERCEL_ENV'] = 'production';
  delete process.env['STORY_LAB_FORCE_MOCK'];
  delete process.env['XAI_API_KEY'];
  delete process.env['STORY_LAB_JOB_STORE'];
  delete process.env['DATABASE_URL'];
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
  await jobHandler(createRequest('POST', request), response);
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
  await jobHandler(createRequest('GET', undefined, body.data.job.jobId), statusResponse);
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
  await jobHandler(createRequest('GET', undefined, jobId, true), eventsResponse);

  assert(eventsResponse.statusCode === 200, 'events route should return 200 for known job id');
  assert(eventsResponse.headers['Content-Type'] === 'text/event-stream', 'events route should use SSE content type');
  const output = eventsResponse.chunks.join('');
  assert(output.includes('"status":"queued"'), 'events stream should replay queued snapshot');
  assert(output.includes('"status":"running"'), 'events stream should replay running snapshot');
  assert(output.includes('"status":"completed"'), 'events stream should replay completed snapshot');
  assert(eventsResponse.ended, 'events response should close after replaying current snapshots');

  // Each snapshot has to be its own event. A frame is dispatched by the blank
  // line that ends it, so a replay whose frames run together is delivered to
  // the client as nothing at all — the route framed its own events by hand,
  // where that terminator is one mis-escaped backslash away from being
  // printable text rather than two newlines.
  const frames = output.split('\n\n');
  assert(frames.pop() === '', 'the last frame of the replay must be terminated');
  assert(frames.length >= 3, `each job snapshot should be its own event, got ${frames.length}`);
  assert(
    frames.every(frame => frame.startsWith('data: ')),
    'every replayed frame should be a `data:` line'
  );
  assert(
    frames.every(frame => {
      try {
        JSON.parse(frame.slice('data: '.length));
        return true;
      } catch {
        return false;
      }
    }),
    'every replayed frame should carry exactly one JSON payload'
  );
}

/**
 * A reader who closes the tab while the route is still reading the job store.
 *
 * The replay is reached only after two awaited store lookups, so the response
 * can be destroyed before the first frame is written. The route wrote anyway —
 * `res.write?.()` guards against the method being absent, not against the
 * stream being closed — and each write answers with `ERR_STREAM_DESTROYED`,
 * thrown out of an async handler with nothing left to catch it.
 */
async function testEventsReplayStopsAtAClosedResponse(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const response = await postGenesisJob();
  const jobId = (response.body as any).data.job.jobId as string;
  const eventsResponse = new FakeResponse();
  eventsResponse.destroyed = true;

  let thrown: unknown = null;
  try {
    await jobHandler(createRequest('GET', undefined, jobId, true), eventsResponse);
  } catch (error) {
    thrown = error;
  }

  assert(
    thrown === null,
    `a reader leaving before the replay should not fail the request, got ${(thrown as Error)?.message}`
  );
  assert(eventsResponse.chunks.length === 0, 'no frame should be written into a destroyed response');
  assert(!eventsResponse.ended, 'a destroyed response should not be ended again');
}

async function testPreflightAdvertisesEveryMethodTheRouteServes(): Promise<void> {
  setMockRuntime();

  const preflight = new FakeResponse();
  await jobHandler(
    {
      ...createRequest('OPTIONS'),
      headers: { origin: 'https://spice.example.app', host: 'spice.example.app' }
    },
    preflight
  );

  assert(preflight.statusCode === 200, 'a preflight should be answered with 200');
  const allowedMethods = (preflight.headers['Access-Control-Allow-Methods'] ?? '')
    .split(',')
    .map(method => method.trim());
  // The browser reads this list to decide whether to send the request it is
  // asking about. Creating a job is a POST, so a list without it stops the page
  // before the request leaves the browser.
  assert(allowedMethods.includes('POST'), 'the jobs preflight must advertise POST');
  assert(allowedMethods.includes('GET'), 'the jobs preflight must advertise GET');
  assert(allowedMethods.includes('OPTIONS'), 'the jobs preflight must advertise OPTIONS');
  assert(preflight.body === null, 'a preflight should not carry a route payload');
}

async function testInvalidAndUnknownJobIds(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const invalidResponse = new FakeResponse();
  await jobHandler(createRequest('GET', undefined, 'job_<script>'), invalidResponse);
  assert(invalidResponse.statusCode === 400, 'invalid job ids should return 400');

  const malformedResponse = new FakeResponse();
  await jobHandler({ ...createRequest('GET'), query: {}, url: '/api/story-lab/jobs/%E0%A4%A' }, malformedResponse);
  assert(malformedResponse.statusCode === 400, 'malformed encoded job ids should return 400');

  const unknownResponse = new FakeResponse();
  await jobHandler(createRequest('GET', undefined, 'job_00000000-0000-4000-8000-000000000000'), unknownResponse);
  assert(unknownResponse.statusCode === 404, 'unknown valid job ids should return 404');
}

async function testReservedJobKindsAreRejected(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const response = new FakeResponse();
  await jobHandler(createRequest('POST', { kind: 'audio', storyId: 'story_private' }), response);
  assert(response.statusCode === 400, 'reserved audio job should return 400');
  const body = response.body as any;
  assert(body.error.code === 'UNSUPPORTED_JOB_KIND', 'reserved job response should explain unsupported kind');
}

async function testUnsupportedConfiguredJobStoreFailsClosed(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();
  process.env['STORY_LAB_JOB_STORE'] = 'planet-scale';

  const response = await postGenesisJob();

  assert(response.statusCode === 503, 'unsupported job store mode should return 503');
  const body = response.body as any;
  assert(body.success === false, 'unsupported job store mode should not create a job envelope');
  assert(body.error.code === 'JOB_STORE_UNAVAILABLE', 'unsupported job store mode should expose job store unavailable');
  assert(!('details' in body.error), 'unsupported job store response should not expose config details');
}

async function testPostgresJobStoreWithoutRouteAuthFailsClosed(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();
  process.env['STORY_LAB_JOB_STORE'] = 'postgres';

  const response = await postGenesisJob();

  assert(response.statusCode === 503, 'postgres job store without route auth/config should return 503');
  const body = response.body as any;
  assert(body.success === false, 'postgres job store without route auth/config should not create a job envelope');
  assert(body.error.code === 'JOB_STORE_UNAVAILABLE', 'postgres job store without route auth/config should expose job store unavailable');
  assert(body.error.message === 'Durable Story Lab job storage is not configured.', 'postgres job store without config should report storage configuration, not auth');
  assert(!('details' in body.error), 'postgres job store response should not expose config details');
}

async function testDurableInjectedJobStoreRequiresAuth(): Promise<void> {
  setMockRuntime();
  const store = new CapturingDurableJobStore();
  const handler = createStoryLabJobsRouteHandler({
    authPort: createRejectingAuthPort(),
    createJobStoreConfig: () => createDurableJobStoreConfig(store)
  });
  const response = new FakeResponse();

  await handler(createRequest('POST', createGenesisJobRequest()), response);

  assert(response.statusCode === 401, 'durable job route should require account auth');
  const body = response.body as any;
  assert(body.success === false, 'unauthenticated durable job route should use a failure envelope');
  assert(body.error.code === 'UNAUTHORIZED', 'unauthenticated durable job route should expose UNAUTHORIZED');
  assert(store.createdOwnerUserIds.length === 0, 'durable job route should not create jobs before auth succeeds');
}

async function testDurableInjectedJobCreationReceivesOwnerContext(): Promise<void> {
  setMockRuntime();
  const store = new CapturingDurableJobStore();
  const handler = createStoryLabJobsRouteHandler({
    authPort: createStaticAuthPort(owner),
    createJobStoreConfig: () => createDurableJobStoreConfig(store)
  });
  const response = new FakeResponse();

  await handler(createRequest('POST', createGenesisJobRequest()), response);

  assert(response.statusCode === 200, 'authenticated durable job route should create a job envelope');
  const body = response.body as any;
  assert(body.success === true, 'authenticated durable job route should return success');
  assert(body.data.durability.mode === 'postgres', 'durable injected store should preserve durable mode in the route response');
  assert(store.createdOwnerUserIds[0] === owner.userId, 'durable job creation should receive authenticated owner id');
  assert(store.updateOwnerUserIds.length >= 2, 'durable job execution should update the created job');
  assert(
    store.updateOwnerUserIds.every(ownerUserId => ownerUserId === owner.userId),
    'durable job updates should receive authenticated owner id'
  );

  const jobId = body.data.job.jobId as string;
  const statusResponse = new FakeResponse();
  await handler(createRequest('GET', undefined, jobId), statusResponse);
  assert(statusResponse.statusCode === 200, 'authenticated durable status route should read the created job');
  assert(store.readOwnerUserIds[0] === owner.userId, 'durable job status route should pass authenticated owner id');

  const eventsResponse = new FakeResponse();
  await handler(createRequest('GET', undefined, jobId, true), eventsResponse);
  assert(eventsResponse.statusCode === 200, 'authenticated durable events route should read job events');
  assert(store.eventOwnerUserIds[0] === owner.userId, 'durable job events route should pass authenticated owner id');
}

async function testDurableInjectedJobCreateFailureUsesSanitizedEnvelope(): Promise<void> {
  setMockRuntime();
  const store = new CapturingDurableJobStore();
  store.failCreate = true;
  const handler = createStoryLabJobsRouteHandler({
    authPort: createStaticAuthPort(owner),
    createJobStoreConfig: () => createDurableJobStoreConfig(store)
  });
  const response = new FakeResponse();
  const request = createGenesisJobRequest('Private moonlit vault with sk-secret query payload.');

  await handler(createRequest('POST', request), response);

  assertSanitizedJobStoreFailure(response, 'durable create storage failure should use a sanitized envelope');
}

async function testDurableInjectedJobUpdateFailureUsesSanitizedEnvelope(): Promise<void> {
  setMockRuntime();
  const store = new CapturingDurableJobStore();
  store.failUpdateOnCall = 1;
  const handler = createStoryLabJobsRouteHandler({
    authPort: createStaticAuthPort(owner),
    createJobStoreConfig: () => createDurableJobStoreConfig(store)
  });
  const response = new FakeResponse();
  const request = createGenesisJobRequest('Private moonlit vault with sk-secret update payload.');

  await handler(createRequest('POST', request), response);

  assertSanitizedJobStoreFailure(response, 'durable running update storage failure should use a sanitized envelope');
}

async function testDurableInjectedJobFinishFailureUsesSanitizedEnvelope(): Promise<void> {
  setMockRuntime();
  const store = new CapturingDurableJobStore();
  store.failUpdateOnCall = 2;
  const handler = createStoryLabJobsRouteHandler({
    authPort: createStaticAuthPort(owner),
    createJobStoreConfig: () => createDurableJobStoreConfig(store)
  });
  const response = new FakeResponse();
  const request = createGenesisJobRequest('Private moonlit vault with sk-secret finish payload.');

  await handler(createRequest('POST', request), response);

  assertSanitizedJobStoreFailure(response, 'durable finish storage failure should use a sanitized envelope');
}

async function testMalformedContinuationStoryIdReturnsInvalidRequest(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const response = new FakeResponse();
  await jobHandler(createRequest('POST', {
    kind: 'continuation',
    continuation: {
      storyId: 123,
      chapterBatchSize: 1
    }
  }), response);

  assert(response.statusCode === 400, 'malformed continuation storyId should return 400');
  const body = response.body as any;
  assert(body.error.code === 'INVALID_REQUEST', 'malformed continuation should use invalid request response');
}

function testStoreEvictsOldestJobs(): void {
  const store = new NonDurableStoryLabJobStore(2);
  const first = store.createJob({ kind: 'genesis', now: '2026-06-07T00:00:00.000Z' });
  const second = store.createJob({ kind: 'genesis', now: '2026-06-07T00:01:00.000Z' });
  const third = store.createJob({ kind: 'genesis', now: '2026-06-07T00:02:00.000Z' });

  assert(store.getJob(first.job.jobId) === null, 'oldest job should be evicted when max size is reached');
  assert(store.getJob(second.job.jobId)?.job.jobId === second.job.jobId, 'second job should remain after eviction');
  assert(store.getJob(third.job.jobId)?.job.jobId === third.job.jobId, 'newest job should remain after eviction');
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

async function testThrownEngineFailureFinishesTheJob(): Promise<void> {
  nonDurableStoryLabJobStore.reset();
  setMockRuntime();

  const handler = createStoryLabJobsRouteHandler({
    generateGenesis: async () => {
      throw new Error(`Provider socket closed for ${owner.email} with sk-secret credentials.`);
    }
  });
  const response = new FakeResponse();

  await handler(createRequest('POST', createGenesisJobRequest()), response);

  assert(response.statusCode === 200, 'a thrown engine failure should still return a job envelope');
  const body = response.body as any;
  assert(body.success === true, 'thrown engine failure should be represented by a successful job envelope');
  assert(body.data.job.status === 'failed', 'a thrown engine failure should move the job off running');
  assert(body.data.job.error.code === 'GENERATION_FAILED', 'thrown engine failure should record a generation failure');
  assert(!body.data.job.error.message.includes('sk-secret'), 'thrown engine failure should not expose provider detail');
  assert(!body.data.job.error.message.includes(owner.email ?? ''), 'thrown engine failure should not expose owner email');
  assert(body.data.job.result === undefined, 'a failed job should not include a story result');

  const statusResponse = new FakeResponse();
  await handler(createRequest('GET', undefined, body.data.job.jobId), statusResponse);
  const statusBody = statusResponse.body as any;
  assert(statusBody.data.job.status === 'failed', 'the stored job should read as failed, not running');
}

async function run(): Promise<void> {
  await testGenesisJobCompletesInMockMode();
  await testEventsReplaySnapshotsAndClose();
  await testEventsReplayStopsAtAClosedResponse();
  await testPreflightAdvertisesEveryMethodTheRouteServes();
  await testInvalidAndUnknownJobIds();
  await testReservedJobKindsAreRejected();
  await testUnsupportedConfiguredJobStoreFailsClosed();
  await testPostgresJobStoreWithoutRouteAuthFailsClosed();
  await testDurableInjectedJobStoreRequiresAuth();
  await testDurableInjectedJobCreationReceivesOwnerContext();
  await testDurableInjectedJobCreateFailureUsesSanitizedEnvelope();
  await testDurableInjectedJobUpdateFailureUsesSanitizedEnvelope();
  await testDurableInjectedJobFinishFailureUsesSanitizedEnvelope();
  await testMalformedContinuationStoryIdReturnsInvalidRequest();
  testStoreEvictsOldestJobs();
  await testProductionMissingProviderCreatesFailedJob();
  await testThrownEngineFailureFinishesTheJob();

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

class CapturingDurableJobStore implements StoryLabJobStore {
  readonly mode = 'postgres';
  readonly durable = true;
  readonly createdOwnerUserIds: Array<string | undefined> = [];
  readonly updateOwnerUserIds: Array<string | undefined> = [];
  readonly readOwnerUserIds: Array<string | undefined> = [];
  readonly eventOwnerUserIds: Array<string | undefined> = [];
  failCreate = false;
  failUpdateOnCall: number | null = null;
  private updateCalls = 0;
  private readonly inner = new NonDurableStoryLabJobStore();

  isConfigured(): boolean {
    return true;
  }

  createJob<TPublicResult = unknown>(input: CreateStoryLabJobInput): StoryLabJobCreationResponse<TPublicResult> {
    this.createdOwnerUserIds.push(input.ownerUserId);
    if (this.failCreate) {
      throw privateJobStoreFailure();
    }
    return this.withDurableReceipt(this.inner.createJob<TPublicResult>(input));
  }

  updateJob<TPublicResult = unknown>(
    jobId: string,
    input: UpdateStoryLabJobInput<TPublicResult>
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    this.updateOwnerUserIds.push(input.ownerUserId);
    this.updateCalls += 1;
    if (this.failUpdateOnCall === this.updateCalls) {
      throw privateJobStoreFailure();
    }
    return this.withDurableReceipt(this.inner.updateJob<TPublicResult>(jobId, input));
  }

  getJob<TPublicResult = unknown>(
    jobId: string,
    options?: { ownerUserId?: string }
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    this.readOwnerUserIds.push(options?.ownerUserId);
    return this.withDurableReceipt(this.inner.getJob<TPublicResult>(jobId, options));
  }

  getEvents<TPublicResult = unknown>(
    jobId: string,
    options?: { ownerUserId?: string }
  ) {
    this.eventOwnerUserIds.push(options?.ownerUserId);
    return this.inner.getEvents<TPublicResult>(jobId, options);
  }

  private withDurableReceipt<TPublicResult>(
    response: StoryLabJobCreationResponse<TPublicResult> | null
  ): StoryLabJobCreationResponse<TPublicResult> | null {
    return response
      ? {
        ...response,
        durability: {
          mode: 'postgres',
          durable: true
        }
      }
      : null;
  }
}

function assertSanitizedJobStoreFailure(response: FakeResponse, message: string): void {
  assert(response.statusCode === 503, message);
  const body = response.body as any;
  assert(body.success === false, 'job store failure should use a failure envelope');
  assert(body.error.code === 'STORY_LAB_JOB_STORAGE_FAILED', 'job store failure should expose the typed storage failure code');
  assert(body.error.message === 'Story Lab job storage failed.', 'job store failure should use a generic public message');
  assert(!body.error.message.includes(owner.email ?? ''), 'job store failure should not expose owner email');
  assert(!body.error.message.includes('sk-secret'), 'job store failure should not expose private payload text');
  assert(!('details' in body.error), 'job store failure should not expose diagnostic details');
}

function privateJobStoreFailure(): StoryLabJobStoreError {
  return new StoryLabJobStoreError(
    'STORY_LAB_JOB_STORAGE_FAILED',
    `Raw database failure for ${owner.email} with sk-secret query params.`
  );
}

function createDurableJobStoreConfig(store: StoryLabJobStore): StoryLabJobStoreConfig {
  return {
    requestedMode: 'postgres',
    mode: 'postgres',
    databaseUrlConfigured: true,
    executorConfigured: true,
    store,
    isConfigured() {
      return store.isConfigured();
    }
  };
}

function createStaticAuthPort(user: AuthUser): AuthPort {
  return {
    async getCurrentUser() {
      return user;
    },
    async requireUser() {
      return user;
    }
  };
}

function createRejectingAuthPort(): AuthPort {
  return {
    async getCurrentUser() {
      return null;
    },
    async requireUser() {
      throw new AuthError('Account authentication is required.');
    }
  };
}
