#!/usr/bin/env tsx
// Created: 2026-08-25 23:55 UTC

import {
  MAX_REQUEST_CORRELATION_ID_LENGTH,
  readRequestCorrelationId
} from '../api/_lib/http/requestCorrelationId';
import exportSaveHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import storyGenerateHandler from '../api/story/generate';

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
    { path: '/api/story/generate', handler: storyGenerateHandler },
    { path: '/api/image/generate', handler: imageGenerateHandler },
    { path: '/api/export/save', handler: exportSaveHandler }
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

  console.log('Request correlation id tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
