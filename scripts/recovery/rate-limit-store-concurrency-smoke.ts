#!/usr/bin/env tsx
// Created: 2026-09-01 EDT
//
// `tests/rate-limit-store.test.ts`'s cross-instance test proves the intended
// *algorithm* against a JavaScript stand-in for Postgres — it never sends
// `CONSUME_SQL` to a real database, so it cannot catch a defect in the SQL
// itself (a missing `ON CONFLICT`, a non-atomic increment, a race under real
// concurrent connections). Per `AGENTS.md`'s Test Quality Policy — "a mocked
// database test cannot prove ... real owner isolation" and "live-provider
// proof only when credentials are available" — this is that proof: two
// independently-constructed `PostgresRateLimitStore`s, standing in for two
// separate serverless instances, firing genuinely concurrent `consume()`
// calls at the same live database and the same `(user_id, endpoint)` bucket.
//
// Requires DATABASE_URL. Not part of `npm run test:all` — like
// `story-lab-cloud-db-smoke.ts`, this proves something only a real database
// connection can prove, and CI does not carry one.

import { randomUUID } from 'node:crypto';
import { createPostgresRateLimitStore } from '../../api/_lib/middleware/postgresRateLimitStore';
import { createNeonStoryLabQueryExecutor } from '../../api/_lib/story-lab/storage/neonStoryLabExecutor';
import { applyStoryLabCloudSchema } from '../../api/_lib/story-lab/storage/storyLabCloudSchemaMigration';
import { logError } from '../../api/_lib/utils/logger';

const MAX_REQUESTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const CONCURRENT_CALLS_PER_INSTANCE = 10;

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  if (!databaseUrl) {
    console.error('Rate limit store concurrency smoke was not run: DATABASE_URL is not configured.');
    process.exit(1);
    return;
  }

  const executor = createNeonStoryLabQueryExecutor(databaseUrl);
  await applyStoryLabCloudSchema(executor);

  // Two independent store instances sharing nothing but the database
  // connection — the exact shape of two Vercel serverless invocations that
  // would previously have each held their own, independent in-memory `Map`.
  const instanceA = createPostgresRateLimitStore({ databaseUrl, executor });
  const instanceB = createPostgresRateLimitStore({ databaseUrl, executor });

  const userId = `smoke_${randomUUID()}`;
  const endpoint = 'rate-limit-store-concurrency-smoke';

  try {
    const calls = [
      ...Array.from({ length: CONCURRENT_CALLS_PER_INSTANCE }, () =>
        instanceA.consume({ userId, endpoint, maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS })
      ),
      ...Array.from({ length: CONCURRENT_CALLS_PER_INSTANCE }, () =>
        instanceB.consume({ userId, endpoint, maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS })
      )
    ];

    // Fired together, not awaited one at a time: this is the concurrency the
    // in-process JavaScript simulation in the unit test cannot produce.
    const results = await Promise.all(calls);
    const allowedCount = results.filter(result => result.allowed).length;

    if (allowedCount !== MAX_REQUESTS) {
      console.error(
        `Rate limit store concurrency smoke failed: expected exactly ${MAX_REQUESTS} of ${calls.length} ` +
          `concurrent requests across two store instances to be allowed, got ${allowedCount}. ` +
          'This means the shared budget is not enforced atomically against the real database.'
      );
      process.exit(1);
      return;
    }

    console.log(
      `Rate limit store concurrency smoke passed: ${allowedCount} of ${calls.length} concurrent requests ` +
        `across two independent store instances were allowed, matching the shared budget of ${MAX_REQUESTS}.`
    );
  } finally {
    await executor.query('delete from rate_limit_buckets where user_id = $1 and endpoint = $2', [userId, endpoint]);
  }
}

main().catch(error => {
  // Schema application, the cleanup delete, and executor construction can all
  // fail with a raw Neon/Postgres driver error, which can embed
  // `DATABASE_URL` itself (credentials included). Routed through `logError`
  // — the same redacting path `PostgresRateLimitStore` uses — rather than a
  // bare `console.error(error)`, since this script's output is exactly the
  // kind of thing that gets captured as CI log output or pasted as
  // deployment evidence.
  logError('Rate limit store concurrency smoke failed with an unexpected error.', error);
  process.exit(1);
});
