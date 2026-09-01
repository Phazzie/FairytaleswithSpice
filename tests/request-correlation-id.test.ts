#!/usr/bin/env tsx
// Created: 2026-08-25 23:55 UTC

import {
  MAX_REQUEST_CORRELATION_ID_LENGTH,
  readRequestCorrelationId
} from '../api/_lib/http/requestCorrelationId';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { withMemoryRateLimitStore } from './helpers/withMemoryRateLimitStore';
import { createStoryLabAccountRouteHandler } from '../api/_lib/story-lab/account/accountRouteHandlers';
import { createClerkAuthPort } from '../api/_lib/story-lab/auth/clerkAuthPort';
import { createStoryLabJobsRouteHandler } from '../api/_lib/story-lab/jobs/jobRouteHandlers';
import { logger } from '../api/_lib/utils/logger';
import { StoryService } from '../api/_lib/services/storyService';
import { XaiTextClient } from '../api/_lib/services/xaiTextClient';
import { extractContinuity } from '../api/_lib/story-lab/continuityExtractor';
import exportSaveHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import storyLabAccountHandler from '../api/story-lab/account';
import storyLabJobsHandler from '../api/story-lab/jobs';
import storyLabGenesisHandler, { createStoryLabGenesisHandler } from '../api/story-lab/stories';
import storyLabContinuationHandler, {
  createStoryLabContinuationHandler
} from '../api/story-lab/stories/[storyId]/continue';

// `StoryService.continueChapter` validates nothing: unlike `generateStory`, it
// has no input check to refuse a malformed request at, so it goes straight into
// generation for whatever it is handed. With `XAI_API_KEY` set — a developer's
// shell, or CI with provider credentials — that is a real, billable call to the
// provider, and this file would wait through its timeouts and fail on its
// network. `XaiTextClient` reads the key in a field initializer, so clearing it
// here, before any service is constructed, is what pins every path below to
// mock generation. Same reason and same placement as `tests/image-service.test.ts`.
delete process.env['XAI_API_KEY'];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
  }

  end(): void {}
}

function requestWith(header: unknown) {
  return { headers: { 'x-request-id': header } as Record<string, any> };
}

const GENERATED_ID_PATTERN = /^req_[0-9a-f-]{36}$/;

/** The correlation id the route cases below send, named for the reason
 * `tests/story-lab-continuity-prompt.test.ts` names its own `STORY_ID`: it is
 * asserted on in three places, and three spellings of one id is three chances
 * for the assertion to be checking something the request never carried. */
const GENERATION_TRACE_ID = 'trace-generation-1';

/** The story the continuity case runs against. Named for the same reason. */
const CONTINUITY_STORY_ID = 'story-continuity-correlation';

// ==================== IDS THAT ARE HONOURED ====================
// The whole value of the header is a caller tracing one request across their
// logs and this service's, so an id that is plausibly a correlation id survives
// verbatim.
const honoured = [
  '3f2b6a1e-6a1f-4f0e-9d3e-2b1c4d5e6f70',
  'req_3f2b6a1e-6a1f-4f0e-9d3e-2b1c4d5e6f70',
  '4bf92f3577b34da6a3ce929d0e0e4736',
  '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  'sfo1::abcde-1756142400000-0123456789ab',
  'a'.repeat(MAX_REQUEST_CORRELATION_ID_LENGTH)
];

for (const id of honoured) {
  assert(
    readRequestCorrelationId(requestWith(id)) === id,
    `a correlation id should be honoured verbatim: ${id}`
  );
}

// Surrounding whitespace is the header's, not the id's.
assert(
  readRequestCorrelationId(requestWith('  trace-123  ')) === 'trace-123',
  'a correlation id should be trimmed of header whitespace'
);

// A repeated header arrives as an array on some runtimes; the client-facing hop
// sent the first value, the same reading the CORS policy uses.
assert(
  readRequestCorrelationId(requestWith(['trace-123', 'trace-456'])) === 'trace-123',
  'a repeated header should be read as its first value'
);

