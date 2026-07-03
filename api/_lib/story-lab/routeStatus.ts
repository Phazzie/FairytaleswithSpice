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

export function getStoryLabResponseStatus(payload: ApiResponse<unknown> | unknown): number {
  if (!payload || typeof payload !== 'object') {
    return 500;
  }

  const response = payload as Partial<ApiResponse<unknown>>;
  if (response.success === true) {
    return response.data === undefined ? 500 : 200;
  }

  if (response.success !== false || !response.error || typeof response.error !== 'object') {
    return 500;
  }

  const code = typeof response.error.code === 'string' ? response.error.code : '';

  if (CLIENT_ERROR_CODES.has(code)) {
    return 400;
  }

  if (SERVICE_UNAVAILABLE_CODES.has(code)) {
    return 503;
  }

  return 500;
}
