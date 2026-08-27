#!/usr/bin/env tsx
// Created: 2026-08-25 03:20 UTC

import { EventEmitter } from 'node:events';

import genesisHandler from '../api/story-lab/stream/genesis';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const originalEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  VERCEL_ENV: process.env['VERCEL_ENV'],
  STORY_LAB_FORCE_MOCK: process.env['STORY_LAB_FORCE_MOCK'],
  XAI_API_KEY: process.env['XAI_API_KEY']
};

function setMockRuntime(): void {
  process.env['NODE_ENV'] = 'test';
  delete process.env['VERCEL_ENV'];
  process.env['STORY_LAB_FORCE_MOCK'] = '1';
  delete process.env['XAI_API_KEY'];
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

class FakeSocket extends EventEmitter {}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  chunks: string[] = [];
  ended = false;
  body: unknown = null;
  // The lifecycle flag Node sets when the socket underneath the response is
  // gone. The route reads it to decide whether a frame can still land.
  destroyed = false;
  // Node answers a write to a destroyed response by throwing
  // `ERR_STREAM_DESTROYED`. Counted rather than thrown: the writes this proves
  // wrong happen inside the route's own `setTimeout` callbacks, where nothing
  // catches, so re-enacting the throw would take the test process down instead
  // of reporting which write was wrong.
  writesAfterClose = 0;

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

  writeHead(statusCode: number, headers: Record<string, string> = {}): void {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
  }

  write(chunk: string): void {
    if (this.destroyed) {
      this.writesAfterClose += 1;
      return;
    }

    this.chunks.push(chunk);
  }

  end(): void {
    if (this.destroyed) {
      this.writesAfterClose += 1;
      return;
    }

    this.ended = true;
  }
}

/**
 * `socket` is optional because the route treats it as optional: it wires its
 * disconnect listener through `req.socket?.on?.`, so a runtime that hands the
 * handler no socket is a case the route already claims to serve.
 */