// ==================== IDS THAT ARE REPLACED ====================
// The value is echoed into a response header and stamped into every log line
// the request writes, including the buffered structured context — so nothing
// unbounded, and nothing that is simply caller prose, is carried there. The id
// names the request rather than being part of what was asked for, so a bad one
// is replaced rather than refused.
const replaced: Array<{ label: string; header: unknown }> = [
  { label: 'an absent header', header: undefined },
  { label: 'an empty header', header: '' },
  { label: 'a whitespace-only header', header: '   ' },
  { label: 'a non-string header', header: 42 },
  {
    label: 'an id past the length cap',
    header: 'a'.repeat(MAX_REQUEST_CORRELATION_ID_LENGTH + 1)
  },
  { label: 'prose', header: 'this is not a correlation id' },
  { label: 'markup', header: '<script>alert(1)</script>' },
  { label: 'a forged log line', header: 'ok] INFO fake log entry [also-ok' }
];

for (const sample of replaced) {
  const id = readRequestCorrelationId(requestWith(sample.header));
  assert(
    GENERATED_ID_PATTERN.test(id),
    `${sample.label} should be replaced with a generated id, got ${JSON.stringify(id)}`
  );
}

assert(
  GENERATED_ID_PATTERN.test(readRequestCorrelationId(undefined)),
  'a request with no headers at all should still get an id'
);

assert(
  readRequestCorrelationId(requestWith(undefined)) !== readRequestCorrelationId(requestWith(undefined)),
  'generated ids should be unique per request'
);

// ==================== THE ROUTES THAT ECHO IT ====================
// Each of these reads the header, writes it back as `X-Request-ID`, and logs it
// under that name. They are driven through their own 405 branch, which is the
// shortest path that still reaches the echo.
async function main(): Promise<void> {
  await withMemoryRateLimitStore(async () => {
    const routes: Array<{ path: string; handler: (req: any, res: any) => unknown }> = [
      { path: '/api/image/generate', handler: imageGenerateHandler },
      { path: '/api/export/save', handler: exportSaveHandler },
      // `/api/story-lab/stories` and `/api/story-lab/stories/:storyId/continue` are
      // the routes real traffic takes (`/api/story/generate` and
      // `/api/story/continue`, the legacy pair this file used to drive here, were
      // never reachable from the app and have been deleted). Both now open with
      // the same `beginPostRoute` the other paid routes do, so they echo and
      // bound the correlation id the same way.
      { path: '/api/story-lab/stories', handler: storyLabGenesisHandler },
      { path: '/api/story-lab/stories/:storyId/continue', handler: storyLabContinuationHandler }
    ];

    for (const route of routes) {
      const honouredResponse = new FakeResponse();
      await route.handler(
        { method: 'GET', headers: { 'x-request-id': 'trace-123' } },
        honouredResponse
      );
      assert(
        honouredResponse.headers['X-Request-ID'] === 'trace-123',
        `${route.path} should echo a real correlation id back to the caller`
      );

      const replacedResponse = new FakeResponse();
      await route.handler(
        { method: 'GET', headers: { 'x-request-id': 'x'.repeat(4096) } },
        replacedResponse
      );
      assert(
        GENERATED_ID_PATTERN.test(replacedResponse.headers['X-Request-ID'] ?? ''),
        `${route.path} should not echo an unbounded correlation id, got ${
          (replacedResponse.headers['X-Request-ID'] ?? '').length
        } characters`
      );
    }

    await testTheEnvelopeReportsTheIdTheHeaderCarries();
    await testTheStoryLabRoutesHandTheirIdToTheGeneration();
    await testTheStoryServiceHonoursTheIdItIsGiven();
    await testTheContinuityCallCarriesTheSameId();
    await testTheRoutesThatServeMoreThanPostEchoItToo();
    await testTheJobsRouteLogsUnderTheIdItEchoed();
    await testTheAuthPortWarnsUnderTheIdTheRouteEchoed();
  });

  console.log('Request correlation id tests passed');
}

/**
 * The id the route settled has to reach the generation itself.
 *
 * Echoing `X-Request-ID` and stamping it on the route's own lines was as far as
 * it went: `generateStoryLabGenesis` and `continueStoryLab` were called with the
 * request body alone, and `StoryService` opened both entry points with
 * `logger.generateRequestId()`. So every line describing the work a reader would
 * actually be asking about — the prompt sizes, the provider call this app pays
 * for, the failure itself — was filed under a second id that appears in no
 * response, no header, and nothing the caller was told to keep. `ImageService`
 * and `ExportService` were each given this argument for this reason and left
 * `StoryService` the last of the three minting its own.
 *
 * Driven through the handler factories, which take the engine function as their
 * parameter, so this asserts the whole chain the caller depends on: header ->
 * `beginPostRoute` -> route -> engine options, with no provider call spent.
 */
