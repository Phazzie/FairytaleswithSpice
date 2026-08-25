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
    this.chunks.push(chunk);
  }

  end(): void {
    this.ended = true;
  }
}

function createRequest(socket: FakeSocket) {
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

  // The `connected` frame is written before the generation is awaited, so it is
  // already out; everything after it belongs to a reader who has left.
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

  const output = response.chunks.join('');
  assert(output.includes('"type":"connected"'), 'the stream should open with a connected frame');
  assert(output.includes('"type":"chapter_progress"'), 'the stream should carry chapter progress');
  assert(output.includes('"type":"batch_complete"'), 'the stream should report the batch completing');
  assert(response.ended, 'a stream a reader stayed on should be ended by the route');
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
  await testAConnectedReaderStillReceivesTheWholeStream();
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
