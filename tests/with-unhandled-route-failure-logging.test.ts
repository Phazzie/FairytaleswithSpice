#!/usr/bin/env tsx
// Created: 2026-09-05 UTC
//
// Codex's review of PR #339 found that every backend `logCritical` call site
// (`expressApiRoutes.ts`'s `apiErrorHandler`, `unhandledProcessFailureLogger.ts`)
// is reachable only through the standalone Express/Docker server. `vercel.json`
// deploys every file under `api/` as its own isolated serverless function
// instead, invoked directly with no Express error middleware wrapped around
// it — so on that deployment, an error escaping a route handler's own
// try/catch never reached `logCritical`, and `/api/health`'s new
// `services.criticalAlerting` field could report a fully working webhook that
// no backend code path was actually capable of calling. This suite pins the
// wrapper that closes that gap.

import assert from 'node:assert/strict';
import { withUnhandledRouteFailureLogging } from '../api/_lib/http/withUnhandledRouteFailureLogging';
import { logger } from '../api/_lib/utils/logger';

class FakeResponse {
  headersSent = false;
  statusCode = 0;
  body: unknown = null;
  ended: string | undefined;
  endCalls = 0;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.headersSent = true;
  }

  setHeader(): void {
    // no-op
  }

  end(payload?: string): void {
    this.ended = payload;
    this.headersSent = true;
    this.endCalls += 1;
  }
}

function createRequest(overrides: Partial<{ method: string; url: string }> = {}): any {
  return { method: 'POST', url: '/api/example', headers: {}, ...overrides };
}

async function testPassesThroughANormallyHandledRequest(): Promise<void> {
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging((_req, r) => {
    r.status(200).json({ success: true });
  });

  await wrapped(createRequest(), res);

  assert.equal(res.statusCode, 200, 'a handler that answers normally should be untouched');
  assert.deepEqual(res.body, { success: true });
}

async function testLogsAndAnswers500OnASynchronousThrow(): Promise<void> {
  logger.clearLogs();
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging(() => {
    throw new Error('bug before the handler\'s own try block');
  });

  await wrapped(createRequest(), res);

  assert.equal(res.statusCode, 500, 'a synchronous throw should still answer 500');
  const body = res.body as { success: boolean; error: { code: string } };
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'INTERNAL_ERROR');

  const critical = logger.getRecentLogs(10, 'critical').find(entry => entry.message === 'Unhandled API route failure');
  assert.ok(critical, 'a synchronous throw should be logged at critical severity');
  assert.equal(critical?.error?.message, 'bug before the handler\'s own try block');
}

async function testLogsAndAnswers500OnARejectedPromise(): Promise<void> {
  logger.clearLogs();
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging(async () => {
    throw new Error('rejected after an await');
  });

  await wrapped(createRequest(), res);

  assert.equal(res.statusCode, 500, 'a rejected handler promise should still answer 500');
  const critical = logger.getRecentLogs(10, 'critical').find(entry => entry.message === 'Unhandled API route failure');
  assert.ok(critical, 'a rejected promise should be logged at critical severity');
}

async function testNeverWritesASecondResponseOnceHeadersAreSent(): Promise<void> {
  logger.clearLogs();
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging(async (_req, r) => {
    // Simulates an SSE route that has already started streaming before a
    // later chunk throws.
    r.json({ event: 'started' });
    throw new Error('failed mid-stream');
  });

  await wrapped(createRequest(), res);

  assert.deepEqual(res.body, { event: 'started' }, 'the original response body must not be overwritten');
  const critical = logger.getRecentLogs(10, 'critical').find(entry => entry.message === 'Unhandled API route failure');
  assert.ok(critical, 'a failure after headers are sent should still be logged at critical severity');
}

// Leaving the connection open after a mid-stream escape would strand the
// caller until the platform's own function timeout instead of observing that
// the stream ended. Tracked separately from the "body unchanged" assertion
// above via a response double that records whether `end()` was ever called.
async function testClosesTheConnectionOnAMidStreamEscape(): Promise<void> {
  logger.clearLogs();
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging(async (_req, r) => {
    r.json({ event: 'started' });
    throw new Error('failed mid-stream');
  });

  await wrapped(createRequest(), res);

  assert.equal(res.endCalls, 1, 'a mid-stream escape should close the connection exactly once');
}

async function testLoggedContextCarriesRequestMethodAndPath(): Promise<void> {
  logger.clearLogs();
  const res = new FakeResponse();
  const wrapped = withUnhandledRouteFailureLogging(() => {
    throw new Error('boom');
  });

  await wrapped(createRequest({ method: 'DELETE', url: '/api/story-lab/jobs?jobId=abc' }), res);

  const critical = logger.getRecentLogs(10, 'critical').find(entry => entry.message === 'Unhandled API route failure');
  assert.equal(critical?.context?.method, 'DELETE');
  assert.equal(critical?.context?.endpoint, '/api/story-lab/jobs?jobId=abc');
}

async function main(): Promise<void> {
  await testPassesThroughANormallyHandledRequest();
  await testLogsAndAnswers500OnASynchronousThrow();
  await testLogsAndAnswers500OnARejectedPromise();
  await testNeverWritesASecondResponseOnceHeadersAreSent();
  await testClosesTheConnectionOnAMidStreamEscape();
  await testLoggedContextCarriesRequestMethodAndPath();

  logger.clearLogs();
  console.log('withUnhandledRouteFailureLogging tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
