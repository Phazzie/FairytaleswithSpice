// Created: 2026-06-21 20:56 UTC

import type { ApiResponse } from './contracts';

const CLIENT_ERROR_CODES = new Set([
  'CONTENT_POLICY_VIOLATION',
  'INVALID_BLUEPRINT',
  'INVALID_REQUEST'
]);

const SERVICE_UNAVAILABLE_CODES = new Set([
  'AI_UNAVAILABLE'
]);

export function getStoryLabResponseStatus(payload: ApiResponse<unknown>): number {
  if (payload.success) {
    return 200;
  }

  if (CLIENT_ERROR_CODES.has(payload.error.code)) {
    return 400;
  }

  if (SERVICE_UNAVAILABLE_CODES.has(payload.error.code)) {
    return 503;
  }

  return 500;
}
