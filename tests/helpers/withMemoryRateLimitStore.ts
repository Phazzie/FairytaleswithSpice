// Created: 2026-09-01 EDT
//
// Any test that drives a paid route handler goes through
// `enforceApiAccessControl`'s default store resolution, which reads
// `RATE_LIMIT_STORE`/`DATABASE_URL` straight from `process.env` when no store
// is injected. Without pinning it, a runner with `RATE_LIMIT_STORE=postgres`
// set ambiently would make every such route call resolve a Postgres store
// instead: with no `DATABASE_URL` that store answers 503 and "should not be
// rejected" assertions fail; with one configured, the test performs real
// upserts against it, leaving buckets that can make a later run fail before
// its expected limit. `resetRateLimitsForTests()` only ever clears the
// in-memory map, so it can't protect against either case on its own — the
// mode itself has to be pinned. Shared by every route-driven test file
// rather than copied into each one.

export async function withMemoryRateLimitStore(fn: () => Promise<void>): Promise<void> {
  const previous = process.env['RATE_LIMIT_STORE'];
  process.env['RATE_LIMIT_STORE'] = 'memory';
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env['RATE_LIMIT_STORE'];
    } else {
      process.env['RATE_LIMIT_STORE'] = previous;
    }
  }
}
