#!/usr/bin/env tsx
// Created: 2026-08-24 22:15 UTC
//
// HTTP-contract regressions for the legacy story routes:
//
// 1. `/api/story/stream` frames its Server-Sent Events with real newlines, so a
//    client can dispatch them. The frames used to end with a literal `\n` —
//    backslash, then `n` — which never ends an event.
// 2. `/api/story/generate`, `/api/story/continue`, and `/api/export/save`
//    answer a missing or non-object body with 400 INVALID_INPUT rather than
//    crashing into their catch block and reporting 500 INTERNAL_ERROR.

import exportHandler from '../api/export/save';
import continueHandler from '../api/story/continue';
import generateHandler from '../api/story/generate';
import { formatSseFrame } from '../api/story/stream';

interface FakeRequest {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
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

  end(): void {
    this.ended = true;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Read a stream the way a client does: an event is dispatched by the blank line
 * that terminates it, and each `data:` line contributes to its payload.
 *
 * Written as a parser rather than as a string comparison so the test fails for
 * the reason the client fails — an unterminated event is simply not delivered.
 */
function parseSseEvents(stream: string): unknown[] {
  const events: unknown[] = [];

  for (const frame of stream.split('\n\n')) {
    const dataLines = frame
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trim());

    if (dataLines.length === 0) {
      continue;
    }

    events.push(JSON.parse(dataLines.join('\n')));
  }

  return events;
}

async function expectMissingBodyRejected(
  name: string,
  handler: (req: any, res: any) => Promise<void> | void,
  body: unknown
): Promise<void> {
  const req: FakeRequest = { method: 'POST', headers: {}, body };
  const res = new FakeResponse();

  await handler(req, res);

  assert(
    res.statusCode === 400,
    `${name} should answer a ${describeBody(body)} body with 400, got ${res.statusCode}`
  );

  const payload = res.body as { success?: boolean; error?: { code?: string } };
  assert(payload?.success === false, `${name} should report failure for a ${describeBody(body)} body`);
  assert(
    payload?.error?.code === 'INVALID_INPUT',
    `${name} should report INVALID_INPUT for a ${describeBody(body)} body, got ${payload?.error?.code}`
  );
}

function describeBody(body: unknown): string {
  if (body === undefined) {
    return 'missing';
  }
  if (Array.isArray(body)) {
    return 'array';
  }
  return typeof body;
}

function verifySseFraming(): void {
  const connectedFrame = formatSseFrame({ type: 'connected', streamId: 'stream_1' });

  assert(
    connectedFrame.endsWith('\n\n'),
    'an SSE frame must end with two real newlines so the client dispatches the event'
  );
  assert(
    !connectedFrame.includes(String.raw`\n`),
    'an SSE frame must not carry a literal backslash-n in place of its terminator'
  );

  // Two frames back to back have to read back as two events, which is the whole
  // point of the terminator: with the literal spelling the buffer below parses
  // as one unterminated event carrying both payloads.
  const stream = connectedFrame + formatSseFrame({ type: 'chunk', content: 'She opened the door.' });
  const events = parseSseEvents(stream) as Array<{ type?: string; content?: string }>;

  assert(events.length === 2, `two frames should dispatch as two events, got ${events.length}`);
  assert(events[0]?.type === 'connected', 'the first event should be the connection notice');
  assert(events[1]?.content === 'She opened the door.', 'the second event should carry its chunk content');

  // Story content is the one thing that could terminate a frame early. JSON
  // escapes the newlines inside it, so a multi-paragraph chunk is still one event.
  const multilineEvents = parseSseEvents(
    formatSseFrame({ type: 'chunk', content: 'First paragraph.\n\nSecond paragraph.' })
  ) as Array<{ content?: string }>;

  assert(multilineEvents.length === 1, 'a chunk containing blank lines must stay one event');
  assert(
    multilineEvents[0]?.content === 'First paragraph.\n\nSecond paragraph.',
    'a chunk containing blank lines must survive the round trip intact'
  );
}

async function verifyMalformedBodiesAreClientErrors(): Promise<void> {
  const malformedBodies: unknown[] = [undefined, null, 'creature=vampire', []];

  for (const body of malformedBodies) {
    await expectMissingBodyRejected('/api/story/generate', generateHandler, body);
    await expectMissingBodyRejected('/api/story/continue', continueHandler, body);
    await expectMissingBodyRejected('/api/export/save', exportHandler, body);
  }
}

async function main(): Promise<void> {
  verifySseFraming();
  await verifyMalformedBodiesAreClientErrors();

  console.log('Story route contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
