// Created: 2026-08-28 07:00 UTC

import { logCritical } from '../utils/logger';

/**
 * Log a failure that reached neither a route nor `apiErrorHandler` — one
 * thrown or rejected outside any single request, from a callback with no
 * `req`/`res` to give `logCritical` per-request context.
 *
 * A rate-limit cleanup timer (see `security.ts`) is exactly such a callback:
 * it runs for the whole life of the persistent Node/Docker server, unrelated
 * to any one request, and Node's default handling of either event —
 * `uncaughtException` or `unhandledRejection` — is to print to stderr and, for
 * the former, exit. Neither reaches this app's own redacted, correlation-id
 * aware logger, which is why `story-generator/src/server.ts` routes its
 * `process.on` listeners through this function instead.
 *
 * Kept out of `server.ts` itself, and out of `expressApiRoutes.ts`, so a test
 * can import it without pulling in the Angular SSR engine that module
 * constructs at load time.
 */
export function logUnhandledProcessFailure(
  kind: 'uncaughtException' | 'unhandledRejection',
  error: unknown
): void {
  logCritical(`Unhandled ${kind}`, error, { endpoint: 'process' });
}
