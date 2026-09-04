#!/usr/bin/env tsx
// Created: 2026-09-04 20:47 UTC

import { classifyEventStreamError } from '../shared/eventStreamRetry';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// The Story Lab job event stream replays and closes on every read (see
// `handleStreamStoryLabJobEvents`), so a real `EventSource` moves to
// `readyState` 0 (`CONNECTING`) while it reconnects on its own. That is the
// common case, not a failure, and must not be classified as one.
assert(
  classifyEventStreamError({ readyState: 0 }) === 'reconnecting',
  'readyState CONNECTING should classify as a reconnect, not a failure'
);

// `readyState` 2 (`CLOSED`) means the browser gave up retrying — or the
// stream was closed deliberately — either way there is nothing left
// listening for a future event on it.
assert(
  classifyEventStreamError({ readyState: 2 }) === 'terminal',
  'readyState CLOSED should classify as terminal'
);

// `readyState` 1 (`OPEN`) is not a state a spec-compliant `EventSource`
// reports an `error` event from, but a caller reading this off an unknown or
// mocked source should still fail closed (treat it as terminal) rather than
// silently swallow a disconnect this helper does not recognize.
assert(
  classifyEventStreamError({ readyState: 1 }) === 'terminal',
  'an unrecognized readyState should fail closed as terminal, not be swallowed'
);

console.log('event-stream-retry.test.ts passed.');
