#!/usr/bin/env tsx
// Created: 2026-08-25 08:22 UTC
//
// Streaming-lifecycle regressions for the Node/Docker deployment's
// `POST /api/story/stream`. The serverless `/api/story/stream` is the same
// route on the other stack and had already been fixed for all three; this one
// had not.
//
// 1. The response is closed when the generation finishes, not only when a chunk
//    happens to carry `isComplete`. Without that, a generation that returns
//    whole — or returns nothing — left the reader watching an open stream until
//    their browser timed out.
// 2. A failure is reported through whichever channel is still readable: JSON
//    before the first frame goes out, an SSE `error` frame after, and nothing
//    at all once the response is closed — writing there answers
//    `ERR_STREAM_WRITE_AFTER_END` and replaces the failure being reported.
// 3. `wordCount` has to be one of the counts the contract allows, so the
//    percentage each frame carries has a real divisor.

import { VALIDATION_RULES } from '../api/_lib/types/contracts';
import type { StoryService } from '../api/_lib/services/storyService';
import {
  handleStoryStreamRequest,
  StoryStreamChunk,
  StoryStreamResponseLike
} from '../story-generator/src/story-stream-route';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Models the lifecycle flags Node sets, and refuses a write after `end()` the
 * way a real `ServerResponse` does — otherwise a route that writes to a closed
 * stream passes here and throws in production, which is the fault being tested.
 */
class FakeResponse implements StoryStreamResponseLike {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  written = '';

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    assert(!this.writableEnded, 'json() called on a response that was already ended');
    this.headersSent = true;
    this.body = body;
    this.writableEnded = true;
  }

  write(chunk: string): boolean {
    assert(!this.writableEnded, 'write() after end() — ERR_STREAM_WRITE_AFTER_END');
    this.headersSent = true;
    this.written += chunk;
    return true;
  }

  end(): void {
    assert(!this.writableEnded, 'end() called twice');
    this.headersSent = true;
    this.writableEnded = true;
  }

  frames(): any[] {
    return this.written
      .split('\n\n')
      .filter(frame => frame.startsWith('data: '))
      .map(frame => JSON.parse(frame.slice('data: '.length)));
  }
}

const VALID_INPUT = {
  creature: 'vampire',
  themes: ['forbidden_love'],
  spicyLevel: 3,
  wordCount: VALIDATION_RULES.wordCount.allowedValues[0],
  userInput: 'A vampire lord defies ancient vows.'
};

/** A stand-in whose streaming behaviour each case dictates. */
function fakeStoryService(
  stream: (onChunk: (chunk: StoryStreamChunk) => void) => Promise<void>
): () => StoryService {
  return () => ({
    generateStoryStreaming: (_input: unknown, onChunk: (chunk: StoryStreamChunk) => void) =>
      stream(onChunk)
  }) as unknown as StoryService;
}

function chunk(overrides: Partial<StoryStreamChunk> = {}): StoryStreamChunk {
  return {
    content: '<p>Blood on the doorframe.</p>',
    isComplete: false,
    wordsGenerated: 300,
    estimatedWordsRemaining: 300,
    generationSpeed: 30,
    ...overrides
  };
}

async function testClosesStreamWithoutCompletionChunk(): Promise<void> {
  const res = new FakeResponse();

  await handleStoryStreamRequest(
    { body: { ...VALID_INPUT } },
    res,
    fakeStoryService(async onChunk => {
      onChunk(chunk());
    })
  );

  assert(
    res.writableEnded,
    'a generation that emitted no completion chunk left the response open — the reader waits on a finished story'
  );
  const frames = res.frames();
  assert(frames[0]?.type === 'connected', 'the stream should open with a connected frame');
  assert(frames.some(frame => frame.type === 'chunk'), 'the progress chunk should have been framed');
}

async function testCompletionChunkStillEndsExactlyOnce(): Promise<void> {
  const res = new FakeResponse();

  // The FakeResponse throws on a second `end()`, so this passing is the
  // assertion: the post-generation close must not double-end a stream a
  // completion chunk already closed.
  await handleStoryStreamRequest(
    { body: { ...VALID_INPUT } },
    res,
    fakeStoryService(async onChunk => {
      onChunk(chunk({ isComplete: true, wordsGenerated: 600, estimatedWordsRemaining: 0 }));
    })
  );

  const frames = res.frames();
  const complete = frames.find(frame => frame.type === 'complete');
  assert(complete, 'a completion chunk should produce a complete frame');
  assert(complete.metadata.percentage === 100, 'a complete frame reports 100%');
  assert(res.writableEnded, 'the stream should be closed after completing');
}

async function testFailureAfterCompletionIsNotWrittenToAClosedStream(): Promise<void> {
  const res = new FakeResponse();

  // The story service does its own bookkeeping once the last chunk is out, so
  // a throw can arrive after the completion chunk already closed the response.
  await handleStoryStreamRequest(
    { body: { ...VALID_INPUT } },
    res,
    fakeStoryService(async onChunk => {
      onChunk(chunk({ isComplete: true, wordsGenerated: 600, estimatedWordsRemaining: 0 }));
      throw new Error('persisting the finished story failed');
    })
  );

  assert(
    !res.frames().some(frame => frame.type === 'error'),
    'an error frame was written to a stream the completion chunk had already closed'
  );
}

