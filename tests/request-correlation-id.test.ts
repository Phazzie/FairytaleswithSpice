#!/usr/bin/env tsx
// Created: 2026-08-25 23:55 UTC

import {
  MAX_REQUEST_CORRELATION_ID_LENGTH,
  readRequestCorrelationId
} from '../api/_lib/http/requestCorrelationId';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { createStoryLabAccountRouteHandler } from '../api/_lib/story-lab/account/accountRouteHandlers';
import { createClerkAuthPort } from '../api/_lib/story-lab/auth/clerkAuthPort';
import { createStoryLabJobsRouteHandler } from '../api/_lib/story-lab/jobs/jobRouteHandlers';
import { logger } from '../api/_lib/utils/logger';
import exportSaveHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import storyLabAccountHandler from '../api/story-lab/account';
import storyLabJobsHandler from '../api/story-lab/jobs';
import storyLabGenesisHandler from '../api/story-lab/stories';
import storyLabContinuationHandler from '../api/story-lab/stories/[storyId]/continue';

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
  await testTheRoutesThatServeMoreThanPostEchoItToo();
  await testTheJobsRouteLogsUnderTheIdItEchoed();
  await testTheAuthPortWarnsUnderTheIdTheRouteEchoed();

  console.log('Request correlation id tests passed');
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
