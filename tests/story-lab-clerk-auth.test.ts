#!/usr/bin/env tsx
// Created: 2026-06-08 10:40 EDT

import { isAuthError } from '../api/_lib/story-lab/auth/authPort';
import {
  createClerkAuthPort,
  readClerkSessionToken
} from '../api/_lib/story-lab/auth/clerkAuthPort';
import { logger } from '../api/_lib/utils/logger';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testClerkAuthFailsClosedWithoutVerifier();
  await testClerkAuthVerifiesBearerToken();
  await testClerkAuthReadsDedicatedSessionHeaderBeforeAuthorization();
  await testClerkAuthReadsSessionCookie();
  await testClerkAuthIgnoresMalformedRuntimeHeaders();
  await testClerkAuthRejectsInvalidSessionWithoutLeakingToken();
  await testClerkAuthVerificationFailureLogsThroughStructuredLogger();

  console.log('Story Lab Clerk auth tests passed');
}

async function testClerkAuthFailsClosedWithoutVerifier() {
  const auth = createClerkAuthPort();
  const req = { headers: { authorization: 'Bearer clerk-session-token' } };

  const user = await auth.getCurrentUser(req);
  assert(user === null, 'Clerk auth without verifier should not trust raw bearer tokens');

  try {
    await auth.requireUser(req);
    throw new Error('Clerk auth without verifier should require configured verification');
  } catch (error) {
    assert(isAuthError(error), 'missing verifier should throw AuthError');
    assert(error.message.includes('not configured'), 'missing verifier error should be honest');
    assert(!error.message.includes('clerk-session-token'), 'missing verifier error should not leak the session token');
  }
}

async function testClerkAuthVerifiesBearerToken() {
  const seenTokens: string[] = [];
  const auth = createClerkAuthPort({
    verifySessionToken: async token => {
      seenTokens.push(token);
      return {
        userId: 'user_clerk_owner',
        email: 'owner@example.com'
      };
    }
  });

  const user = await auth.requireUser({
    headers: {
      authorization: 'Bearer bearer-session-token'
    }
  });

  assert(seenTokens[0] === 'bearer-session-token', 'Clerk auth should verify the bearer token value');
  assert(user.userId === 'user_clerk_owner', 'Clerk auth should return verified user id');
  assert(user.email === 'owner@example.com', 'Clerk auth should return verified email when available');
}

// `X-Story-Lab-Session` carries the token on routes that also run
// `enforceApiAccessControl` (`beginPostRoute`) — those read `Authorization:
// Bearer` as an `API_KEYS` candidate whenever a deployment configures one, so
// a Clerk JWT sent that way would be misread as an invalid key rather than
// ever reaching this port. The interceptor sends this header there instead,
// and still sends `Authorization` on the account routes, which never run
// `enforceApiAccessControl`.
async function testClerkAuthReadsDedicatedSessionHeaderBeforeAuthorization() {
  assert(
    readClerkSessionToken({ headers: { 'x-story-lab-session': 'dedicated-header-token' } }) === 'dedicated-header-token',
    'Clerk auth should read the dedicated session header'
  );

  // Header lookups are case-insensitive elsewhere in this module (`readHeader`);
  // this is what would catch a regression to a case-sensitive check on the
  // new header specifically.
  assert(
    readClerkSessionToken({ headers: { 'X-Story-Lab-Session': 'case-insensitive-token' } }) === 'case-insensitive-token',
    'the dedicated session header should be read case-insensitively'
  );

  assert(
    readClerkSessionToken({
      headers: {
        'x-story-lab-session': 'dedicated-header-token',
        authorization: 'Bearer bearer-token'
      }
    }) === 'dedicated-header-token',
    'the dedicated session header should win over Authorization when both are present'
  );
}

async function testClerkAuthReadsSessionCookie() {
  assert(readClerkSessionToken({
    cookies: {
      __session: 'cookie-session-token'
    }
  }) === 'cookie-session-token', 'Clerk auth should read the __session cookie');

  assert(readClerkSessionToken({
    headers: {
      cookie: 'theme=dark; __session=raw-cookie-session-token; other=value'
    }
  }) === 'raw-cookie-session-token', 'Clerk auth should read __session from raw cookie headers');
}

async function testClerkAuthIgnoresMalformedRuntimeHeaders() {
  assert(readClerkSessionToken({
    cookies: {
      __session: 42
    }
  } as any) === null, 'Clerk auth should ignore non-string cookie values');

  assert(readClerkSessionToken({
    headers: {
      authorization: 123
    }
  } as any) === null, 'Clerk auth should ignore non-string authorization headers');

  assert(readClerkSessionToken({
    headers: {
      authorization: [' ', 99, 'Bearer array-session-token']
    }
  } as any) === 'array-session-token', 'Clerk auth should skip malformed array header values');
}

async function testClerkAuthRejectsInvalidSessionWithoutLeakingToken() {
  const auth = createClerkAuthPort({
    verifySessionToken: async () => null
  });

  try {
    await auth.requireUser({
      headers: {
        authorization: 'Bearer invalid-session-token'
      }
    });
    throw new Error('invalid Clerk sessions should be rejected');
  } catch (error) {
    assert(isAuthError(error), 'invalid Clerk session should throw AuthError');
    assert(!error.message.includes('invalid-session-token'), 'invalid token should not appear in auth errors');
  }
}

// The raw `console.warn(..., { errorName })` this used to be never reached the
// shared recent-log buffer the Error Display panel reads and carried no
// request correlation. This asserts the failure now lands there, tagged with
// the request's own correlation id, and that the verifier's thrown error
// (which could carry a session token in its message) never reaches the log.
async function testClerkAuthVerificationFailureLogsThroughStructuredLogger() {
  const auth = createClerkAuthPort({
    verifySessionToken: async () => {
      throw new Error('upstream Clerk session-token-abc123 lookup timed out');
    }
  });

  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  logger.clearLogs();

  try {
    await auth.requireUser({
      headers: {
        authorization: 'Bearer session-token-abc123',
        'x-request-id': 'req-clerk-test-1'
      }
    });
    throw new Error('a verifier that throws should still fail the request');
  } catch (error) {
    assert(isAuthError(error), 'verifier failures should surface as AuthError');
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }

  const warnings = logger.getRecentLogs(50, 'warn');
  assert(warnings.length === 1, 'a verifier failure should emit exactly one structured warning');
  const [entry] = warnings;
  assert(entry.context?.requestId === 'req-clerk-test-1', 'the warning should carry the request correlation id');
  assert(entry.context?.endpoint === 'clerkAuthPort.requireUser', 'the warning should identify the failing port method');
  assert(!JSON.stringify(entry).includes('session-token-abc123'), 'the verifier error message should not reach the log');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
