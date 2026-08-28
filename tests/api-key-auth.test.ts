#!/usr/bin/env tsx
// Created: 2026-08-24 13:58 UTC

import {
  API_KEY_MINIMUM_LENGTH,
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
    process.env['API_KEYS'] = 'sk-test-first-key-value';
    await authenticateRequest({ method: 'POST', headers: { 'x-api-key': 'sk-test-first-key-value' }, body: {} });
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

/**
 * Drive one request against one `API_KEYS` configuration.
 *
 * The warning state is process-wide and gated on the raw `API_KEYS` value, so
 * each case resets it: otherwise a configuration that happens to repeat an
 * earlier one would log nothing and the log assertions below would be reading
 * the previous case's entries.
 */
async function authenticateWith(configuredKeys: string, presentedKey: string) {
  const previous = process.env['API_KEYS'];
  process.env['API_KEYS'] = configuredKeys;
  resetApiKeyConfigurationWarningForTests();
  logger.clearLogs();

  try {
    return await authenticateRequest({
      method: 'POST',
      headers: { 'x-api-key': presentedKey },
      body: {}
    });
  } finally {
    if (previous === undefined) {
      delete process.env['API_KEYS'];
    } else {
      process.env['API_KEYS'] = previous;
    }
    resetApiKeyConfigurationWarningForTests();
  }
}

/**
 * An `API_KEYS` entry has to look like a credential to be used as one.
 *
 * Every entry used to be trusted on the single condition that it was non-empty,
 * so `abcdef`, `test`, and the four characters left behind by an unfinished
 * paste were live credentials for routes that spend real money — and the
 * deployment could not tell, because nothing refused them and nothing said so.
 *
 * The defect each case kills is named in its message. The one that matters most
 * is the third: the plausible way to write this rule is to drop unusable entries
 * and let the existing `length === 0` check take over, which routes a
 * misconfiguration straight into development mode and serves every caller as
 * `development_user`. That is strictly worse than the hole being closed, so it
 * is asserted directly rather than left to follow from the others.
 */
async function testTheConfiguredKeyContract(): Promise<void> {
  const usable = 'sk-test-first-key-value';
  const tooShort = 'abcdef';

  const short = await authenticateWith(tooShort, tooShort);
  assert(
    !short.authenticated,
    'a configured key below the minimum length should not authenticate'
  );

  // Entries are comma-split and trimmed, so what survives to here with a space
  // or a quote in it came from a shell that kept the quoting, not a generator.
  const malformed = 'a key with spaces that is long enough';
  const outsideAlphabet = await authenticateWith(malformed, malformed);
  assert(
    !outsideAlphabet.authenticated,
    'a configured key outside the credential alphabet should not authenticate'
  );

  // The one that must never regress: a configuration that is entirely unusable
  // is a *refusal*, not an absence. Reaching the development-mode branch here
  // would turn one typo in `API_KEYS` into an app with no authentication at all.
  assert(
    short.error?.code === 'API_KEY_CONFIGURATION_INVALID',
    `an unusable configuration should be reported as misconfigured, got ${short.error?.code}`
  );
  assert(
    short.userId !== 'development_user',
    'an unusable configuration must not fall back to unconfigured development mode'
  );
  const noKeyPresented = await authenticateWith(tooShort, '');
  assert(
    !noKeyPresented.authenticated && noKeyPresented.userId !== 'development_user',
    'an unusable configuration should refuse a request that presents no key at all'
  );

  // A rejected entry must not take its usable neighbours down with it.
  const alongside = await authenticateWith(`${tooShort},${usable}`, usable);
  assert(
    alongside.authenticated,
    'a usable key should still authenticate when configured alongside a rejected one'
  );
  const rejectedNeighbour = await authenticateWith(`${tooShort},${usable}`, tooShort);
  assert(
    !rejectedNeighbour.authenticated,
    'a rejected key should not authenticate even when a usable key is configured beside it'
  );

  // The boundary, asserted against the contract rather than a copy of the number.
  const atMinimum = 'k'.repeat(API_KEY_MINIMUM_LENGTH);
  const belowMinimum = 'k'.repeat(API_KEY_MINIMUM_LENGTH - 1);
  assert(
    (await authenticateWith(atMinimum, atMinimum)).authenticated,
    `a key of exactly ${API_KEY_MINIMUM_LENGTH} characters should authenticate`
  );
  assert(
    !(await authenticateWith(belowMinimum, belowMinimum)).authenticated,
    `a key one character below ${API_KEY_MINIMUM_LENGTH} should not authenticate`
  );
}

/**
 * `=` is base64 padding, and padding is not secret.
 *
 * Both halves of this were live holes found in review. A flat character class
 * accepted `=` anywhere, so `================` — sixteen characters of pure
 * padding and no credential whatsoever — satisfied both the alphabet and the
 * length floor and authenticated. And measuring the floor over the whole string
 * let padding stand in for the entropy the floor exists to require, so
 * `a===============` cleared a sixteen-character minimum carrying one character
 * of key. The grammar now demands a token body before any padding, and the
 * length is measured on that body.
 */
async function testPaddingCannotStandInForCredential(): Promise<void> {
  const allPadding = '='.repeat(API_KEY_MINIMUM_LENGTH);
  assert(
    !(await authenticateWith(allPadding, allPadding)).authenticated,
    'a value of nothing but padding should not authenticate'
  );

  const oneCharacterAndPadding = `a${'='.repeat(API_KEY_MINIMUM_LENGTH - 1)}`;
  assert(
    !(await authenticateWith(oneCharacterAndPadding, oneCharacterAndPadding)).authenticated,
    'padding should not count toward the minimum length'
  );

  const leadingPadding = `=${'k'.repeat(API_KEY_MINIMUM_LENGTH)}`;
  assert(
    !(await authenticateWith(leadingPadding, leadingPadding)).authenticated,
    'padding is only ever trailing, so a leading `=` is not a well-formed token'
  );

  // A real base64 token carries at most two padding characters, and stays valid.
  const paddedRealToken = `${'k'.repeat(API_KEY_MINIMUM_LENGTH)}==`;
  assert(
    (await authenticateWith(paddedRealToken, paddedRealToken)).authenticated,
    'a genuine base64 token with trailing padding should still authenticate'
  );
}

/**
 * `API_KEYS` set to something that holds no key is a misconfiguration, not an
 * absence.
 *
 * A secret substitution that silently produces whitespace is the exact case
 * where reading the value as "unset" is worst: the operator asked for
 * authentication, the deploy pipeline gave them nothing, and treating that as
 * development mode would serve every caller as `development_user`. The empty
 * string is the one spelling that still counts as absent, because `API_KEYS=`
 * is how a `.env` file writes an unset variable and the deployment docs have
 * always described it that way.
 */
async function testABlankConfigurationFailsClosed(): Promise<void> {
  for (const blank of [' ', '   ', ',', ' , ', ',,,']) {
    const result = await authenticateWith(blank, 'anything');
    assert(
      !result.authenticated,
      `API_KEYS=${JSON.stringify(blank)} holds no key and should refuse every request`
    );
    assert(
      result.userId !== 'development_user',
      `API_KEYS=${JSON.stringify(blank)} must not be read as an unset variable`
    );
  }

  const emptyString = await authenticateWith('', 'anything');
  assert(
    emptyString.authenticated && emptyString.userId === 'development_user',
    'API_KEYS="" is how a .env file spells unset and should stay in development mode'
  );
}

/**
 * Whitespace around an entry belongs to the comma-separated list, not to the
 * entry, so it is stripped before the grammar sees it.
 *
 * Pinned because the grammar's docblock claims it, and because the first draft
 * of that docblock claimed the opposite — that a value configured with a
 * trailing newline was refused. It is not: it is the same credential as the
 * value without one, which is also how `readHeader` reads a presented key.
 */
async function testSeparatorWhitespaceIsNotPartOfTheEntry(): Promise<void> {
  const key = 'sk-test-first-key-value';
  assert(
    (await authenticateWith(`${key}\n`, key)).authenticated,
    'a trailing newline is separator whitespace and should not change the credential'
  );
  assert(
    !(await authenticateWith(`sk-test-first\nkey-value`, 'sk-test-first\nkey-value')).authenticated,
    'a newline inside an entry is part of the entry and should be refused'
  );
}

/**
 * A rejected entry is still whatever the operator believed was a credential —
 * quite possibly a real one that is merely too short. The report that it was
 * refused must therefore count entries rather than name them, or the hardening
 * would write secrets into the log as the price of refusing them.
 */
async function testRejectedKeysAreNeverWrittenToTheLog(): Promise<void> {
  const secretButTooShort = 'hunter2';
  const usable = 'sk-test-first-key-value';

  for (const configuration of [secretButTooShort, `${secretButTooShort},${usable}`]) {
    await authenticateWith(configuration, usable);

    const written = JSON.stringify(logger.getRecentLogs(200));
    assert(
      !written.includes(secretButTooShort),
      `a rejected key value must not reach the log (configuration: ${configuration.length} chars)`
    );
    assert(
      written.includes('unusable'),
      'a rejected key should still be reported, by count'
    );
  }
}

async function main(): Promise<void> {
  process.env['API_KEYS'] = 'sk-test-first-key-value, sk-test-second-key-value ,sk-test-third-key-value';

  const spacedKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'sk-test-second-key-value' },
    body: {}
  });
  assert(spacedKey.authenticated, 'keys configured with surrounding spaces should still authenticate');

  const lastKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'sk-test-third-key-value' },
    body: {}
  });
  assert(lastKey.authenticated, 'every configured key should authenticate');

  const bearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer sk-test-first-key-value' },
    body: {}
  });
  assert(bearer.authenticated, 'a Bearer authorization header should authenticate');

  const lowercaseBearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'bearer sk-test-first-key-value' },
    body: {}
  });
  assert(lowercaseBearer.authenticated, 'the Bearer scheme should be matched case-insensitively');

  const tabSeparatedBearer = await authenticateRequest({
    method: 'POST',
    headers: { authorization: 'Bearer\tsk-test-first-key-value' },
    body: {}
  });
  assert(tabSeparatedBearer.authenticated, 'any whitespace may separate the scheme from the credentials');

  const bearerLookalike = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'bearersk-test-first-key-value' },
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
    headers: { 'x-api-key': ['sk-test-first-key-value', 'sk-test-second-key-value'] },
    body: {}
  });
  assert(repeatedHeader.authenticated, 'a repeated header delivered as an array should authenticate');

  const embeddedBearer = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'not Bearer sk-test-first-key-value' },
    body: {}
  });
  assert(!embeddedBearer.authenticated, 'the Bearer prefix should only be stripped from the start of the value');
  assert(embeddedBearer.error?.code === 'INVALID_API_KEY', 'a wrong key should be reported as invalid');

  const canonicalCaseApiKeyHeader = await authenticateRequest({
    method: 'POST',
    headers: { 'X-API-Key': 'sk-test-first-key-value' },
    body: {}
  });
  assert(
    canonicalCaseApiKeyHeader.authenticated,
    'the X-API-Key header named in the documentation should authenticate whatever its casing'
  );

  const canonicalCaseAuthorizationHeader = await authenticateRequest({
    method: 'POST',
    headers: { Authorization: 'Bearer sk-test-third-key-value' },
    body: {}
  });
  assert(
    canonicalCaseAuthorizationHeader.authenticated,
    'a canonically cased Authorization header should authenticate'
  );

  const wrongKey = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'sk-test-first-key-valuex' },
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
  await testTheConfiguredKeyContract();
  await testPaddingCannotStandInForCredential();
  await testABlankConfigurationFailsClosed();
  await testSeparatorWhitespaceIsNotPartOfTheEntry();
  await testRejectedKeysAreNeverWrittenToTheLog();

  console.log('API key auth tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
