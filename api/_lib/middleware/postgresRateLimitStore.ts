// Created: 2026-09-01 EDT
//
// `checkRateLimit` (`./security.ts`) is a module-level `Map`, and its own
// comment says why that's wrong here: "For multi-instance deployments (e.g.,
// horizontal scaling, serverless, load-balanced setups), replace with a
// distributed cache like Redis." This app ships as Vercel serverless
// functions (`vercel.json`) — exactly that target — and `enforceApiAccessControl`
// (`./apiAccessControl.ts`) wires that `Map` into every paid xAI/Grok route.
// Each cold-started or concurrently-warm instance gets its own empty map, so
// a caller's effective budget scales with however many instances happen to
// be running, not with the configured limit.
//
// This is the replacement, built on the Postgres connection every other
// durable Story Lab store already shares
// (`../story-lab/jobs/postgresStoryLabJobStore.ts`,
// `../story-lab/profile/postgresStoryLabProfileStore.ts`,
// `../story-lab/storage/postgresStoryProjectStore.ts`) via
// `createNeonStoryLabQueryExecutor`, rather than introducing a new dependency
// (Redis) this app has never provisioned.

import type { StoryLabCloudQueryExecutor } from '../story-lab/storage/storyLabCloudStorageConfig';
import type { RateLimitConsumeInput, RateLimitConsumeResult, RateLimitStore } from './rateLimitStorePort';
import { logError } from '../utils/logger';

export interface PostgresRateLimitStoreOptions {
  databaseUrl?: string;
  executor?: StoryLabCloudQueryExecutor;
  now?: () => number;
}

interface RateLimitBucketRow {
  window_start: string | Date;
  count: number | string;
}

export type RateLimitStoreErrorCode = 'RATE_LIMIT_STORE_UNCONFIGURED' | 'RATE_LIMIT_STORE_FAILED';

export class RateLimitStoreError extends Error {
  constructor(
    readonly code: RateLimitStoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RateLimitStoreError';
  }
}

export function isRateLimitStoreError(error: unknown): error is RateLimitStoreError {
  return error instanceof RateLimitStoreError;
}

/**
 * One statement, one round trip. `INSERT ... ON CONFLICT ... DO UPDATE` is
 * atomic in Postgres: it takes a row-level lock on the conflicting key for
 * the statement's duration (and `ON CONFLICT` itself is what makes two
 * concurrent first-time inserts for the same key resolve safely — one wins
 * the insert, the other lands on `DO UPDATE`), so two concurrent serverless
 * invocations consuming the same `(user_id, endpoint)` bucket are serialized
 * by the database rather than by anything this process holds in memory.
 *
 * The window resets when the stored `window_start` is at or before the
 * caller's cutoff (`now - windowMs`); otherwise `count` increments. Unlike
 * `checkRateLimit`, this does not stop incrementing once `count` reaches
 * `maxRequests` — doing so would require this single statement to know the
 * difference between "already at the limit" and "just reached it," which a
 * plain `RETURNING` (post-update values only) cannot express without a second
 * round trip. Counting attempts past the limit within a window is harmless —
 * `consume()` below still derives the same `allowed`/`remaining`/`resetTime`
 * a caller sees from `checkRateLimit`, it just costs one extra counter
 * increment on a caller already being rejected.
 */
const CONSUME_SQL = `
insert into rate_limit_buckets (user_id, endpoint, window_start, count, updated_at)
values ($1, $2, $3::timestamptz, 1, $3::timestamptz)
on conflict (user_id, endpoint) do update set
  window_start = case
    when rate_limit_buckets.window_start <= $4::timestamptz then $3::timestamptz
    else rate_limit_buckets.window_start
  end,
  count = case
    when rate_limit_buckets.window_start <= $4::timestamptz then 1
    else rate_limit_buckets.count + 1
  end,
  updated_at = $3::timestamptz
returning window_start, count
`;

export function createPostgresRateLimitStore(options: PostgresRateLimitStoreOptions = {}): RateLimitStore {
  return new PostgresRateLimitStore(options);
}

class PostgresRateLimitStore implements RateLimitStore {
  readonly mode = 'postgres' as const;
  readonly durable = true;

  constructor(private readonly options: PostgresRateLimitStoreOptions) {}

  isConfigured(): boolean {
    return Boolean(this.getDatabaseUrl() && this.options.executor);
  }

  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    this.assertReady();

    const nowMs = input.now ?? this.getNow();
    const nowIso = new Date(nowMs).toISOString();
    const cutoffIso = new Date(nowMs - input.windowMs).toISOString();

    let row: RateLimitBucketRow | undefined;
    try {
      const result = await this.executor().query<RateLimitBucketRow>(CONSUME_SQL, [
        input.userId,
        input.endpoint,
        nowIso,
        cutoffIso
      ]);
      row = result.rows[0];
    } catch (error) {
      // The driver/connection error is logged through the redacting logger
      // rather than folded into the thrown message: a Postgres connection
      // error can embed the connection string itself (host, credentials),
      // and `RateLimitStoreError.message` is not guaranteed to stay off a
      // response the way this module's own callers keep it today — the next
      // caller of `consume()` should not have to know that to stay safe.
      logError('Rate limit upsert failed', error, { endpoint: input.endpoint });
      throw new RateLimitStoreError('RATE_LIMIT_STORE_FAILED', 'Rate limit upsert failed.');
    }

    if (!row) {
      throw new RateLimitStoreError('RATE_LIMIT_STORE_FAILED', 'Rate limit upsert returned no row.');
    }

    const windowStartMs = new Date(row.window_start).getTime();
    const count = Number(row.count);
    const resetTime = windowStartMs + input.windowMs;

    return {
      allowed: count <= input.maxRequests,
      remaining: Math.max(0, input.maxRequests - count),
      resetTime
    };
  }

  private assertReady(): void {
    if (!this.isConfigured()) {
      throw new RateLimitStoreError(
        'RATE_LIMIT_STORE_UNCONFIGURED',
        'Postgres rate limit store is not configured. Set DATABASE_URL and provide a query executor.'
      );
    }
  }

  private executor(): StoryLabCloudQueryExecutor {
    // `assertReady()` already guarantees this in every real call path;
    // narrowed again here so the compiler doesn't need `!`.
    if (!this.options.executor) {
      throw new RateLimitStoreError('RATE_LIMIT_STORE_UNCONFIGURED', 'No query executor configured.');
    }
    return this.options.executor;
  }

  private getDatabaseUrl(): string {
    return (this.options.databaseUrl ?? '').trim();
  }

  private getNow(): number {
    return this.options.now?.() ?? Date.now();
  }
}
