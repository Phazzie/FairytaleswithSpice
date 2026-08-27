#!/usr/bin/env tsx
// Created: 2026-08-24 13:58 UTC

import {
  authenticateRequest,
  resetApiKeyConfigurationWarningForTests
} from '../api/_lib/middleware/security';
import { logger } from '../api/_lib/utils/logger';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const LIVE_KEY = 'sk-live-supersecret-value';
const SECOND_LIVE_KEY = 'sk-live-second-value';

async function userIdFor(apiKey: string): Promise<string> {
  const result = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: {}
  });

  assert(result.authenticated, 'a configured key should authenticate');
  assert(result.userId, 'an authenticated request should carry a user id');
  return result.userId;
}

/**
 * "No API keys configured" is a fact about the deployment, not an event.
 *
 * It was a bare `console.warn` on the unconfigured branch, and that branch is
 * read again on every call: `enforceApiAccessControl` runs this function once
 * per request on every paid route, and `API_KEYS` is unset by default, so an
 * ordinary deployment wrote that line for every story generation, continuation,
 * export, image, evaluation, and job request it ever served. A line repeated at
 * request rate is the bulk of the log rather than a warning in it — it costs
 * money on a platform billed by ingested log volume, and it buries the entries
 * that describe something that happened once.
 *
 * Both directions are asserted. Once per configuration, however many requests
 * arrive; and again when the configuration itself changes, because a process
 * that goes from configured to unconfigured has something new to say. Counting
 * the buffered entries rather than the console lines is what makes "how many
 * times" answerable at all — the console form was one unstructured string with
 * nothing to filter on.
 */
async function testTheUnconfiguredWarningIsWrittenOncePerConfiguration(): Promise<void> {
  const captured = { warn: console.warn };
  console.warn = () => {};

  try {
    delete process.env['API_KEYS'];
    resetApiKeyConfigurationWarningForTests();
    logger.clearLogs();

    for (let request = 0; request < 5; request += 1) {
      const result = await authenticateRequest({ method: 'POST', headers: {}, body: {} });
      assert(result.authenticated, 'an unconfigured deployment should still serve the request');
    }

    assert(
      countUnconfiguredWarnings() === 1,
      `five requests against one configuration should warn once (warned ${countUnconfiguredWarnings()} times)`
    );

    // A configured deployment has nothing to warn about.
    process.env['API_KEYS'] = 'key-one';
    await authenticateRequest({ method: 'POST', headers: { 'x-api-key': 'key-one' }, body: {} });
    assert(
      countUnconfiguredWarnings() === 1,
      'a configured deployment should add no warning of its own'
    );

    // Losing the configuration is new information, so it is said again.
    delete process.env['API_KEYS'];
    await authenticateRequest({ method: 'POST', headers: {}, body: {} });
    assert(
      countUnconfiguredWarnings() === 2,
      `a configuration that changes should be warned about again (warned ${countUnconfiguredWarnings()} times)`
    );
  } finally {
    console.warn = captured.warn;
    resetApiKeyConfigurationWarningForTests();
  }
}

function countUnconfiguredWarnings(): number {
  return logger
    .getRecentLogs(100, 'warn')
    .filter(entry => entry.message.includes('No API keys are configured'))
    .length;
}

async function main(): Promise<void> {
  process.env['API_KEYS'] = 'key-one, key-two ,key-three';

  const spacedKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'key-two' },
    body: {}
  });
  assert(spacedKey.authenticated, 'keys configured with surrounding spaces should still authenticate');

  const lastKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'key-three' },
    body: {}
  });
  assert(lastKey.authenticated, 'every configured key should authenticate');

  const bearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer key-one' },
    body: {}
  });
  assert(bearer.authenticated, 'a Bearer authorization header should authenticate');

  const lowercaseBearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'bearer key-one' },
    body: {}
  });
  assert(lowercaseBearer.authenticated, 'the Bearer scheme should be matched case-insensitively');

  const tabSeparatedBearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer\tkey-one' },
    body: {}
  });
  assert(tabSeparatedBearer.authenticated, 'any whitespace may separate the scheme from the credentials');

  const bearerLookalike = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'bearerkey-one' },
    body: {}
  });
  assert(!bearerLookalike.authenticated, 'a key merely starting with "bearer" should not have a prefix stripped');

  const bearerWithoutCredentials = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer' },
    body: {}
  });
  assert(
    bearerWithoutCredentials.error?.code === 'MISSING_API_KEY',
    'a Bearer scheme with no credentials should count as missing, not as a key named "Bearer"'
  );

  const bearerWithBlankCredentials = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer   ' },
    body: {}
  });
  assert(
    bearerWithBlankCredentials.error?.code === 'MISSING_API_KEY',
    'a Bearer scheme followed only by whitespace should count as missing'
  );

  const repeatedHeader = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': ['key-one', 'key-two'] },
    body: {}
  });
  assert(repeatedHeader.authenticated, 'a repeated header delivered as an array should authenticate');

  const embeddedBearer = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'not Bearer key-one' },
    body: {}
  });
  assert(!embeddedBearer.authenticated, 'the Bearer prefix should only be stripped from the start of the value');
  assert(embeddedBearer.error?.code === 'INVALID_API_KEY', 'a wrong key should be reported as invalid');

  const canonicalCaseApiKeyHeader = await authenticateRequest({
    method: 'POST',
    headers: { 'X-API-Key': 'key-one' },
    body: {}
  });
  assert(
    canonicalCaseApiKeyHeader.authenticated,
    'the X-API-Key header named in the documentation should authenticate whatever its casing'
  );

  const canonicalCaseAuthorizationHeader = await authenticateRequest({
    method: 'POST',
    headers: { Authorization: 'Bearer key-three' },
    body: {}
  });
  assert(
    canonicalCaseAuthorizationHeader.authenticated,
    'a canonically cased Authorization header should authenticate'
  );

  const wrongKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'key-onex' },
    body: {}
  });
  assert(!wrongKey.authenticated, 'a key that is not configured should be rejected');

  const missingKey = await authenticateRequest({ method: 'POST', headers: {}, body: {} });
  assert(!missingKey.authenticated, 'a request without a key should be rejected');
  assert(missingKey.error?.code === 'MISSING_API_KEY', 'a missing key should be reported as missing');

  const blankKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': '   ' },
    body: {}
  });
  assert(blankKey.error?.code === 'MISSING_API_KEY', 'a whitespace-only key should count as missing');

  // The returned userId is attached to log entries and handed back to callers.
  // It used to be `user_` plus the key's first eight characters, which printed
  // a live credential's prefix beside every authenticated request.
  process.env['API_KEYS'] = `${LIVE_KEY},${SECOND_LIVE_KEY}`;

  const identifiedUserId = await userIdFor(LIVE_KEY);
  for (let length = 4; length <= LIVE_KEY.length; length += 1) {
    assert(
      !identifiedUserId.includes(LIVE_KEY.slice(0, length)),
      `the user id should carry no part of the key (leaked ${length} characters: ${identifiedUserId})`
    );
  }

  assert(
    (await userIdFor(LIVE_KEY)) === identifiedUserId,
    'the same key should always map to the same user id'
  );
  assert(
    (await userIdFor(SECOND_LIVE_KEY)) !== identifiedUserId,
    'two different keys should map to two different user ids'
  );

  process.env['API_KEYS'] = '';
  const unconfigured = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'anything' },
    body: {}
  });
  assert(unconfigured.authenticated, 'requests should still pass through when no keys are configured');

  await testTheUnconfiguredWarningIsWrittenOncePerConfiguration();

  console.log('API key auth tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