function createRequest(socket?: FakeSocket) {
  return {
    method: 'GET',
    socket,
    headers: { origin: 'https://spice.example.app', host: 'spice.example.app' },
    query: {
      creature: 'vampire',
      tone: 'dark_romance',
      spicyLevel: '2',
      desiredWordBudget: '600',
      chapterBatchSize: '2',
      logline: 'A vampire archivist bargains for one more night.',
      themes: JSON.stringify([
        { id: 'forbidden_love', label: 'Forbidden Love', description: 'Desire has consequences.' }
      ]),
      heatContract: JSON.stringify({
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'fade_to_black',
        noGoContent: 'No coercion.'
      })
    }
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * The route staggers its frames on timers, so a disconnect that lands while the
 * generation is still running is only observable after those timers would have
 * fired. Three chapter timers plus a completion timer at 500ms apart is 2s of
 * wall clock; waiting past it is what proves nothing was scheduled behind the
 * reader's back.
 */
const PAST_EVERY_SCHEDULED_FRAME_MS = 2200;

async function testDisconnectStopsTheStream(): Promise<void> {
  setMockRuntime();

  const socket = new FakeSocket();
  const response = new FakeResponse();
  const finished = genesisHandler(createRequest(socket), response);

  // The route now checks API access control before opening the stream, which
  // is a real `await` (an in-memory check, no I/O) ahead of the `connected`
  // frame. Letting that settle still lands well before the frame the
  // generation await would produce, so the invariant under test — the
  // connected frame is out before the expensive work is awaited — holds.
  await delay(0);

  const chunksAtDisconnect = response.chunks.length;
  assert(chunksAtDisconnect === 1, 'the connected frame should be written before the generation is awaited');

  socket.emit('close');

  await finished;
  await delay(PAST_EVERY_SCHEDULED_FRAME_MS);

  assert(
    response.chunks.length === chunksAtDisconnect,
    'no frame should be written to a stream the client already closed'
  );
  assert(!response.ended, 'a response whose socket is gone should not be ended again');
}

async function testAConnectedReaderStillReceivesTheWholeStream(): Promise<void> {
  setMockRuntime();

  const socket = new FakeSocket();
  const response = new FakeResponse();

  await genesisHandler(createRequest(socket), response);
  await delay(PAST_EVERY_SCHEDULED_FRAME_MS);

  assert(response.statusCode === 200, 'a streaming genesis should answer 200');
  assert(
    response.headers['Content-Type'] === 'text/event-stream',
    'a streaming genesis should use the SSE content type'
  );
  // Without this, an nginx in front of the app buffers the whole response and
  // the reader gets every frame at once when the generation ends — a stream
  // that is not one.
  assert(
    response.headers['X-Accel-Buffering'] === 'no',
    'a streaming genesis should tell a proxy not to buffer its frames'
  );
  assert(
    response.headers['Cache-Control'] === 'no-cache, no-transform',
    'a streaming genesis should keep its frames uncached and untransformed'
  );

  const output = response.chunks.join('');
  assert(output.includes('"type":"connected"'), 'the stream should open with a connected frame');
  assert(output.includes('"type":"chapter_progress"'), 'the stream should carry chapter progress');
  assert(output.includes('"type":"batch_complete"'), 'the stream should report the batch completing');
  assert(response.ended, 'a stream a reader stayed on should be ended by the route');
}

/**
 * The disconnect flag is not the only thing that knows the reader has gone, and
 * on the runtime this case models it is not one of them: with no socket to
 * listen on, `clientDisconnected` stays `false` for the whole generation. Every
 * chapter timer and the completion timer then wrote into a response Node had
 * already destroyed, and each of those writes answers with
 * `ERR_STREAM_DESTROYED` — thrown from inside a `setTimeout` callback that the
 * route does not wrap, so it is an uncaught exception rather than a handled
 * one. Reading the response's own lifecycle flag is what keeps the frames from
 * being attempted at all.
 */
async function testAClosedResponseWithoutASocketIsNeverWrittenTo(): Promise<void> {
  setMockRuntime();

  const response = new FakeResponse();
  const finished = genesisHandler(createRequest(), response);

  // See the equivalent wait in `testDisconnectStopsTheStream` above: the
  // route's access-control check is a real `await` ahead of the `connected`
  // frame now.
  await delay(0);

  assert(
    response.chunks.length === 1,
    'the connected frame should be written before the generation is awaited'
  );

  response.destroyed = true;

  await finished;
  await delay(PAST_EVERY_SCHEDULED_FRAME_MS);

  assert(
    response.writesAfterClose === 0,
    `a destroyed response should be written to no further times, got ${response.writesAfterClose}`
  );
  assert(
    response.chunks.length === 1,
    'no frame should reach a reader who is already gone'
  );
}

/** Every `data:` frame the route wrote, parsed back out of the SSE framing. */
function readFrames(response: FakeResponse): Array<Record<string, any>> {
  return response.chunks
    .join('')
    .split('\n\n')
    .filter(frame => frame.startsWith('data: '))
    .map(frame => JSON.parse(frame.slice('data: '.length)));
}

/**
 * The countdown a chapter frame carries has to be a countdown to the story,
 * not to the chapter before it.
 *
 * `estimatedMsRemaining` counted the chapters still to be replayed and stopped
 * there, but the replay does not end on the last chapter: the payload the
 * reader is waiting for goes out one interval later, in the completion frame.
 * So the final `chapter_progress` frame reported `0` — "arriving now" — while
 * the story it announces had not been sent, which is the one moment a
 * countdown must not be wrong about.
 */
async function testTheCountdownRunsOutOnlyWhenTheStoryArrives(): Promise<void> {
  setMockRuntime();

  const response = new FakeResponse();
  await genesisHandler(createRequest(new FakeSocket()), response);
  await delay(PAST_EVERY_SCHEDULED_FRAME_MS);

  const frames = readFrames(response);
  const chapterFrames = frames.filter(frame => frame.type === 'chapter_progress');
  assert(chapterFrames.length > 0, 'the stream should carry at least one chapter frame');

  for (const frame of chapterFrames) {
    assert(
      typeof frame.estimatedMsRemaining === 'number' && frame.estimatedMsRemaining > 0,
      `a chapter frame should not report the story as already arrived, got ${frame.estimatedMsRemaining}`
    );
  }

  // The replay is evenly spaced, so each frame's estimate is the number of
  // frames still to come times one interval — and for the last chapter that is
  // exactly the completion frame.
  const estimates = chapterFrames.map(frame => frame.estimatedMsRemaining as number);
  const interval = estimates[estimates.length - 1];
  estimates.forEach((estimate, index) => {
    const framesRemaining = estimates.length - index;
    assert(
      estimate === framesRemaining * interval,
      `chapter ${index + 1} should count down ${framesRemaining} frames, got ${estimate}`
    );
  });
}

async function testInvalidBlueprintNeverOpensAStream(): Promise<void> {
  setMockRuntime();

  const socket = new FakeSocket();
  const response = new FakeResponse();
  const request = createRequest(socket);
  request.query.creature = 'gargoyle';

  await genesisHandler(request, response);

  assert(response.statusCode === 400, 'an unsupported creature should be refused before the stream opens');
  assert(response.chunks.length === 0, 'a refused request should write no SSE frames');
}

async function run(): Promise<void> {
  await testDisconnectStopsTheStream();
  await testAClosedResponseWithoutASocketIsNeverWrittenTo();
  await testAConnectedReaderStillReceivesTheWholeStream();
  await testTheCountdownRunsOutOnlyWhenTheStoryArrives();
  await testInvalidBlueprintNeverOpensAStream();

  console.log('Story Lab genesis stream tests passed');
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    restoreEnv();
  });