async function testTheStoryLabRoutesHandTheirIdToTheGeneration(): Promise<void> {
  const cases: Array<{
    path: string;
    build: (record: (options: unknown) => void) => (req: any, res: any) => unknown;
    body: unknown;
  }> = [
    {
      path: '/api/story-lab/stories',
      build: record => createStoryLabGenesisHandler((async (_blueprint: any, options: any) => {
        record(options);
        return { success: true, data: {} as any };
      }) as any),
      body: genesisBlueprint()
    },
    {
      path: '/api/story-lab/stories/:storyId/continue',
      build: record => createStoryLabContinuationHandler((async (_input: any, options: any) => {
        record(options);
        return { success: true, data: {} as any };
      }) as any),
      body: continuationBody()
    }
  ];

  for (const routeCase of cases) {
    resetRateLimitsForTests();

    let seen: any;
    const response = new FakeResponse();
    await routeCase.build(options => { seen = options; })(
      { method: 'POST', headers: { 'x-request-id': GENERATION_TRACE_ID }, body: routeCase.body },
      response
    );

    assert(
      response.headers['X-Request-ID'] === GENERATION_TRACE_ID,
      `${routeCase.path} should echo the correlation id (got ${JSON.stringify(response.headers['X-Request-ID'])})`
    );
    assert(
      seen?.requestId === GENERATION_TRACE_ID,
      `${routeCase.path} should hand the settled id to the generation, got ${JSON.stringify(seen?.requestId)}`
    );
  }

  // And with no id from the caller, the route still hands on the one it minted,
  // rather than leaving the generation to mint a third.
  resetRateLimitsForTests();
  let mintedSeen: any;
  const mintedResponse = new FakeResponse();
  await createStoryLabGenesisHandler((async (_blueprint: any, options: any) => {
    mintedSeen = options;
    return { success: true, data: {} as any };
  }) as any)(
    { method: 'POST', headers: {}, body: genesisBlueprint() },
    mintedResponse
  );

  assert(
    mintedSeen?.requestId === mintedResponse.headers['X-Request-ID'],
    `a minted id should reach the generation too, got ${JSON.stringify(mintedSeen?.requestId)} ` +
      `against the header's ${JSON.stringify(mintedResponse.headers['X-Request-ID'])}`
  );
}

/**
 * `StoryService` reports the id it was handed, and mints one only when it has
 * none.
 *
 * The other half of the same defect: the argument is worth nothing if the
 * service ignores it. What is asserted is the id in the envelope, not anything
 * about generation.
 *
 * The two entry points reach that envelope by different routes, and the
 * difference is worth stating rather than glossing. `generateStory` refuses a
 * malformed input at `validateStoryInput` and returns before any generation, so
 * its two cases are genuinely pre-provider. `continueChapter` has **no input
 * validation at all** — there is no early return to drive it to — so it runs a
 * whole generation for whatever it is handed. That is why the key is cleared at
 * the top of this file: without it the continuation case is a mock generation,
 * and with it that same line would be a paid provider call.
 */
async function testTheStoryServiceHonoursTheIdItIsGiven(): Promise<void> {
  const service = new StoryService();
  // Refused by `validateStoryInput`: no creature, no themes.
  const refusedInput = { creature: '', themes: [], spicyLevel: 3, wordCount: 700 } as any;

  const honoured = await service.generateStory(refusedInput, 'trace-service-1');
  assert(
    honoured.success === false,
    'the malformed input should be refused, so the envelope carries the id without a provider call'
  );
  assert(
    honoured.metadata?.requestId === 'trace-service-1',
    `generateStory should report the id it was given, got ${JSON.stringify(honoured.metadata?.requestId)}`
  );

  const continued = await service.continueChapter(
    { storyId: '', currentChapterCount: 0, existingContent: '' } as any,
    'trace-service-2'
  );
  assert(
    continued.metadata?.requestId === 'trace-service-2',
    `continueChapter should report the id it was given, got ${JSON.stringify(continued.metadata?.requestId)}`
  );

  const minted = await service.generateStory(refusedInput);
  assert(
    GENERATED_ID_PATTERN.test(minted.metadata?.requestId ?? ''),
    `a caller with no id should still get one, got ${JSON.stringify(minted.metadata?.requestId)}`
  );
}

