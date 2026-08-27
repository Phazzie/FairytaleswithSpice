#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

/**
 * Every `405` this API answers has to carry `Allow`.
 *
 * RFC 9110 §15.5.6 is not optional about it — "The origin server MUST generate
 * an Allow header field in a 405 response containing a list of the target
 * resource's currently supported methods" — and it is the only part of the
 * answer a caller can read without knowing this API's envelope. The routes
 * already named their methods in the `message`, in prose, which is legible to a
 * person reading a log and to nothing else.
 *
 * `Access-Control-Allow-Methods` does not stand in for it: every route here
 * emits one, but it is the CORS preflight answer, so a same-origin fetch, a
 * `curl`, or a server-to-server caller never sees it.
 *
 * Driven through the real handlers rather than through `sendMethodNotAllowed`
 * alone, because the thing worth asserting is that each route reached it with
 * its own list — the account resources are covered in
 * `story-lab-account-routes.test.ts`, where the handler already has an auth
 * port to reach its method check with.
 */

import { formatAllowedMethods } from '../api/_lib/http/methodNotAllowed';
import healthHandler from '../api/health';
import exportSaveHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import evaluateHandler from '../api/story-lab/evaluate';
import { handleGetStoryLabJob } from '../api/_lib/story-lab/jobs/jobRouteHandlers';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: any = null;

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
  write(): boolean {
    return true;
  }
}

// ==================== THE LIST ITSELF ====================

assert(
  formatAllowedMethods(['post', 'options']) === 'POST, OPTIONS',
  'Allow should be upper-cased and comma-separated'
);
assert(
  formatAllowedMethods(['GET', 'get', ' GET ', 'OPTIONS']) === 'GET, OPTIONS',
  'Allow should not repeat a method it was handed twice'
);
assert(
  formatAllowedMethods(['GET', '', '   ', 'OPTIONS']) === 'GET, OPTIONS',
  'Allow should not carry an empty entry'
);

// ==================== THE ROUTES ====================

interface RouteCase {
  name: string;
  handler: (req: any, res: any) => unknown;
  request: Record<string, unknown>;
  allow: string;
}

const routes: RouteCase[] = [
  {
    name: '/api/health',
    handler: healthHandler,
    request: { method: 'POST', headers: {} },
    allow: 'GET, OPTIONS'
  },
  {
    name: '/api/export/save',
    handler: exportSaveHandler,
    request: { method: 'GET', headers: {} },
    allow: 'POST, OPTIONS'
  },
  {
    name: '/api/image/generate',
    handler: imageGenerateHandler,
    request: { method: 'GET', headers: {} },
    allow: 'POST, OPTIONS'
  },
  {
    name: '/api/story-lab/evaluate',
    handler: evaluateHandler,
    request: { method: 'GET', headers: {} },
    allow: 'POST, OPTIONS'
  },
  {
    name: '/api/story-lab/jobs/:jobId',
    handler: handleGetStoryLabJob,
    request: { method: 'PUT', headers: {}, query: { jobId: 'job-1' } },
    allow: 'GET, OPTIONS'
  }
];

async function run() {
  for (const route of routes) {
    const response = new FakeResponse();
    await route.handler(route.request, response);

    assert(
      response.statusCode === 405,
      `${route.name} should answer 405 for a method it does not serve, got ${response.statusCode}`
    );
    assert(
      response.body?.error?.code === 'METHOD_NOT_ALLOWED',
      `${route.name} should answer with the METHOD_NOT_ALLOWED code`
    );
    assert(
      response.headers['Allow'] === route.allow,
      `${route.name} should send Allow: ${route.allow}, got ${JSON.stringify(response.headers['Allow'])}`
    );
  }

  console.log('Method-not-allowed Allow header tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
