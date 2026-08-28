// Created: 2026-08-28 07:00 UTC
//
// `story-generator/src/server.ts` had no `process.on('uncaughtException' |
// 'unhandledRejection')` at all. `runApiRoute` only guards the one promise it
// wraps per request; a throw from anywhere else in that long-running process
// (a timer callback, say) fell through to Node's bare default handler —
// printed to stderr, process exits on an uncaught exception — with none of
// this app's redacted, correlation-id-bearing logging involved. This proves
// `logUnhandledProcessFailure`, the function both `process.on` listeners in
// `server.ts` call, actually reaches the structured logger at `critical`
// severity, rather than asserting on a real process crash.
//
// Imported from its own module rather than from `server.ts` itself: importing
// `server.ts` directly constructs the Angular SSR engine at module load time,
// which needs the Angular JIT compiler and is not something a plain Node test
// can load standalone.

import assert from 'node:assert/strict';
import { logUnhandledProcessFailure } from '../api/_lib/http/unhandledProcessFailureLogger';
import { logger } from '../api/_lib/utils/logger';

logger.clearLogs();
logUnhandledProcessFailure('uncaughtException', new Error('disk full'));
logUnhandledProcessFailure('unhandledRejection', 'a rejected promise with no Error');

const entries = logger.getRecentLogs(50, 'critical');

const uncaught = entries.find(entry => entry.message === 'Unhandled uncaughtException');
assert.ok(uncaught, 'an uncaughtException should be logged at critical severity');
assert.equal(uncaught?.error?.message, 'disk full');
assert.equal(uncaught?.context?.endpoint, 'process', 'the log should be identifiable as process-level, not a route');

const rejected = entries.find(entry => entry.message === 'Unhandled unhandledRejection');
assert.ok(rejected, 'an unhandledRejection should be logged at critical severity even when it carries no Error');

console.log('Express server process-guard tests passed');
