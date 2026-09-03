#!/usr/bin/env tsx
// Created: 2026-09-03 04:55 EDT

import { createClerkSessionVerifier } from '../api/_lib/story-lab/auth/clerkSessionVerifier';
import {
  resolveProductionClerkAuthPortOptions
} from '../api/_lib/story-lab/auth/configuredAuthPort';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testVerifierReturnsUserForValidToken();
  await testVerifierReadsCustomEmailClaimWhenPresent();
  await testVerifierOmitsEmailWhenClaimAbsent();
  await testVerifierRejectsPayloadWithoutSubject();
  await testVerifierRejectsWhenClerkReportsErrors();
  await testVerifierPropagatesThrownErrors();
  await testVerifierPassesSecretKeyThrough();
  await testResolveProductionOptionsSkipsNonClerkProvider();
  await testResolveProductionOptionsFailsFastWithoutSecretKey();
  await testResolveProductionOptionsFailsFastOnBlankSecretKey();
  await testResolveProductionOptionsWiresRealVerifierWhenConfigured();

  console.log('Clerk session verifier tests passed');
}

async function testVerifierReturnsUserForValidToken() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => ({ data: { sub: 'user_123' } } as any)
  });

  const session = await verify('a-session-token');
  assert(session?.userId === 'user_123', 'valid token should resolve to the payload subject as userId');
  assert(session?.email === undefined, 'session without an email claim should leave email undefined');
}

async function testVerifierReadsCustomEmailClaimWhenPresent() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => ({ data: { sub: 'user_456', email: 'owner@example.com' } } as any)
  });

  const session = await verify('a-session-token');
  assert(session?.email === 'owner@example.com', 'a custom email claim should be read through when present');
}

async function testVerifierOmitsEmailWhenClaimAbsent() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => ({ data: { sub: 'user_789', email: 42 } } as any)
  });

  const session = await verify('a-session-token');
  assert(session?.email === undefined, 'a non-string email claim should be dropped rather than coerced');
}

async function testVerifierRejectsPayloadWithoutSubject() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => ({ data: {} } as any)
  });

  const session = await verify('a-session-token');
  assert(session === null, 'a payload without a subject claim should not resolve to a session');
}

async function testVerifierRejectsWhenClerkReportsErrors() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => ({ errors: [new Error('expired')] } as any)
  });

  const session = await verify('an-expired-token');
  assert(session === null, 'a Clerk-reported verification error should resolve to null, not throw');
}

async function testVerifierPropagatesThrownErrors() {
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_unused',
    verifyTokenFn: async () => {
      throw new Error('network unreachable');
    }
  });

  try {
    await verify('a-session-token');
    throw new Error('verifier should have propagated the thrown error');
  } catch (error) {
    assert((error as Error).message === 'network unreachable', 'verifier should propagate unexpected verifyToken failures untouched');
  }
}

async function testVerifierPassesSecretKeyThrough() {
  const seenOptions: unknown[] = [];
  const verify = createClerkSessionVerifier({
    secretKey: 'sk_test_expected',
    verifyTokenFn: async (_token, options) => {
      seenOptions.push(options);
      return { data: { sub: 'user_seen' } } as any;
    }
  });

  await verify('a-session-token');
  assert(
    (seenOptions[0] as { secretKey?: string })?.secretKey === 'sk_test_expected',
    'verifier should pass its configured secretKey to @clerk/backend on every call'
  );
}

async function testResolveProductionOptionsSkipsNonClerkProvider() {
  const options = resolveProductionClerkAuthPortOptions({});
  assert(options === undefined, 'unset provider should not wire any Clerk options');

  const noneOptions = resolveProductionClerkAuthPortOptions({ STORY_LAB_AUTH_PROVIDER: 'none' });
  assert(noneOptions === undefined, 'an explicit "none" provider should not wire any Clerk options');
}

async function testResolveProductionOptionsFailsFastWithoutSecretKey() {
  try {
    resolveProductionClerkAuthPortOptions({ STORY_LAB_AUTH_PROVIDER: 'clerk' });
    throw new Error('should have failed fast without CLERK_SECRET_KEY');
  } catch (error) {
    assert(
      (error as Error).message.includes('CLERK_SECRET_KEY'),
      'missing secret key error should name the missing variable'
    );
  }
}

async function testResolveProductionOptionsFailsFastOnBlankSecretKey() {
  try {
    resolveProductionClerkAuthPortOptions({ STORY_LAB_AUTH_PROVIDER: 'clerk', CLERK_SECRET_KEY: '   ' });
    throw new Error('should have failed fast on a blank CLERK_SECRET_KEY');
  } catch (error) {
    assert(
      (error as Error).message.includes('CLERK_SECRET_KEY'),
      'a whitespace-only secret key should be treated as missing'
    );
  }
}

async function testResolveProductionOptionsWiresRealVerifierWhenConfigured() {
  const seenSecretKeys: string[] = [];
  const options = resolveProductionClerkAuthPortOptions(
    { STORY_LAB_AUTH_PROVIDER: 'clerk', CLERK_SECRET_KEY: 'sk_test_live' },
    {
      verifyTokenFn: async (_token, verifyOptions) => {
        seenSecretKeys.push((verifyOptions as { secretKey: string }).secretKey);
        return { data: { sub: 'user_wired' } } as any;
      }
    }
  );

  assert(options?.verifySessionToken, 'a configured Clerk provider should wire a verifySessionToken function');
  const session = await options!.verifySessionToken!('token', {});
  assert(session?.userId === 'user_wired', 'the wired verifier should resolve real sessions');
  assert(seenSecretKeys[0] === 'sk_test_live', 'the wired verifier should use the configured secret key');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
