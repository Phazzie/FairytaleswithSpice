#!/usr/bin/env tsx
// Created: 2026-09-04 21:15 UTC

import { readSseFrameData, splitSseFrames } from '../shared/sseFrameReader';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// One complete frame, terminator included, nothing left over.
{
  const { frames, remainder } = splitSseFrames('data: {"a":1}\n\n');
  assert(frames.length === 1 && frames[0] === 'data: {"a":1}', 'one complete frame should split out on its own');
  assert(remainder === '', 'nothing should remain after a single complete frame');
}

// Two frames back to back in one chunk.
{
  const { frames, remainder } = splitSseFrames('data: {"a":1}\n\ndata: {"a":2}\n\n');
  assert(frames.length === 2, 'two complete frames should both split out');
  assert(frames[0] === 'data: {"a":1}' && frames[1] === 'data: {"a":2}', 'frames should split out in order');
  assert(remainder === '', 'nothing should remain after two complete frames');
}

// A frame split across two chunks — the read loop's actual shape: accumulate
// the remainder, then split again once more text arrives.
{
  const first = splitSseFrames('data: {"a":1');
  assert(first.frames.length === 0, 'a frame with no terminator yet should not split out');
  assert(first.remainder === 'data: {"a":1', 'the partial frame should be carried as the remainder');

  const second = splitSseFrames(`${first.remainder}}\n\n`);
  assert(second.frames.length === 1 && second.frames[0] === 'data: {"a":1}', 'accumulating the remainder should complete the split frame');
  assert(second.remainder === '', 'nothing should remain once the split frame completes');
}

// A frame boundary is a blank line, not the string's end — a chunk ending
// mid-frame is a remainder, not a frame with the terminator implied.
{
  const { frames, remainder } = splitSseFrames('data: {"a":1}');
  assert(frames.length === 0, 'text with no blank-line terminator should not be read as a frame');
  assert(remainder === 'data: {"a":1}', 'unterminated text should be carried whole as the remainder');
}

// `readSseFrameData` strips exactly the `data: ` prefix `formatSseFrame` writes.
assert(readSseFrameData('data: {"eventId":"e1"}') === '{"eventId":"e1"}', 'readSseFrameData should strip the data: prefix');

// A frame with no `data:` line at all — not something the writer produces,
// but the reader must not throw on one.
assert(readSseFrameData('id: 1') === null, 'a frame with no data: line should read as null, not throw');

console.log('sse-frame-reader.test.ts passed.');
