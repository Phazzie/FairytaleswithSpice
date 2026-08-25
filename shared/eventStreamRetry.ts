// Created: 2026-08-25 14:05 UTC

/**
 * What an `EventSource` `error` event means for the stream it arrived on.
 *
 * An `EventSource` fires `error` for two different things, and the event itself
 * says nothing about which: the connection *dropped* and the browser is about
 * to reopen it, or the connection *failed* and the browser has given up. Only
 * `readyState` tells them apart — `CONNECTING` while a retry is pending,
 * `CLOSED` once there will not be one.
 *
 * The Story Lab job event route replays the events a job has recorded so far
 * and then ends the response, which is a normal end of connection every single
 * time. The browser therefore fires `error` after every replay of a job that
 * has not finished yet, and reading that as a failure ended the subscription
 * and reported "Story generation updates stopped" for a job that was running
 * perfectly well on the server — the reconnect that would have delivered the
 * next batch of events had already been cancelled by the `close()` that went
 * with it.
 *
 * Not every stream wants the retry, which is why this answers the question
 * rather than handling it: reconnecting to the Story Lab *genesis* stream
 * restarts a paid generation from the beginning, so that route's reader
 * deliberately closes on the first error instead.
 */
export const EVENT_SOURCE_CONNECTING = 0;
export const EVENT_SOURCE_OPEN = 1;
export const EVENT_SOURCE_CLOSED = 2;

export type EventStreamErrorAction = 'retry' | 'fail';

/**
 * `retry` only for the state that actually promises another attempt.
 *
 * Anything else — `CLOSED`, `OPEN`, or a `readyState` that is missing entirely
 * because the stream is a test double or a non-browser shim — answers `fail`.
 * That is the conservative direction: reporting a failure that was really a
 * reconnect costs the reader one interrupted stream, while waiting for a
 * reconnect that is never coming hangs the caller forever.
 */
export function readEventStreamErrorAction(readyState: unknown): EventStreamErrorAction {
  return readyState === EVENT_SOURCE_CONNECTING ? 'retry' : 'fail';
}
