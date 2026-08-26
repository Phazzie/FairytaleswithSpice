// Created: 2026-08-25 12:10 UTC

import { ERROR_CODES } from '../errorCodes';

/**
 * Choose the HTTP status that matches an `ApiResponse` envelope.
 *
 * The legacy story, continuation, and export routes all ended with
 * `res.status(200).json(result)` — on both deployments, and whatever `result`
 * said. So a story the generator refused for a content violation, an export of
 * an unsupported format, a request the service itself rejected as
 * `INVALID_INPUT`, and a provider outage were every one of them served as
 * `200 OK` with a `success: false` body. Only a client that reads the envelope
 * can tell those apart: a fetch that checks `response.ok`, a browser
 * `EventSource`, an uptime probe, a proxy's error-rate metric, or a retry policy
 * keyed on `5xx` all saw an unbroken run of successes over a service that was
 * failing every request. The Story Lab routes have answered a real status since
 * `getStoryLabResponseStatus` was introduced; this is the same reading for the
 * envelope the rest of the routes return.
 *
 * A successful envelope is `200`. A failure is mapped by its error code, which
 * is the only part of the envelope that says what went wrong, and an unmapped
 * code is `500` — the honest answer for "the service failed and did not say
 * why". `CONTENT_TOO_LARGE` is deliberately a `400` rather than a `413`: the
 * export route already answers `400` for a body past its cap before the service
 * is reached, and one code should not mean two statuses depending on which
 * check caught it.
 */

const CLIENT_ERROR_CODES = new Set<string>([
  ERROR_CODES.INVALID_INPUT,
  ERROR_CODES.INVALID_CREATURE,
  ERROR_CODES.INVALID_THEMES,
  ERROR_CODES.INVALID_THEME_VALUE,
  ERROR_CODES.TOO_MANY_THEMES,
  ERROR_CODES.INVALID_SPICY_LEVEL,
  ERROR_CODES.SPICY_LEVEL_OUT_OF_RANGE,
  ERROR_CODES.INVALID_WORD_COUNT,
  ERROR_CODES.INVALID_USER_INPUT,
  ERROR_CODES.USER_INPUT_TOO_LONG,
  ERROR_CODES.MISSING_REQUIRED_FIELD,
  ERROR_CODES.CONTENT_TOO_LARGE,
  ERROR_CODES.CONTENT_VIOLATION,
  ERROR_CODES.UNSUPPORTED_CONTENT,
  ERROR_CODES.UNSUPPORTED_STYLE,
  ERROR_CODES.FORMAT_NOT_SUPPORTED,
  ERROR_CODES.MAX_CHAPTERS_REACHED,
  'CONTENT_POLICY_VIOLATION',
  'INVALID_BLUEPRINT',
  'INVALID_REQUEST'
]);

const UNAUTHORIZED_CODES = new Set<string>([
  ERROR_CODES.UNAUTHORIZED,
  ERROR_CODES.MISSING_API_KEY,
  ERROR_CODES.INVALID_API_KEY
]);

const FORBIDDEN_CODES = new Set<string>([
  ERROR_CODES.FORBIDDEN,
  ERROR_CODES.FORBIDDEN_ORIGIN
]);

const NOT_FOUND_CODES = new Set<string>([
  ERROR_CODES.STORY_NOT_FOUND,
  ERROR_CODES.AUDIO_NOT_FOUND,
  ERROR_CODES.EXPORT_NOT_FOUND
]);

const RATE_LIMITED_CODES = new Set<string>([
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.QUOTA_EXCEEDED,
  ERROR_CODES.AUDIO_QUOTA_EXCEEDED,
  ERROR_CODES.IMAGE_QUOTA_EXCEEDED,
  ERROR_CODES.STORAGE_QUOTA_EXCEEDED
]);

const SERVICE_UNAVAILABLE_CODES = new Set<string>([
  ERROR_CODES.AI_SERVICE_UNAVAILABLE,
  'AI_UNAVAILABLE'
]);

export function getApiResponseStatus(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    return 500;
  }

  const response = payload as { success?: unknown; error?: unknown };
  if (response.success === true) {
    return 200;
  }

  const error = response.error;
  const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : '';

  if (CLIENT_ERROR_CODES.has(code)) {
    return 400;
  }

  if (UNAUTHORIZED_CODES.has(code)) {
    return 401;
  }

  if (FORBIDDEN_CODES.has(code)) {
    return 403;
  }

  if (NOT_FOUND_CODES.has(code)) {
    return 404;
  }

  if (code === ERROR_CODES.METHOD_NOT_ALLOWED) {
    return 405;
  }

  if (RATE_LIMITED_CODES.has(code)) {
    return 429;
  }

  if (SERVICE_UNAVAILABLE_CODES.has(code)) {
    return 503;
  }

  return 500;
}
