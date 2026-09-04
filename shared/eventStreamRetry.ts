// Created: 2026-09-04 20:47 UTC

/**
 * Classifies an `EventSource` `error` event by the stream's `readyState`.
 *
 * Pairs with the Story Lab job event stream
 * (`handleStreamStoryLabJobEvents`), which replays every recorded event for
 * a job and closes the response immediately — a deliberate "replay and
 * close" design, not a bug (see that route's own comment). A reader's
 * `EventSource` therefore sees its connection drop every few seconds by
 * design, and the browser's own auto-reconnect is what makes that a livable
 * design at all: after a server-initiated close, `readyState` moves to
 * `CONNECTING` while the browser retries on its own, and only lands on
 * `CLOSED` once it gives up permanently (or `.close()` was called
 * deliberately). Reading every `error` event as a job failure — the
 * `readyState`-blind approach this repository's CHANGELOG had already
 * documented a fix for, twice, without the fix ever landing — would fail the
 * job on the very first reconnect.
 */
export type EventStreamErrorClassification = 'reconnecting' | 'terminal';

/** The subset of `EventSource` this helper actually reads. */
export interface EventStreamLike {
  readonly readyState: number;
}

/**
 * `EventSource.CONNECTING`, spelled out rather than read off the global: this
 * module is imported from a Node test as well as the browser, and the
 * `readyState` numbering is part of the DOM spec, not a runtime-specific
 * value that could drift between them.
 */
const EVENT_SOURCE_CONNECTING = 0;

export function classifyEventStreamError(source: EventStreamLike): EventStreamErrorClassification {
  return source.readyState === EVENT_SOURCE_CONNECTING ? 'reconnecting' : 'terminal';
}
