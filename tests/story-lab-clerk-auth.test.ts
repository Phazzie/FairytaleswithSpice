#!/usr/bin/env tsx
// Created: 2026-06-08 10:40 EDT

import { isAuthError } from '../api/_lib/story-lab/auth/authPort';
import {
  createClerkAuthPort,
  readClerkSessionToken
} from '../api/_lib/story-lab/auth/clerkAuthPort';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testClerkAuthFailsClosedWithoutVerifier();
  await testClerkAuthVerifiesBearerToken();
  await testClerkAuthReadsSessionCookie();
  await testClerkAuthRejectsInvalidSessionWithoutLeakingToken();

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

main().catch(error => {
  console.error(error);
  process.exit(1);
});
