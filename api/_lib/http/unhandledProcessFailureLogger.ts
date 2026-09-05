// Created: 2026-08-28 07:00 UTC

import { logCriticalAndFlush } from '../utils/logger';

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
 *
 * Returns a promise the caller can await: `uncaughtException` calls
 * `process.exit(1)` immediately afterward, and a fire-and-forget alert there
 * has no guarantee of even starting before the process ends — Codex's review
 * of the initial push on #339 caught exactly that gap. `logCriticalAndFlush`
 * still never rejects, so awaiting this can never itself throw.
 */
export async function logUnhandledProcessFailure(
  kind: 'uncaughtException' | 'unhandledRejection',
  error: unknown
): Promise<void> {
  await logCriticalAndFlush(`Unhandled ${kind}`, error, { endpoint: 'process' });
}