/**
 * The continuity call is the second paid call of one request, and it answers to
 * the same id.
 *
 * A successful Story Lab generation makes two provider calls: the chapters, and
 * then `extractContinuity`. Giving `StoryService` the correlation id correlated
 * the first and left the second exactly as it was — `XaiTextClient` logs every
 * call's start, latency and failure through `request.context`, and this one
 * passed none. So the timeout or provider error that most often degrades a
 * batch was recorded under no request at all, on a generation whose chapters
 * were correlated correctly.
 *
 * Driven against a stubbed client rather than a real one: what is asserted is
 * the context handed to `generateText`, which is the whole of the fix, and
 * stubbing is what keeps a test about logging from needing a provider.
 */
async function testTheContinuityCallCarriesTheSameId(): Promise<void> {
  const realGenerateText = XaiTextClient.prototype.generateText;
  const realHasApiKey = XaiTextClient.prototype.hasApiKey;

  let seenContext: any;
  XaiTextClient.prototype.hasApiKey = function hasApiKey(): boolean {
    return true;
  };
  XaiTextClient.prototype.generateText = async function generateText(request: any) {
    seenContext = request.context;
    return { text: '{}' } as any;
  };

  try {
    await extractContinuity({
      storyId: CONTINUITY_STORY_ID,
      currentState: continuityState(),
      chapters: [],
      summary: continuitySummary(),
      useAi: true,
      timeoutMs: 30_000,
      requestId: 'trace-continuity-1'
    });
  } finally {
    XaiTextClient.prototype.generateText = realGenerateText;
    XaiTextClient.prototype.hasApiKey = realHasApiKey;
  }

  assert(
    seenContext?.requestId === 'trace-continuity-1',
    `the continuity provider call should carry the request's own id, got ${JSON.stringify(seenContext?.requestId)}`
  );
  assert(
    seenContext?.endpoint === 'story-lab/continuity-extraction',
    `the continuity call should name itself, so it is tellable from the chapter calls under the same id, ` +
      `got ${JSON.stringify(seenContext?.endpoint)}`
  );
}

function continuityState() {
  return {
    storyId: CONTINUITY_STORY_ID,
    revision: 1,
    characters: [],
    threads: [],
    artifacts: [],
    narrativeVoice: 'tense romantic fantasy',
    continuityWarnings: [],
    lastUpdatedAt: new Date().toISOString()
  } as any;
}

function continuitySummary() {
  return {
    storyId: CONTINUITY_STORY_ID,
    title: 'Continuity correlation',
    creature: 'siren',
    themes: [],
    spicyLevel: 3,
    chapterCount: 1
  } as any;
}

function genesisBlueprint() {
  return {
    creature: 'siren',
    tone: 'dark_romance',
    logline: 'A siren diplomat risks exile for a forbidden lover.',
    spicyLevel: 3,
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    themes: [{
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'A relationship that breaks supernatural law.'
    }],
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'dangerous_proximity',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    }
  };
}

function continuationBody() {
  const now = new Date().toISOString();
  return {
    storyId: 'story-correlation-id',
    chapterBatchSize: 1,
    storyState: {
      storyId: 'story-correlation-id',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      narrativeVoice: 'tense romantic fantasy',
      continuityWarnings: [],
      lastUpdatedAt: now
    },
    previouslyGeneratedChapters: [{
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      htmlContent: '<h3>Chapter 1</h3><p>Mira entered the court.</p>',
      rawContent: 'Mira entered the court.',
      summary: 'Mira entered the court.',
      wordCount: 5,
      hasCliffhanger: true
    }],
    continuationBrief: 'Raise the danger.'
  };
}

/**
 * `/api/story-lab/jobs` and `/api/story-lab/account` echo it as well.
 *
 * These two settled no id at all. Every other route in `api/` gets one from
 * `beginPostRoute`, which is POST-only by construction — it answers `405` for
 * anything else and pairs `Allow` with the preflight list — and these two serve
 * more than `POST` (the jobs route serves a `GET` event stream), so adopting it
 * unchanged would have changed what they serve. The id-settling half is now
 * `settleRequestCorrelationId`, which carries no method dispatch, and both call
 * it.
 *
 * Driven through each route's own pre-auth, pre-store refusal — a jobs `GET`
 * with no job id, an account `GET` naming no resource — because that is the
 * shortest path that still reaches the echo and it touches no store, no auth
 * port, and no provider.
 */
