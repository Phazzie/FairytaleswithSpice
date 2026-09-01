// Created: 2026-09-01 EDT

export type RateLimitStorageMode = 'memory' | 'postgres';

export interface RateLimitConsumeInput {
  userId: string;
  endpoint: string;
  maxRequests: number;
  windowMs: number;
  /** Epoch milliseconds. Defaults to `Date.now()` — overridable so tests can drive window expiry deterministically. */
  now?: number;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  remaining: number;
  /** Epoch milliseconds at which the current window ends. */
  resetTime: number;
}

/**
 * A shared seam between `InMemoryRateLimitStore` (today's process-local `Map`,
 * unchanged) and `PostgresRateLimitStore` (a shared counter, for deployments
 * that run more than one instance of this process at once). Mirrors
 * `StoryLabJobStore` in `../story-lab/jobs/jobStorePort.ts` — same shape of
 * problem: a durable/shared backend behind the same port as a process-local
 * default, selected by `rateLimitStoreConfig.ts`.
 */
export interface RateLimitStore {
  readonly mode: RateLimitStorageMode;
  readonly durable: boolean;
  isConfigured(): boolean;
  consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> | RateLimitConsumeResult;
}
