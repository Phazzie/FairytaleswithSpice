// Created: 2026-07-03 14:41 UTC

import { getRemainingRequestBudgetMs, getXaiFastTimeoutMs } from '../config/xaiConfig';

export const STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS = 1000;

/**
 * The window continuity extraction may spend, out of what the invocation has
 * left. The budget itself, and the reserve kept back for finalizing the
 * response, moved to `config/xaiConfig` when `XaiTextClient`'s own retry had to
 * measure itself against the same window; the rule about what is a *usable*
 * continuity window is still this module's.
 */
export function getStoryLabContinuityTimeoutMs(requestStartedAtMs: number, nowMs = Date.now()): number {
  const remainingMs = getRemainingRequestBudgetMs(requestStartedAtMs, nowMs);

  if (remainingMs < STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS) {
    return 0;
  }

  return Math.min(getXaiFastTimeoutMs(), remainingMs);
}
