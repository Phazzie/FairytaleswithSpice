#!/usr/bin/env tsx
// Created: 2026-08-24 22:15 UTC
//
// HTTP-contract regressions for the legacy story routes:
//
// 1. `/api/story/stream` frames its Server-Sent Events with real newlines, so a
//    client can dispatch them. The frames used to end with a literal `\n` —
//    backslash, then `n` — which never ends an event. The route itself is
//    driven, not just the serializer: a call site that stops using
//    `formatSseFrame` breaks the client exactly as the original defect did.
// 2. `/api/story/generate`, `/api/story/continue`, and `/api/export/save`
//    answer a missing or non-object body with 400 INVALID_INPUT rather than
//    crashing into their catch block and reporting 500 INTERNAL_ERROR.

import { StoryService } from '../api/_lib/services/storyService';
import { VALIDATION_RULES } from '../api/_lib/types/contracts';
import exportHandler from '../api/export/save';
import continueHandler from '../api/story/continue';
import generateHandler from '../api/story/generate';
import streamHandler, { formatSseFrame } from '../api/story/stream';

interface FakeRequest {
  method: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;
  written = '';

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

  writeHead(code: number, headers?: Record<string, string>): this {
    this.statusCode = code;
    Object.assign(this.headers, headers ?? {});
    return this;
  }

  write(chunk: string): boolean {
    this.written += chunk;
    return true;
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

    const payload = dataLines.join('\n');
    try {
      events.push(JSON.parse(payload));
    } catch {
      // Unterminated frames run into each other, so the payload holds several
      // JSON objects and the parse fails. Say that, rather than letting a
      // SyntaxError about a character offset stand in for the real problem.
      throw new Error(
        `an SSE frame did not carry exactly one JSON payload, which means the stream is not terminated correctly: ${payload.slice(0, 120)}…`
      );
    }
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

/**
 * Drive `/api/story/stream` with a stubbed generator and return what a client
 * would have received on the wire.
 *
 * The route builds its own `StoryService` at module scope, so the generator is
 * replaced on the prototype for the duration of the call. The real one streams
 * a mock story in 100 ms batches, which proves nothing about framing and would
 * hold the suite for half a minute.
 */
async function collectStreamRouteOutput(
  generate: (input: any, onChunk: (chunk: any) => void) => Promise<void>
): Promise<string> {
  const original = StoryService.prototype.generateStoryStreaming;
  StoryService.prototype.generateStoryStreaming = generate as typeof original;

  try {
    const req: FakeRequest = {
      method: 'POST',
      headers: {},
      body: {
        creature: 'vampire',
        themes: ['romance'],
        userInput: 'A vampire lord meets a mortal librarian.',
        spicyLevel: 3,
        wordCount: VALIDATION_RULES.wordCount.allowedValues[1]
      }
    };
    const res = new FakeResponse();

    await streamHandler(req, res);

    return res.written;
  } finally {
    StoryService.prototype.generateStoryStreaming = original;
  }
}

/**
 * The route's own writes, not just the serializer.
 *
 * Asserting on `formatSseFrame` alone leaves the defect reachable: any of the
 * three `res.write` call sites could go back to interpolating its own
 * terminator and every helper-level assertion would still pass while the client
 * received nothing.
 */
async function verifyStreamRouteEmitsDispatchableEvents(): Promise<void> {
  // The generator emits blank lines between paragraphs, exactly as the mock
  // story does. `JSON.stringify` escapes them, so the serialized payload
  // contains the two characters `\` and `n` where the content has a newline —
  // which is why the stream cannot be scanned for that sequence to decide
  // whether a terminator is real. The frames are read with the parser instead,
  // and this content proves a payload carrying blank lines still dispatches as
  // one event.
  const chunkContent = '<p>She opened the door.</p>\n\n<p>Blood pooled on the floor.</p>';
  const stream = await collectStreamRouteOutput(async (_input, onChunk) => {
    onChunk({
      content: '<p>She opened the door.</p>',
      isComplete: false,
      wordsGenerated: 4,
      estimatedWordsRemaining: 696,
      generationSpeed: 12
    });
    onChunk({
      content: chunkContent,
      isComplete: true,
      wordsGenerated: 9,
      estimatedWordsRemaining: 0,
      generationSpeed: 12
    });
  });

  const events = parseSseEvents(stream) as Array<{ type?: string; content?: string }>;

  assert(
    events.length === 3,
    `the route should dispatch a connected notice, a chunk, and a completion, got ${events.length} event(s)`
  );
  assert(events[0]?.type === 'connected', 'the route should open with a connected notice');
  assert(events[1]?.type === 'chunk', 'the route should dispatch the progress chunk');
  assert(events[2]?.type === 'complete', 'the route should dispatch the completion');
  assert(
    events[2]?.content === chunkContent,
    'a completion whose content carries blank lines should survive the round trip intact'
  );
  // The terminator itself, read where it lives rather than by scanning the
  // whole stream: the last frame the route writes has to end the event.
  assert(
    stream.endsWith('\n\n'),
    'the route must end its last frame with two real newlines'
  );

  // The error path writes its own frame from the catch block and is the one a
  // client most needs to receive.
  const errorStream = await collectStreamRouteOutput(async () => {
    throw new Error('provider unavailable');
  });
  const errorEvents = parseSseEvents(errorStream) as Array<{ type?: string }>;

  assert(
    errorEvents.some(event => event.type === 'error'),
    'a generation failure should reach the client as a dispatchable error event'
  );
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
  // `undefined` and `null` are the regression: reading a field off either threw
  // into the handler's catch block, which answers 500 INTERNAL_ERROR.
  const throwingBodies: unknown[] = [undefined, null];
  // A string and an array never threw — JavaScript allows property access on
  // both, and so did `Object.keys` — so these two already answered 400 before
  // the guard existed. They are here to hold that behaviour, not to prove it
  // was broken.
  const alreadyRejectedBodies: unknown[] = ['creature=vampire', []];

  for (const body of [...throwingBodies, ...alreadyRejectedBodies]) {
    await expectMissingBodyRejected('/api/story/generate', generateHandler, body);
    await expectMissingBodyRejected('/api/story/continue', continueHandler, body);
    await expectMissingBodyRejected('/api/export/save', exportHandler, body);
  }
}

async function main(): Promise<void> {
  verifySseFraming();
  await verifyStreamRouteEmitsDispatchableEvents();
  await verifyMalformedBodiesAreClientErrors();

  console.log('Story route contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
