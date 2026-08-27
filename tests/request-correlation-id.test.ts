#!/usr/bin/env tsx
// Created: 2026-08-25 23:55 UTC

import {
  MAX_REQUEST_CORRELATION_ID_LENGTH,
  readRequestCorrelationId
} from '../api/_lib/http/requestCorrelationId';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import exportSaveHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
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

  console.log('Request correlation id tests passed');
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
