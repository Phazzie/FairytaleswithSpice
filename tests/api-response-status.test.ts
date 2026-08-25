// Created: 2026-08-25 12:10 UTC
//
// Proves the status a legacy route answers with now describes the envelope it
// is sending. Every one of those routes used to end in
// `res.status(200).json(result)` whatever `result` said, so a refused, invalid,
// or failed request was reported as OK on the wire.

import assert from 'node:assert/strict';
import { getApiResponseStatus } from '../api/_lib/http/apiResponseStatus';

function check(label: string, payload: unknown, expected: number): void {
  const actual = getApiResponseStatus(payload);
  assert.equal(actual, expected, `${label} should map to ${expected}, got ${actual}`);
}

function failure(code: string): unknown {
  return { success: false, error: { code, message: 'irrelevant' } };
}

check('a successful envelope', { success: true, data: {} }, 200);
check('a successful envelope with no data', { success: true }, 200);

// The service's own rejections are the caller's to fix.
check('INVALID_INPUT', failure('INVALID_INPUT'), 400);
check('FORMAT_NOT_SUPPORTED', failure('FORMAT_NOT_SUPPORTED'), 400);
check('UNSUPPORTED_STYLE', failure('UNSUPPORTED_STYLE'), 400);
check('CONTENT_VIOLATION', failure('CONTENT_VIOLATION'), 400);
check('CONTENT_POLICY_VIOLATION', failure('CONTENT_POLICY_VIOLATION'), 400);
check('MAX_CHAPTERS_REACHED', failure('MAX_CHAPTERS_REACHED'), 400);

// `CONTENT_TOO_LARGE` stays a 400 rather than becoming a 413: the export route
// already answers 400 for a body past its cap before the service is reached,
// and one code must not mean two statuses depending on which check caught it.
check('CONTENT_TOO_LARGE', failure('CONTENT_TOO_LARGE'), 400);

check('UNAUTHORIZED', failure('UNAUTHORIZED'), 401);
check('MISSING_API_KEY', failure('MISSING_API_KEY'), 401);
check('INVALID_API_KEY', failure('INVALID_API_KEY'), 401);
check('FORBIDDEN_ORIGIN', failure('FORBIDDEN_ORIGIN'), 403);
check('STORY_NOT_FOUND', failure('STORY_NOT_FOUND'), 404);
check('METHOD_NOT_ALLOWED', failure('METHOD_NOT_ALLOWED'), 405);
check('RATE_LIMITED', failure('RATE_LIMITED'), 429);
check('IMAGE_QUOTA_EXCEEDED', failure('IMAGE_QUOTA_EXCEEDED'), 429);
check('AI_SERVICE_UNAVAILABLE', failure('AI_SERVICE_UNAVAILABLE'), 503);
check('AI_UNAVAILABLE', failure('AI_UNAVAILABLE'), 503);

// A failure that does not say why is a server failure, which is the honest
// answer and the one a retry policy keyed on 5xx can act on.
check('GENERATION_FAILED', failure('GENERATION_FAILED'), 500);
check('CONTINUATION_FAILED', failure('CONTINUATION_FAILED'), 500);
check('EXPORT_FAILED', failure('EXPORT_FAILED'), 500);
check('IMAGE_GENERATION_FAILED', failure('IMAGE_GENERATION_FAILED'), 500);
check('an unknown code', failure('SOMETHING_NEW'), 500);

// Nothing that is not an envelope may be reported as a success.
check('a failure with no error object', { success: false }, 500);
check('a failure with a non-string code', { success: false, error: { code: 7 } }, 500);
check('a null payload', null, 500);
check('a string payload', 'ok', 500);
check('an envelope with no success flag', { data: {} }, 500);

console.log('API response status mapping tests passed');
