#!/usr/bin/env tsx
// Created: 2026-08-24 UTC

import { authenticateRequest } from '../api/_lib/middleware/security';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
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

  process.env['API_KEYS'] = '';
  const unconfigured = await authenticateRequest({
    method: 'POST',
    headers: { 'x-api-key': 'anything' },
    body: {}
  });
  assert(unconfigured.authenticated, 'requests should still pass through when no keys are configured');

  console.log('API key auth tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
