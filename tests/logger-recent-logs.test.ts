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

function main(): void {
  testLevelFilterSearchesTheWholeBuffer();
  testCountKeepsTheNewestMatches();
  testUnfilteredReadIsBoundedAndDetached();

  logger.clearLogs();
  console.log('Logger recent-log tests passed');
}

main();
