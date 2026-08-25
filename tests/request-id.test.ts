// Created: 2026-08-25 13:05 UTC
//
// Proves the correlation id a route logs under is the one it hands back, and
// that it is never simply whatever the caller sent.
//
// `/api/story/generate` and `/api/export/save` put `req.headers['x-request-id']`
// straight into a response header and into the `[${requestId}]` prefix of every
// console line, so a repeated header logged as `a,b` and a kilobyte of caller
// text sat in both. `/api/story/continue` had the opposite defect: it generated
// an id, logged under it, and never sent it, so the caller could not name the id
// its failure was recorded under.

import assert from 'node:assert/strict';
import {
  MAX_REQUEST_ID_LENGTH,
  applyRequestId,
  generateRequestId,
  readRequestId
} from '../api/_lib/http/requestId';
import exportHandler from '../api/export/save';
import continueHandler from '../api/story/continue';
import generateHandler from '../api/story/generate';

function request(headers: unknown): unknown {
  return { headers };
}

function isGenerated(value: string): boolean {
  return /^req_[0-9a-f-]{36}$/.test(value);
}

// ==================== a usable caller id is kept ====================

assert.equal(readRequestId(request({ 'x-request-id': 'abc-123' })), 'abc-123');
assert.equal(
  readRequestId(request({ 'x-request-id': '  01234567-89ab-cdef-0123-456789abcdef  ' })),
  '01234567-89ab-cdef-0123-456789abcdef',
  'surrounding whitespace is trimmed rather than making the id unusable'
);
assert.equal(
  readRequestId(request({ 'x-request-id': '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' })),
  '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  'a W3C traceparent is a usable correlation id'
);

// HTTP header names are case-insensitive, and not every runtime hands the bag
// over lowercased the way Node does.
assert.equal(readRequestId(request({ 'X-Request-ID': 'abc-123' })), 'abc-123');

// ==================== anything else is replaced, not reshaped ====================

const tooLong = 'a'.repeat(MAX_REQUEST_ID_LENGTH + 1);
assert.ok(
  isGenerated(readRequestId(request({ 'x-request-id': tooLong }))),
  'an oversized id is replaced rather than truncated into an id that appears in no log'
);
assert.ok(
  isGenerated(readRequestId(request({ 'x-request-id': 'has spaces' }))),
  'a value outside the request-id character set is replaced'
);
assert.ok(
  isGenerated(readRequestId(request({ 'x-request-id': 'trailer] Export succeeded [req_x' }))),
  'a value shaped to forge a log-line prefix is replaced'
);
assert.ok(isGenerated(readRequestId(request({ 'x-request-id': '   ' }))), 'a blank id is replaced');
assert.ok(isGenerated(readRequestId(request({ 'x-request-id': '' }))), 'an empty id is replaced');

// A repeated header arrives as `string[]`. Only the first value is read, the
// same rule the CORS policy and the API key middleware already use — the array
// itself must never reach `setHeader`, which would emit the header twice.
assert.equal(readRequestId(request({ 'x-request-id': ['first-id', 'second-id'] })), 'first-id');
assert.ok(
  isGenerated(readRequestId(request({ 'x-request-id': ['not a token', 'ok-id'] }))),
  'a repeated header is judged on the value that would have been used'
);

// Nothing about a header bag is guaranteed: a route must not fail over its own
// correlation id.
assert.ok(isGenerated(readRequestId(request(undefined))));
assert.ok(isGenerated(readRequestId(request('not-an-object'))));
assert.ok(isGenerated(readRequestId({})));
assert.ok(isGenerated(readRequestId(null)));
assert.ok(isGenerated(readRequestId(request({ 'x-request-id': 42 }))), 'a non-string header value is replaced');

// ==================== the id used is the id answered ====================

const headersSent: Array<[string, string]> = [];
const echoed = applyRequestId(request({ 'x-request-id': 'caller-id' }), {
  setHeader(name, value) {
    headersSent.push([name, value]);
  }
});

assert.equal(echoed, 'caller-id');
assert.deepEqual(headersSent, [['X-Request-ID', 'caller-id']]);

// When the caller's value is replaced, the response still names the id the logs
// will carry — otherwise the substitution would be invisible.
const replacedHeaders: Array<[string, string]> = [];
const replaced = applyRequestId(request({ 'x-request-id': 'not a token' }), {
  setHeader(name, value) {
    replacedHeaders.push([name, value]);
  }
});

assert.ok(isGenerated(replaced));
assert.deepEqual(replacedHeaders, [['X-Request-ID', replaced]]);

// A response double that does not model `setHeader` reads as a response that
// cannot carry one, not as a reason to throw.
assert.ok(isGenerated(applyRequestId(request({}), {})));

// ==================== the routes actually answer with one ====================

// `/api/story/continue` generated an id, logged every line under it, and never
// sent it. Driving the real handlers is what proves the header is on the wire;
// a 405 is the cheapest way in, and the id is settled before method dispatch.

function routeResponse(): { res: any; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status() {
      return res;
    },
    json() {
      return undefined;
    },
    end() {
      return undefined;
    }
  };

  return { res, headers };
}

async function testEveryRouteAnswersWithItsCorrelationId(): Promise<void> {
  const routes: Array<[string, (req: any, res: any) => unknown]> = [
    ['/api/story/generate', generateHandler],
    ['/api/story/continue', continueHandler],
    ['/api/export/save', exportHandler]
  ];

  for (const [path, route] of routes) {
    const echoed = routeResponse();
    await route({ method: 'GET', headers: {}, body: undefined }, echoed.res);
    assert.ok(
      isGenerated(echoed.headers['X-Request-ID'] ?? ''),
      `${path} should answer with the correlation id it logs under`
    );

    const forwarded = routeResponse();
    await route({ method: 'GET', headers: { 'x-request-id': 'caller-id' }, body: undefined }, forwarded.res);
    assert.equal(
      forwarded.headers['X-Request-ID'],
      'caller-id',
      `${path} should log under the id the caller sent, not a second one`
    );

    const repeated = routeResponse();
    await route(
      { method: 'GET', headers: { 'x-request-id': ['first-id', 'second-id'] }, body: undefined },
      repeated.res
    );
    assert.equal(
      repeated.headers['X-Request-ID'],
      'first-id',
      `${path} must not answer a repeated header as the joined array "first-id,second-id"`
    );
  }
}

// ==================== generated ids are distinct ====================

const generated = new Set(Array.from({ length: 50 }, () => generateRequestId()));
assert.equal(generated.size, 50, 'generated ids must not collide, or two requests share a log key');

testEveryRouteAnswersWithItsCorrelationId().then(
  () => {
    console.log('Request id correlation tests passed');
  },
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);
