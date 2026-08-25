#!/usr/bin/env tsx
// Created: 2026-08-25 14:05 UTC

import {
  EVENT_SOURCE_CLOSED,
  EVENT_SOURCE_CONNECTING,
  EVENT_SOURCE_OPEN,
  readEventStreamErrorAction
} from '../shared/eventStreamRetry';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// The state that says a reconnect is already pending. The Story Lab job event
// route replays what a job has recorded and ends the response, so a running
// job's stream reaches this state after every replay — treating it as a
// failure ended the subscription and reported "updates stopped" for a job the
// server was still working on.
assert(
  readEventStreamErrorAction(EVENT_SOURCE_CONNECTING) === 'retry',
  'a stream the browser is reopening should be left to reconnect'
);

// Everything else is the end of the stream.
assert(
  readEventStreamErrorAction(EVENT_SOURCE_CLOSED) === 'fail',
  'a stream the browser has given up on should be reported as a failure'
);
assert(
  readEventStreamErrorAction(EVENT_SOURCE_OPEN) === 'fail',
  'an error on an open stream is not a pending reconnect'
);

// A `readyState` that is missing or unreadable fails rather than waiting: an
// interrupted stream costs the reader one retry, a subscription waiting on a
// reconnect that is never coming never settles at all.
for (const unknownState of [undefined, null, 'connecting', Number.NaN, -1, 3, {}]) {
  assert(
    readEventStreamErrorAction(unknownState) === 'fail',
    `an unreadable readyState (${String(unknownState)}) should be reported as a failure`
  );
}

// The constants have to be the values the DOM uses, since they are compared
// against a live `EventSource.readyState`.
assert(EVENT_SOURCE_CONNECTING === 0, 'CONNECTING is 0 in the EventSource interface');
assert(EVENT_SOURCE_OPEN === 1, 'OPEN is 1 in the EventSource interface');
assert(EVENT_SOURCE_CLOSED === 2, 'CLOSED is 2 in the EventSource interface');

console.log('Event stream retry tests passed');