async function testTheRoutesThatServeMoreThanPostEchoItToo(): Promise<void> {
  const routes: Array<{ path: string; handler: (req: any, res: any) => unknown; code: string }> = [
    { path: '/api/story-lab/jobs', handler: storyLabJobsHandler, code: 'INVALID_JOB_ID' },
    { path: '/api/story-lab/account', handler: storyLabAccountHandler, code: 'ACCOUNT_ROUTE_NOT_FOUND' }
  ];

  for (const route of routes) {
    const honouredResponse = new FakeResponse();
    await route.handler(
      { method: 'GET', headers: { 'x-request-id': 'trace-123' }, query: {} },
      honouredResponse
    );
    assert(
      honouredResponse.headers['X-Request-ID'] === 'trace-123',
      `${route.path} should echo a real correlation id back to the caller`
    );
    // The refusal it was driven through, named — so a route that starts
    // answering this request some other way (an auth challenge, a store error,
    // a provider call) fails here rather than quietly proving the echo on a
    // path this test did not intend to exercise.
    assert(
      (honouredResponse.body as any)?.error?.code === route.code,
      `${route.path} should refuse this request with ${route.code}, got ${
        JSON.stringify(honouredResponse.body).slice(0, 200)
      }`
    );

    const replacedResponse = new FakeResponse();
    await route.handler(
      { method: 'GET', headers: { 'x-request-id': 'x'.repeat(4096) }, query: {} },
      replacedResponse
    );
    assert(
      GENERATED_ID_PATTERN.test(replacedResponse.headers['X-Request-ID'] ?? ''),
      `${route.path} should not echo an unbounded correlation id, got ${
        (replacedResponse.headers['X-Request-ID'] ?? '').length
      } characters`
    );
  }

  // The jobs route answers the preflight from a branch of its own, before it
  // dispatches on method — that branch exists so the preflight describes the
  // whole route rather than one of its handlers — and the id is settled above
  // it, so an `OPTIONS` carries the header too.
  const preflightResponse = new FakeResponse();
  await storyLabJobsHandler(
    { method: 'OPTIONS', headers: { 'x-request-id': 'trace-preflight' }, query: {} } as any,
    preflightResponse as any
  );
  assert(
    preflightResponse.headers['X-Request-ID'] === 'trace-preflight',
    'the jobs route preflight should carry the correlation id as well'
  );
}

/**
 * The echoed id has to be the id the log lines are filed under.
 *
 * A header a caller is told to quote, over logs that were written under nothing,
 * is worse than no header: it reads as a trace and finds none. The jobs route
 * writes two lines — the store-unavailable warning and the throw from job work
 * — and neither had a `requestId` in scope to be stamped with.
 *
 * Driven through the store-unavailable branch, which is reached with an
 * injected config rather than by unsetting environment: `503` is the answer a
 * reader most often comes back asking about on this route, and the branch runs
 * before any store, auth port, or provider is touched.
 */
async function testTheJobsRouteLogsUnderTheIdItEchoed(): Promise<void> {
  const handler = createStoryLabJobsRouteHandler({
    createJobStoreConfig: () => ({
      requestedMode: 'unsupported',
      mode: 'unsupported',
      databaseUrlConfigured: false,
      executorConfigured: false,
      store: null,
      isConfigured: () => false
    })
  });

  logger.clearLogs();

  const response = new FakeResponse();
  await handler(
    {
      method: 'GET',
      headers: { 'x-request-id': 'trace-job-store' },
      query: { jobId: 'job_3f2b6a1e-6a1f-4f0e-9d3e-2b1c4d5e6f70' }
    } as any,
    response as any
  );

  assert(
    (response.body as any)?.error?.code === 'JOB_STORE_UNAVAILABLE',
    `the jobs route should answer an unconfigured store with JOB_STORE_UNAVAILABLE, got ${
      JSON.stringify(response.body).slice(0, 200)
    }`
  );
  assert(
    response.headers['X-Request-ID'] === 'trace-job-store',
    'the jobs route should echo the correlation id on a store failure'
  );

  const warning = logger
    .getRecentLogs(50, 'warn')
    .find(entry => entry.message === 'Story Lab job store unavailable');
  assert(
    warning,
    'the store-unavailable warning should have been written'
  );
  assert(
    warning.context?.requestId === 'trace-job-store',
    `the store-unavailable warning should be filed under the echoed id, got ${
      JSON.stringify(warning.context?.requestId)
    }`
  );
}

