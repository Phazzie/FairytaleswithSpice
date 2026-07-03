// Created: 2026-07-03 14:41 UTC

import { getXaiFastTimeoutMs } from '../config/xaiConfig';

const DEFAULT_STORY_LAB_FUNCTION_BUDGET_MS = 60000;
const STORY_LAB_CONTINUITY_FINALIZATION_RESERVE_MS = 5000;
export const STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS = 1000;

export function getStoryLabContinuityTimeoutMs(requestStartedAtMs: number, nowMs = Date.now()): number {
  const elapsedMs = Math.max(0, nowMs - requestStartedAtMs);
  const remainingMs = getStoryLabFunctionBudgetMs() - elapsedMs - STORY_LAB_CONTINUITY_FINALIZATION_RESERVE_MS;

  if (remainingMs < STORY_LAB_MIN_AI_CONTINUITY_TIMEOUT_MS) {
    return 0;
  }

  return Math.min(getXaiFastTimeoutMs(), remainingMs);
}

function getStoryLabFunctionBudgetMs(): number {
  return getPositiveIntegerEnv(
    ['STORY_LAB_FUNCTION_BUDGET_MS', 'FUNCTION_BUDGET_MS'],
    DEFAULT_STORY_LAB_FUNCTION_BUDGET_MS
  );
}

function getPositiveIntegerEnv(names: string[], fallback: number): number {
  for (const name of names) {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
      continue;
    }

    const parsed = Number(rawValue);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}
