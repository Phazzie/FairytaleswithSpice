// Created: 2026-08-25 08:10 UTC

/**
 * The part of a Node response a Server-Sent Events route actually uses.
 *
 * Structural rather than an `express.Response` or a `ServerResponse`, because
 * the two routes that stream in this repository run on different stacks — one
 * on Express in the Node/Docker deployment, one on the serverless handler
 * signature — and a test drives either with a plain object. The lifecycle flags
 * are optional for the same reason: a hand-built double that does not model
 * them reads as a stream that is still open, which is what it is.
 */
export interface SseResponseLike {
  write(chunk: string): unknown;
  end(): unknown;
  readonly headersSent?: boolean;
  readonly writableEnded?: boolean;
  readonly destroyed?: boolean;
}

/**
 * Serialize one Server-Sent Events frame.
 *
 * A frame is dispatched by the blank line that ends it, so the terminator has
 * to be two real newlines. Written inside a template literal, `\\n\\n` is a
 * backslash followed by `n` — printable text, not a line ending — so every
 * update such a route produced ran together into one event that no client ever
 * dispatched: an `EventSource` held the whole generation open and fired
 * `message` exactly never.
 *
 * `JSON.stringify` escapes newlines inside strings, so the payload cannot end
 * the frame early no matter what the story content contains.
 */
export function formatSseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Whether the stream can still carry a frame.
 *
 * A generation outlives its response in both directions: the reader closes the
 * tab, or the route already sent its terminating frame and something threw on
 * the way out. Node answers a `write` after either with
 * `ERR_STREAM_WRITE_AFTER_END` / `ERR_STREAM_DESTROYED`, which on Express is an
 * exception thrown out of whatever callback the story service happened to be
 * running — so a failure the route was in the middle of reporting is replaced
 * by a second, unrelated one, and the log records the wrong thing.
 */
export function isSseStreamOpen(res: SseResponseLike): boolean {
  return res.writableEnded !== true && res.destroyed !== true;
}

/**
 * Write one frame, or skip it if the stream is already gone. Answers whether
 * the frame went out, for a caller that has to decide what to do instead.
 */
export function writeSseFrame(res: SseResponseLike, payload: unknown): boolean {
  if (!isSseStreamOpen(res)) {
    return false;
  }

  res.write(formatSseFrame(payload));
  return true;
}

/**
 * End the stream exactly once.
 *
 * The route cannot generally know whether its last frame was the terminating
 * one — the story service decides that by setting `isComplete` on a chunk — so
 * both the callback and the code after the generation resolves have to be able
 * to close the response, and only the first of them may actually do it.
 */
export function endSseStream(res: SseResponseLike): boolean {
  if (!isSseStreamOpen(res)) {
    return false;
  }

  res.end();
  return true;
}
