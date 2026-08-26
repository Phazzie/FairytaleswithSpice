// Created: 2026-06-21 20:56 EDT

import type { ApiResponse } from './contracts';
import { getApiResponseStatus } from '../http/apiResponseStatus';

/**
 * Choose the HTTP status the Story Lab genesis and continuation routes answer
 * with.
 *
 * This used to carry a table of its own, and it knew three error codes:
 * `CONTENT_POLICY_VIOLATION`, `INVALID_BLUEPRINT`, and `INVALID_REQUEST` for
 * `400`, and `AI_UNAVAILABLE` for `503`. Everything else was `500`.
 *
 * Those three are the codes the Story Lab engine raises for itself, and they
 * are not the only codes these routes return. `storyLabErrorResponse` forwards
 * the classic `StoryService`'s error code verbatim — that service is what
 * actually generates the story behind both routes — so its whole vocabulary
 * reaches this function and none of it was mapped. A blueprint the classic
 * validator rejects answers `INVALID_INPUT`, a throttled key answers
 * `RATE_LIMITED`, an exhausted one `QUOTA_EXCEEDED`, a provider outage
 * `AI_SERVICE_UNAVAILABLE`, a story past the size cap `CONTENT_TOO_LARGE`: every
 * one of them was served as `500`, which says the service broke rather than what
 * did. A client cannot act on that — a retry policy keyed on `5xx` retries a
 * request that will be refused identically forever, a rate limit that should
 * back off does not, and an uptime probe records an outage over a caller's
 * malformed field. The classic routes have answered the right status for these
 * exact codes since `getApiResponseStatus` was introduced; the same codes
 * arriving through a Story Lab route are the same failures.
 *
 * So the reading is shared rather than restated, and `INVALID_BLUEPRINT` moved
 * into the shared table where the other two Story Lab codes already were. What
 * stays here is the one rule that is genuinely this route's own: a successful
 * envelope with no payload is a service failure, because these routes promise a
 * story iteration beside `success: true` and a caller has nothing to render
 * without one.
 */
export function getStoryLabResponseStatus(payload: ApiResponse<unknown> | unknown): number {
  if (!payload || typeof payload !== 'object') {
    return 500;
  }

  const response = payload as Partial<ApiResponse<unknown>>;
  if (response.success === true) {
    return response.data == null ? 500 : 200;
  }

  return getApiResponseStatus(payload);
}
