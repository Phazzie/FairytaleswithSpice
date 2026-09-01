// Created: 2026-09-01 EDT
//
// Wraps the process-wide in-memory rate limiter (`checkRateLimit` in
// `./security.ts`) behind the `RateLimitStore` port, so `apiAccessControl.ts`
// can be handed `PostgresRateLimitStore` instead without changing its own
// call site. `checkRateLimit`'s own `Map` and logic are untouched — this is
// a seam around it, not a rewrite of it, so today's behavior (and every
// existing test that exercises `checkRateLimit` directly) stays exactly as
// it was.

import { checkRateLimit, resetRateLimitsForTests } from './security';
import type { RateLimitConsumeInput, RateLimitConsumeResult, RateLimitStore } from './rateLimitStorePort';

export class InMemoryRateLimitStore implements RateLimitStore {
  readonly mode = 'memory' as const;
  readonly durable = false;

  isConfigured(): boolean {
    return true;
  }

  consume(input: RateLimitConsumeInput): RateLimitConsumeResult {
    return checkRateLimit(input.userId, input.endpoint, input.maxRequests, input.windowMs);
  }

  /** Test-only: see `resetRateLimitsForTests` in `./security.ts`. */
  resetForTests(): void {
    resetRateLimitsForTests();
  }
}
