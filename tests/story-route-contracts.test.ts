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
// 3. `/api/story/stream` opens the stream with the cache headers it set, and
//    records a failure against the method the request actually used.

import { StoryService } from '../api/_lib/services/storyService';
import { VALIDATION_RULES } from '../api/_lib/types/contracts';
import { logger } from '../api/_lib/utils/logger';
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
  // Node's own `ServerResponse` flips this in `writeHead`, and the stream route
  // reads it to decide whether a failure can still be answered as JSON or has
  // to be framed into the stream that is already open.
  headersSent = false;

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
    this.headersSent = true;
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
  const frames = stream.split('\n\n');
  // Whatever follows the last terminator is not an event. A client holds it in
  // its buffer waiting for the blank line that never came, so a completion or a
  // terminal error written without one is never delivered — and handing that
  // tail back here would let the route look correct while the client got
  // nothing. When the stream is properly terminated this discards an empty
  // string instead.
  frames.pop();

  for (const frame of frames) {
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

/**
 * Drive `/api/story/stream` as an `EventSource` would, with query parameters,
 * and report what the client received.
 *
 * The generator is stubbed out for the same reason as above: this is about what
 * the route makes of the query, not about generation.
 */
async function callStreamRouteWithQuery(
  query: Record<string, unknown>,
  generate?: (input: any, onChunk: (chunk: any) => void) => Promise<void>
): Promise<FakeResponse> {
  const original = StoryService.prototype.generateStoryStreaming;
  StoryService.prototype.generateStoryStreaming = (generate ?? (async (_input: any, onChunk: any) => {
    onChunk({
      content: 'She opened the door.',
      isComplete: true,
      wordsGenerated: 4,
      estimatedWordsRemaining: 0,
      generationSpeed: 4
    });
  })) as typeof original;

  try {
    const res = new FakeResponse();
    await streamHandler({ method: 'GET', headers: {}, query }, res);
    return res;
  } finally {
    StoryService.prototype.generateStoryStreaming = original;
  }
}

const VALID_STREAM_QUERY = {
  creature: 'vampire',
  themes: 'romance',
  spicyLevel: '3',
  wordCount: String(VALIDATION_RULES.wordCount.allowedValues[1])
};

/**
 * The headers a client and the proxies between it and this route actually
 * receive.
 *
 * `FakeResponse.writeHead` merges its argument over what `setHeader` already
 * wrote, exactly as Node's `ServerResponse` does, which is what made the defect
 * invisible from inside the route: the handler set `no-cache, no-transform` and
 * then passed `no-cache` to `writeHead`, so the directive that stops an
 * intermediary from buffering the stream was dropped on the way out.
 */
async function verifyStreamOpensWithTheHeadersItSet(): Promise<void> {
  const response = await callStreamRouteWithQuery(VALID_STREAM_QUERY);

  assert(response.headersSent, 'a valid streaming request should open the stream');
  assert(
    response.headers['Content-Type'] === 'text/event-stream',
    `the stream should be served as text/event-stream, got ${response.headers['Content-Type']}`
  );

  const cacheControl = response.headers['Cache-Control'] ?? '';
  assert(
    cacheControl.includes('no-cache'),
    `the stream must not be cached, got Cache-Control: ${cacheControl}`
  );
  assert(
    cacheControl.includes('no-transform'),
    `the stream must forbid transformation so a proxy cannot buffer it, got Cache-Control: ${cacheControl}`
  );
  assert(
    response.headers['X-Accel-Buffering'] === 'no',
    'the stream must ask nginx not to buffer it'
  );
}

/**
 * A GET failure is recorded as a GET.
 *
 * The catch block named `POST` unconditionally, and GET is the path an
 * `EventSource` takes — so every browser-side streaming failure was filed under
 * the method it did not use, which is the field that says whether the input
 * arrived as a JSON body or as a query.
 */
async function verifyStreamFailureRecordsTheRequestMethod(): Promise<void> {
  logger.clearLogs();

  const response = await callStreamRouteWithQuery(VALID_STREAM_QUERY, async () => {
    throw new Error('provider unavailable');
  });

  assert(
    response.headersSent,
    'the failure should happen after the stream is open, which is the case this covers'
  );

  const failure = logger
    .getRecentLogs(50, 'error')
    .find(entry => entry.context?.endpoint === '/api/story/stream');

  assert(failure, 'a streaming failure should be logged against the stream endpoint');
  assert(
    failure.context?.method === 'GET',
    `a failed GET stream should be logged as a GET, got ${failure.context?.method}`
  );

  logger.clearLogs();
}

async function verifyRepeatedQueryParametersReachTheValidator(): Promise<void> {
  const validQuery = VALID_STREAM_QUERY;

  // `?themes=romance&themes=dark` used to throw out of `themes.split(',')`,
  // and the catch block answered with an SSE frame written before `writeHead`
  // — a default 200 with no `text/event-stream` content type, which is neither
  // a stream a client dispatches nor a JSON error one can read.
  const repeatedThemes = await callStreamRouteWithQuery({
    ...validQuery,
    themes: ['romance', 'dark']
  });

  assert(
    repeatedThemes.headersSent,
    'a repeated themes parameter should open a stream, not fail before the headers'
  );
  const repeatedThemeEvents = parseSseEvents(repeatedThemes.written) as Array<{ type?: string }>;
  assert(
    repeatedThemeEvents.some(event => event.type === 'connected'),
    `a repeated themes parameter should still connect (stream=${repeatedThemes.written.slice(0, 120)}…)`
  );
  assert(
    !repeatedThemeEvents.some(event => event.type === 'error'),
    'a repeated themes parameter should not fail the stream'
  );

  // `?creature=vampire&creature=witch` did not throw at all: an array is
  // truthy, so it passed validation, the 200 and the `connected` frame went
  // out, and the story service rejected the array mid-stream. Read as a single
  // value it is an ordinary vampire request.
  const repeatedCreature = await callStreamRouteWithQuery({
    ...validQuery,
    creature: ['vampire', 'witch']
  });
  const repeatedCreatureEvents = parseSseEvents(repeatedCreature.written) as Array<{ type?: string }>;

  assert(
    !repeatedCreatureEvents.some(event => event.type === 'error'),
    'a repeated creature parameter should not fail the stream mid-flight'
  );

  // The point of not throwing during parsing is that the route's own validator
  // gets to answer. A repeat that is genuinely invalid has to reach it.
  const invalidRepeat = await callStreamRouteWithQuery({
    ...validQuery,
    creature: ['', 'witch']
  });

  assert(
    invalidRepeat.statusCode === 400,
    `an invalid repeated creature should be a client error, got ${invalidRepeat.statusCode}`
  );
  assert(
    (invalidRepeat.body as any)?.error?.code === 'INVALID_INPUT',
    'an invalid repeated creature should be reported as INVALID_INPUT'
  );
  assert(
    invalidRepeat.written === '',
    'a request rejected before generation should not have opened a stream'
  );
}

/**
 * The request line this route writes must not repeat what the caller typed.
 *
 * The generation parameters are logged so an operator can see what was asked
 * for, and `themes` is documented as a closed set — but `validateStoryInput`
 * only bounds how many themes there are, and this route builds the array by
 * splitting a query string, so an API client can put anything in it. Asserting
 * on the helper alone is not enough: the route is the thing that decides what
 * reaches the buffer, and it could go back to passing `input.themes` straight
 * through with every helper-level assertion still passing.
 */
async function verifyStreamDoesNotLogCallerText(): Promise<void> {
  logger.clearLogs();

  const privateProse = 'Dana is in treatment at the clinic on Rosewood';
  const creatureProse = 'a shapeshifter who lives at 14 Elm Row';
  // `forbidden_love` is on `VALIDATION_RULES.themes.allowedValues`; the fixture
  // theme these tests otherwise send, `romance`, is not — the routes accept it
  // because validation counts themes without checking them against the list, so
  // it is logged as unrecognized like any other unknown value.
  const { response, consoleOutput } = await captureConsole(() => callStreamRouteWithQuery({
    ...VALID_STREAM_QUERY,
    creature: creatureProse,
    themes: `forbidden_love,${privateProse}`
  }));

  assert(response.headersSent, 'an unrecognized theme should still open the stream');

  const started = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story/stream');

  assert(started, 'the stream route should log the request it started');
  // Without this the console assertions below would pass on an empty capture,
  // proving nothing about the sink.
  assert(
    consoleOutput.includes('/api/story/stream'),
    `the console capture should hold the request line (got ${consoleOutput.slice(0, 200)}…)`
  );

  // The buffer and the console are two sinks for the same entry, and a reader
  // of either one is equally able to read what the caller typed.
  for (const [sink, written] of [
    ['buffer', JSON.stringify(started.context)],
    ['console', consoleOutput]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `caller text sent as a theme must not reach the ${sink} (got ${written})`
    );
    assert(
      !written.includes('Elm Row'),
      `caller text sent as a creature must not reach the ${sink} (got ${written})`
    );
  }

  const logged = JSON.stringify(started.context);
  assert(
    logged.includes('forbidden_love'),
    `an allow-listed theme should still be logged (got ${logged})`
  );
  assert(
    started.context?.requestParameters?.['unrecognizedThemeCount'] === 1,
    `the rejected theme should be counted (got ${JSON.stringify(started.context?.requestParameters)})`
  );
  assert(
    started.context?.requestParameters?.['creature'] === '[UNRECOGNIZED]',
    `an unknown creature should be marked, not repeated (got ${JSON.stringify(started.context?.requestParameters)})`
  );

  logger.clearLogs();
}

/**
 * `storyId` is caller text too, and a length cap was not a filter for it: most
 * prose is shorter than any cap worth having, so a sentence sent as an id went
 * into the log whole. The shape check is what rejects it, and this drives the
 * real continuation route to prove the route uses it.
 */
async function verifyContinueDoesNotLogProseStoryIds(): Promise<void> {
  logger.clearLogs();

  const storyIdProse = 'Dana is in treatment at the clinic on Rosewood';
  const { consoleOutput } = await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId: storyIdProse,
        existingContent: '<p>She opened the door.</p>',
        currentChapterCount: 1
      }
    }, res);
    return res;
  });

  const started = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story/continue');

  assert(started, 'the continuation route should log the request it started');
  assert(
    consoleOutput.includes('/api/story/continue'),
    `the console capture should hold the request line (got ${consoleOutput.slice(0, 200)}…)`
  );

  for (const [sink, written] of [
    ['buffer', JSON.stringify(started.context)],
    ['console', consoleOutput]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `prose sent as a story id must not reach the ${sink} (got ${written})`
    );
  }

  assert(
    started.context?.requestParameters?.['storyId'] === '[UNRECOGNIZED]',
    `a story id that is not shaped like one should be reported (got ${JSON.stringify(started.context?.requestParameters)})`
  );

  // `maintainTone` is the scalar the route does not guard. `currentChapterCount`
  // it does — `typeof input.currentChapterCount !== 'number'` is answered with a
  // 400 before anything is logged — but nothing checks `maintainTone`, and the
  // *service* logs it on the way past. A prose value therefore reaches the
  // request line the service writes, one call below this route.
  logger.clearLogs();
  const scalarProse = 'Dana asked me not to tell anyone about Rosewood';
  const { consoleOutput: scalarConsole } = await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
        existingContent: '<p>She opened the door.</p>',
        currentChapterCount: 1,
        maintainTone: scalarProse
      }
    }, res);
    return res;
  });

  const serviceEntry = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === 'continueChapter');

  assert(serviceEntry, 'the continuation service should log the request it received');
  for (const [sink, written] of [
    ['buffer', JSON.stringify(serviceEntry.context)],
    ['console', scalarConsole]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `prose sent as a flag must not reach the ${sink} (got ${written})`
    );
  }
  assert(
    serviceEntry.context?.requestParameters?.['maintainTone'] === '[UNRECOGNIZED]',
    `a flag that is not a boolean should be reported (got ${JSON.stringify(serviceEntry.context?.requestParameters)})`
  );

  // The ordinary case still logs the id, which is what makes it worth keeping.
  logger.clearLogs();
  const realStoryId = 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';
  await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: { storyId: realStoryId, existingContent: '<p>She opened the door.</p>', currentChapterCount: 1 }
    }, res);
    return res;
  });

  const realEntry = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story/continue');
  assert(
    realEntry?.context?.requestParameters?.['storyId'] === realStoryId,
    `a real story id should still be logged (got ${JSON.stringify(realEntry?.context?.requestParameters)})`
  );

  logger.clearLogs();
}

/**
 * Run something with the console captured, so an assertion can read what the
 * logger actually printed rather than only what it buffered.
 */
async function captureConsole<T>(run: () => Promise<T>): Promise<{ response: T; consoleOutput: string }> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  let consoleOutput = '';
  const record = (...args: unknown[]) => {
    consoleOutput += args.map(argument => String(argument)).join(' ');
  };

  console.log = record;
  console.warn = record;
  console.error = record;

  try {
    return { response: await run(), consoleOutput };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

async function main(): Promise<void> {
  verifySseFraming();
  await verifyStreamRouteEmitsDispatchableEvents();
  await verifyStreamOpensWithTheHeadersItSet();
  await verifyStreamFailureRecordsTheRequestMethod();
  await verifyStreamDoesNotLogCallerText();
  await verifyContinueDoesNotLogProseStoryIds();
  await verifyRepeatedQueryParametersReachTheValidator();
  await verifyMalformedBodiesAreClientErrors();

  console.log('Story route contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
