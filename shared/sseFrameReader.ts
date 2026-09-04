// Created: 2026-09-04 21:15 UTC

/**
 * The reading side of `formatSseFrame` (`api/_lib/http/sseStream.ts`).
 *
 * That module writes one shape only — a single `data: <json>\n\n` line per
 * frame, no `id:`/`event:`/`retry:` fields — because the one live route that
 * frames SSE (the Story Lab job event stream) has no need of them: it
 * replays a fixed list and closes, rather than holding a connection open
 * across a mix of event types. A reader that assumed the full SSE field
 * grammar would be solving a problem this repository's writer does not have;
 * this one reads exactly the shape the writer produces.
 */

const FRAME_TERMINATOR = '\n\n';
const DATA_LINE_PREFIX = 'data: ';

export interface SseFrameSplit {
  /** Complete frames found in `buffer`, in the order they appeared. */
  frames: string[];
  /** Whatever came after the last complete frame — carried into the next chunk. */
  remainder: string;
}

/**
 * Splits a chunk of accumulated stream text into complete frames and a
 * trailing partial one.
 *
 * A frame is dispatched by its terminating blank line, and a `TextDecoder`
 * reading a network stream has no reason to hand back text aligned to that
 * boundary — one frame can arrive split across two `read()` calls just as
 * easily as two frames can arrive in one. A caller accumulates `remainder`
 * onto the next chunk before splitting again, the same way `formatSseFrame`'s
 * own doc comment describes the write side needing the real terminator to
 * get this right at all.
 */
export function splitSseFrames(buffer: string): SseFrameSplit {
  const frames: string[] = [];
  let remainder = buffer;
  let boundary = remainder.indexOf(FRAME_TERMINATOR);

  while (boundary !== -1) {
    frames.push(remainder.slice(0, boundary));
    remainder = remainder.slice(boundary + FRAME_TERMINATOR.length);
    boundary = remainder.indexOf(FRAME_TERMINATOR);
  }

  return { frames, remainder };
}

/**
 * Reads one frame's payload text.
 *
 * Returns `null` for a frame with no `data: ` line — not something
 * `formatSseFrame` produces, but a reader has to decide what an
 * unrecognized frame means rather than throw on one, the same posture
 * `isVocabularyMember`-style readers in this codebase take toward wire data
 * a future writer version might shape differently.
 */
export function readSseFrameData(frame: string): string | null {
  const dataLine = frame.split('\n').find(line => line.startsWith(DATA_LINE_PREFIX));
  return dataLine ? dataLine.slice(DATA_LINE_PREFIX.length) : null;
}