async function testFailureBeforeAnyFrameAnswersJson(): Promise<void> {
  const res = new FakeResponse();
  // Nothing has been written yet, so an SSE frame would reach the caller as a
  // default 200 carrying a body no client can read.
  res.write = ((chunkText: string) => {
    if (chunkText.includes('connected')) {
      throw new Error('provider refused the connection');
    }
    return FakeResponse.prototype.write.call(res, chunkText);
  }) as FakeResponse['write'];

  await handleStoryStreamRequest({ body: { ...VALID_INPUT } }, res, fakeStoryService(async () => {}));

  assert(res.statusCode === 500, `expected a JSON 500 before the stream opened, got ${res.statusCode}`);
  assert(
    (res.body as any)?.error?.code === 'STREAM_FAILED',
    'a pre-stream failure should answer STREAM_FAILED as JSON'
  );
}

async function testMidStreamFailureIsFramed(): Promise<void> {
  const res = new FakeResponse();

  await handleStoryStreamRequest(
    { body: { ...VALID_INPUT } },
    res,
    fakeStoryService(async onChunk => {
      onChunk(chunk());
      throw new Error('provider dropped the stream');
    })
  );

  const errorFrame = res.frames().find(frame => frame.type === 'error');
  assert(errorFrame, 'a failure after the stream opened should be framed as an SSE error');
  assert(
    errorFrame.error.message === 'provider dropped the stream',
    'the framed error should carry the failure message'
  );
  assert(res.writableEnded, 'the stream should be closed after framing the error');
}

async function testRejectsWordCountOutsideTheContract(): Promise<void> {
  for (const wordCount of ['lots', 0, 812, null, undefined]) {
    const res = new FakeResponse();

    await handleStoryStreamRequest(
      { body: { ...VALID_INPUT, wordCount } },
      res,
      fakeStoryService(async () => {
        throw new Error('the story service must not be reached for an invalid wordCount');
      })
    );

    assert(
      res.statusCode === 400,
      `wordCount ${JSON.stringify(wordCount)} should be answered 400, got ${res.statusCode}`
    );
    assert(
      (res.body as any)?.error?.code === 'INVALID_INPUT',
      `wordCount ${JSON.stringify(wordCount)} should be answered INVALID_INPUT`
    );
    assert(res.written === '', 'an invalid request should never open a stream');
  }
}

async function testRejectsMissingOrNonObjectBody(): Promise<void> {
  for (const body of [undefined, null, 'creature=vampire', [VALID_INPUT], 42]) {
    const res = new FakeResponse();

    await handleStoryStreamRequest({ body }, res, fakeStoryService(async () => {}));

    assert(
      res.statusCode === 400,
      `body ${JSON.stringify(body)} should be answered 400, not crash into a 500 — got ${res.statusCode}`
    );
  }
}

async function testPercentageIsFiniteForEveryAllowedWordCount(): Promise<void> {
  for (const wordCount of VALIDATION_RULES.wordCount.allowedValues) {
    const res = new FakeResponse();

    await handleStoryStreamRequest(
      { body: { ...VALID_INPUT, wordCount } },
      res,
      fakeStoryService(async onChunk => {
        onChunk(chunk({ wordsGenerated: wordCount * 2 }));
      })
    );

    const progress = res.frames().find(frame => frame.type === 'chunk');
    assert(progress, `no progress frame for wordCount ${wordCount}`);
    assert(
      Number.isFinite(progress.metadata.percentage),
      `wordCount ${wordCount} produced a non-finite percentage: ${progress.metadata.percentage}`
    );
    assert(
      progress.metadata.percentage === 100,
      `percentage should be clamped to 100, got ${progress.metadata.percentage}`
    );
  }
}

async function main(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ['closes the stream when the generation ends without a completion chunk', testClosesStreamWithoutCompletionChunk],
    ['ends exactly once when a completion chunk arrives', testCompletionChunkStillEndsExactlyOnce],
    ['does not write a failure to a stream that is already closed', testFailureAfterCompletionIsNotWrittenToAClosedStream],
    ['answers JSON when the failure precedes the first frame', testFailureBeforeAnyFrameAnswersJson],
    ['frames a failure that arrives mid-stream', testMidStreamFailureIsFramed],
    ['rejects a wordCount the contract does not allow', testRejectsWordCountOutsideTheContract],
    ['rejects a missing or non-object body with 400', testRejectsMissingOrNonObjectBody],
    ['reports a finite, clamped percentage for every allowed wordCount', testPercentageIsFiniteForEveryAllowedWordCount]
  ];

  for (const [name, run] of cases) {
    await run();
    console.log(`  ✓ ${name}`);
  }

  console.log(`\n✅ story-stream-route: ${cases.length} cases passed`);
}

main().catch(error => {
  console.error('\n❌ story-stream-route failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
