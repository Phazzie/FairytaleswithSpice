#!/usr/bin/env tsx
// Created: 2026-08-24 20:15 UTC

import { logger, LogEntry } from '../api/_lib/utils/logger';

type RecordedLevel = 'info' | 'warn' | 'error';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// The logger writes every entry it buffers to the console as well. Nothing here
// asserts on that output, so it is swallowed to keep the test run readable.
function withSilencedConsole<T>(run: () => T): T {
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  try {
    return run();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

const record: Record<RecordedLevel, (message: string) => void> = {
  info: message => logger.info(message),
  warn: message => logger.warn(message),
  error: message => logger.error(message)
};

function recordLogs(entries: Array<{ level: RecordedLevel; message: string }>): void {
  logger.clearLogs();
  withSilencedConsole(() => {
    for (const entry of entries) {
      record[entry.level](entry.message);
    }
  });
}

function messagesOf(entries: LogEntry[]): string[] {
  return entries.map(entry => entry.message);
}

// `getRecentLogs(count, level)` used to take the last `count` entries of any
// level and only then keep the matching ones. The two failures below are buried
// under the chatter that follows them, so the filtered call returned nothing —
// exactly the case the level filter exists for.
function testLevelFilterSearchesTheWholeBuffer(): void {
  recordLogs([
    { level: 'error', message: 'first failure' },
    { level: 'error', message: 'second failure' },
    ...Array.from({ length: 60 }, (_, index) => ({ level: 'info' as const, message: `step ${index}` }))
  ]);

  const errors = logger.getRecentLogs(50, 'error');

  assert(
    messagesOf(errors).join('|') === 'first failure|second failure',
    `both buffered errors should be returned, oldest first (got ${JSON.stringify(messagesOf(errors))})`
  );
}

// The count still bounds the result, and still counts from the newest end.
function testCountKeepsTheNewestMatches(): void {
  recordLogs(
    Array.from({ length: 5 }, (_, index) => ({ level: 'warn' as const, message: `warning ${index}` }))
  );

  const warnings = logger.getRecentLogs(3, 'warn');

  assert(
    messagesOf(warnings).join('|') === 'warning 2|warning 3|warning 4',
    `the newest three warnings should be returned (got ${JSON.stringify(messagesOf(warnings))})`
  );
}

// An unfiltered read is still bounded by the count, and hands back a copy: a
// caller that mutates the returned array must not disturb the buffer.
function testUnfilteredReadIsBoundedAndDetached(): void {
  recordLogs(Array.from({ length: 10 }, (_, index) => ({ level: 'info' as const, message: `entry ${index}` })));

  const recent = logger.getRecentLogs(4);
  assert(
    messagesOf(recent).join('|') === 'entry 6|entry 7|entry 8|entry 9',
    `the newest four entries should be returned (got ${JSON.stringify(messagesOf(recent))})`
  );

  recent.length = 0;
  assert(logger.getRecentLogs(4).length === 4, 'mutating the returned array should not empty the buffer');
}

// `slice(-count)` means "the last `count`" only for a positive count. `-0` is
// `0`, so asking for none used to hand back the whole buffer — the case a
// caller reaches by paging with a remainder that ran out — and a negative count
// dropped the newest entries instead of returning none.
function testNonPositiveCountsReturnNothing(): void {
  recordLogs(Array.from({ length: 10 }, (_, index) => ({ level: 'info' as const, message: `entry ${index}` })));

  for (const count of [0, -3, Number.NaN]) {
    const entries = logger.getRecentLogs(count);
    assert(
      entries.length === 0,
      `getRecentLogs(${count}) should return nothing (got ${entries.length} entries)`
    );
  }

  assert(
    logger.getRecentLogs(0, 'info').length === 0,
    'a zero count should return nothing for a filtered read too'
  );
  assert(
    logger.getRecentLogs(2).length === 2,
    'a positive count should be unaffected by the clamp'
  );
}

// A fractional count is not a number of entries; it is rounded down rather than
// handed to `slice`, which would truncate it in the same direction but says so
// nowhere.
function testFractionalCountsRoundDown(): void {
  recordLogs(Array.from({ length: 10 }, (_, index) => ({ level: 'info' as const, message: `entry ${index}` })));

  const entries = logger.getRecentLogs(2.7);
  assert(
    messagesOf(entries).join('|') === 'entry 8|entry 9',
    `a fractional count should round down to whole entries (got ${JSON.stringify(messagesOf(entries))})`
  );
}

// `extractErrorDetails` used to do `error?.name || 'Error'` — a `Symbol` is
// truthy, so it passed through unconverted rather than falling back, even
// though `LogEntry['error'].name` is typed as `string`. Found via a crash in
// `criticalAlertSink.ts`'s webhook sink, which trusted that type: its own
// name sanitizer's `RegExp.test` throws on a `Symbol` argument, so a single
// malformed error name could crash critical-alert delivery entirely.
function testNonStringErrorNameFallsBackToAGenericLabel(): void {
  logger.clearLogs();
  withSilencedConsole(() => {
    logger.error('boom', { name: Symbol('private'), message: 'boom' });
  });

  const entry = logger.getRecentLogs(1, 'error')[0];
  assert(entry?.error?.name === 'Error', `a non-string error name should fall back to "Error" (got ${String(entry?.error?.name)})`);
}

function main(): void {
  testLevelFilterSearchesTheWholeBuffer();
  testCountKeepsTheNewestMatches();
  testUnfilteredReadIsBoundedAndDetached();
  testNonPositiveCountsReturnNothing();
  testFractionalCountsRoundDown();
  testNonStringErrorNameFallsBackToAGenericLabel();

  logger.clearLogs();
  console.log('Logger recent-log tests passed');
}

main();