/**
 * A reader who re-reads the id off the request gets the settled one.
 *
 * Not every line written for a request is written by the route that settled the
 * id, and not every writer is handed it as an argument.
 * `clerkAuthPort.warnAuthVerificationFailure` calls `readRequestCorrelationId`
 * on the request it was given, and it is the **only** line an auth failure
 * writes — on the account route, and on the jobs route whenever the job store
 * is durable and `requireUser` runs. Echoing the id to the caller without
 * writing it back left that line minting a second `req_<uuid>` of its own
 * whenever the caller supplied none, which is the common case here: no client
 * in this repository sends `x-request-id`. So the header a caller was told to
 * quote named the one diagnostic they would come back asking about, and finding
 * it was impossible.
 *
 * Driven with **no** `x-request-id` at all, because a supplied id was never
 * affected — both reads return the same trimmed value — and the minted case is
 * the one that drifts silently. The Clerk verifier is a stub that throws, so
 * this proves the provider-failure seam without a provider: the throw is what
 * `requireUser` turns into the warning.
 */
async function testTheAuthPortWarnsUnderTheIdTheRouteEchoed(): Promise<void> {
  const handler = createStoryLabAccountRouteHandler({
    authPort: createClerkAuthPort({
      verifySessionToken: async () => {
        throw new Error('clerk is unreachable');
      }
    })
  });

  logger.clearLogs();

  const response = new FakeResponse();
  await handler(
    {
      method: 'GET',
      // Deliberately no `x-request-id`: this is the case that minted one.
      headers: { authorization: 'Bearer stub-session-token' },
      query: { resource: 'profile' }
    } as any,
    response as any
  );

  const echoed = response.headers['X-Request-ID'] ?? '';
  assert(
    GENERATED_ID_PATTERN.test(echoed),
    `the account route should mint an id when the caller sends none, got ${JSON.stringify(echoed)}`
  );

  const warning = logger
    .getRecentLogs(50, 'warn')
    .find(entry => entry.message === 'Clerk session verification failed.');
  assert(
    warning,
    'a Clerk verification failure should have been warned about'
  );
  assert(
    warning.context?.requestId === echoed,
    `the auth failure warning should be filed under the id the caller was echoed (${
      echoed
    }), got ${JSON.stringify(warning.context?.requestId)}`
  );
}

/**
 * The id in the response body has to be the id in the response header.
 *
 * Echoing `X-Request-ID` is only half of a correlation id. `/api/export/save`
 * and `/api/image/generate` both answer an `ApiResponse` envelope whose
 * `metadata.requestId` was minted inside the service — `req_<uuid>` in
 * `ExportService`, `img-req-<uuid>` in `ImageService` — and written into the
 * response body and nowhere else. So the two ids a caller can see disagreed,
 * and the one that is easiest to find (it is in the body, beside the error) was
 * the one that matched no log line anywhere: quoting it found nothing, while
 * the id that would have found the request was in a header nobody was told to
 * keep.
 *
 * Driven with a body each route refuses, because a refusal is when a caller
 * actually goes looking for the id, and neither refusal spends a provider call.
 */
async function testTheEnvelopeReportsTheIdTheHeaderCarries(): Promise<void> {
  resetRateLimitsForTests();

  const cases: Array<{ path: string; handler: (req: any, res: any) => unknown; body: unknown }> = [
    // A format the renderer does not support: refused by the service, so the
    // answer is the service's own envelope rather than the route's 400.
    {
      path: '/api/export/save',
      handler: exportSaveHandler,
      body: {
        storyId: 'story_correlation_regression',
        title: 'Midnight Bargain',
        content: '<p>She signed it in blood.</p>',
        format: 'rtf'
      }
    },
    // A style outside the five the contract names, refused by `ImageService`
    // for the same reason and answered the same way.
    {
      path: '/api/image/generate',
      handler: imageGenerateHandler,
      body: {
        storyId: 'story_correlation_regression',
        content: '<p>She signed it in blood.</p>',
        creature: 'vampire',
        themes: ['betrayal'],
        style: 'watercolour'
      }
    }
  ];

  for (const route of cases) {
    const response = new FakeResponse();
    await route.handler(
      { method: 'POST', headers: { 'x-request-id': 'trace-envelope-1' }, body: route.body },
      response
    );

    const envelope = response.body as { success?: boolean; metadata?: { requestId?: string } };
    assert(
      envelope?.success === false,
      `${route.path} should refuse this body (got ${JSON.stringify(response.body).slice(0, 200)})`
    );
    assert(
      response.headers['X-Request-ID'] === 'trace-envelope-1',
      `${route.path} should echo the correlation id as a header`
    );
    assert(
      envelope.metadata?.requestId === 'trace-envelope-1',
      `${route.path} should report the same id in the envelope, got ${JSON.stringify(envelope.metadata?.requestId)}`
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
