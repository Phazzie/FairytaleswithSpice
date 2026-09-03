#!/usr/bin/env tsx
// Created: 2026-09-02 20:40 EDT

import { isAuthError } from '../api/_lib/story-lab/auth/authPort';
import { createClerkAuthPort } from '../api/_lib/story-lab/auth/clerkAuthPort';
import {
  createClerkSessionVerifierFromEnv,
  type ClerkVerifyTokenFn
} from '../api/_lib/story-lab/auth/clerkSessionVerifier';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testMissingSecretKeyStaysUnconfigured();
  await testBlankSecretKeyStaysUnconfigured();
  await testVerifierPassesTokenAndTrimmedSecretKey();
  await testVerifierReturnsNullOnErrorsShapeWithoutThrowing();
  await testVerifierReturnsNullWhenDataHasNoSubject();
  await testVerifierReadsStringEmailClaimOnly();
  await testVerifierWiresIntoClerkAuthPortEndToEnd();
  await testVerifierPassesAuthorizedPartiesFromAllowedOrigins();
  await testVerifierDefaultsAuthorizedPartiesWhenNoOriginEnvSet();
  await testVerifierIncludesThePlatformAssignedDeploymentUrl();
  await testVerifierDoesNotDuplicateAnOriginAlreadyInTheStaticList();
  await testVerifierIgnoresAForgedForwardedHostHeader();

  console.log('Story Lab Clerk session verifier tests passed');
}

function fakeVerifyToken(
  impl: ClerkVerifyTokenFn
): {
  verifyToken: ClerkVerifyTokenFn;
  calls: Array<{ token: string; secretKey: string; authorizedParties?: string[] }>;
} {
  const calls: Array<{ token: string; secretKey: string; authorizedParties?: string[] }> = [];
  return {
    calls,
    verifyToken: async (token, options) => {
      calls.push({ token, secretKey: options.secretKey, authorizedParties: options.authorizedParties });
      return impl(token, options);
    }
  };
}

// The load-bearing case: every deployment that has not set `CLERK_SECRET_KEY`
// — which is every deployment today — must keep getting `undefined` here, so
// `configuredAuthPort`'s production singleton keeps falling back to
// `createClerkAuthPort()`'s existing fail-closed "not configured" behavior.
async function testMissingSecretKeyStaysUnconfigured() {
  const verifier = createClerkSessionVerifierFromEnv({});
  assert(verifier === undefined, 'a missing CLERK_SECRET_KEY should leave the Clerk verifier unconfigured');
}

async function testBlankSecretKeyStaysUnconfigured() {
  const verifier = createClerkSessionVerifierFromEnv({ CLERK_SECRET_KEY: '   ' });
  assert(verifier === undefined, 'a blank CLERK_SECRET_KEY should leave the Clerk verifier unconfigured');
}

async function testVerifierPassesTokenAndTrimmedSecretKey() {
  const fake = fakeVerifyToken(async () => ({
    data: { sub: 'user_from_verify_token' }
  }));

  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: '  sk_test_secret  ' },
    { verifyToken: fake.verifyToken }
  );
  assert(typeof verifier === 'function', 'a configured secret key should produce a verifier function');

  const session = await verifier!('session-token-value', {});
  assert(fake.calls.length === 1, 'the verifier should call verifyToken exactly once');
  assert(fake.calls[0].token === 'session-token-value', 'the verifier should forward the session token unchanged');
  assert(fake.calls[0].secretKey === 'sk_test_secret', 'the verifier should trim the configured secret key');
  assert(session?.userId === 'user_from_verify_token', 'a verified token should resolve to its subject as userId');
}

// `@clerk/backend`'s `verifyToken` does not throw on an invalid or expired
// token — it resolves to `{ errors: [...] }`. A verifier that assumed a throw
// would read `data.sub` off that shape and crash, or worse, treat `undefined`
// as a signed-in user.
async function testVerifierReturnsNullOnErrorsShapeWithoutThrowing() {
  const fake = fakeVerifyToken(async () => ({
    errors: [new Error('token expired')]
  }));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fake.verifyToken }
  );

  const session = await verifier!('expired-token', {});
  assert(session === null, 'an errors-shaped verifyToken result should resolve to null, not throw');
}

async function testVerifierReturnsNullWhenDataHasNoSubject() {
  const fake = fakeVerifyToken(async () => ({ data: undefined, errors: undefined } as any));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fake.verifyToken }
  );

  const session = await verifier!('malformed-result-token', {});
  assert(session === null, 'a verifyToken result with no data.sub should resolve to null');
}

async function testVerifierReadsStringEmailClaimOnly() {
  const fake = fakeVerifyToken(async () => ({
    data: { sub: 'user_with_email', email: 'reader@example.com' }
  }));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fake.verifyToken }
  );
  const session = await verifier!('token-with-email-claim', {});
  assert(session?.email === 'reader@example.com', 'a string email claim should be carried through');

  const fakeWithoutEmail = fakeVerifyToken(async () => ({
    data: { sub: 'user_without_email', email: 42 }
  }));
  const verifierWithoutEmail = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fakeWithoutEmail.verifyToken }
  );
  const sessionWithoutEmail = await verifierWithoutEmail!('token-without-email-claim', {});
  assert(
    sessionWithoutEmail?.email === undefined,
    'a non-string email claim should be dropped rather than surfaced as-is'
  );
}

async function testVerifierWiresIntoClerkAuthPortEndToEnd() {
  const fake = fakeVerifyToken(async () => ({
    data: { sub: 'user_end_to_end', email: 'end-to-end@example.com' }
  }));
  const verifySessionToken = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fake.verifyToken }
  );
  const auth = createClerkAuthPort({ verifySessionToken });

  const user = await auth.requireUser({
    headers: { authorization: 'Bearer end-to-end-session-token' }
  });
  assert(user.userId === 'user_end_to_end', 'a real Clerk session should authenticate through the wired verifier');
  assert(user.email === 'end-to-end@example.com', 'a real Clerk session should carry its email claim through');

  const rejectedFake = fakeVerifyToken(async () => ({ errors: [new Error('bad token')] }));
  const rejectedAuth = createClerkAuthPort({
    verifySessionToken: createClerkSessionVerifierFromEnv(
      { CLERK_SECRET_KEY: 'sk_test_secret' },
      { verifyToken: rejectedFake.verifyToken }
    )
  });

  try {
    await rejectedAuth.requireUser({ headers: { authorization: 'Bearer rejected-session-token' } });
    throw new Error('a rejected verifyToken result should fail requireUser');
  } catch (error) {
    assert(isAuthError(error), 'a rejected session should surface as an AuthError, not an unhandled result');
  }
}

// Verifying with `secretKey` alone accepts any correctly signed token from
// this Clerk instance, including one issued to an untrusted sibling origin
// under the same parent domain that can also obtain a Clerk session — a
// session token exposed there could be replayed against this deployment's
// account routes. `authorizedParties` closes that: it must be exactly the
// same trusted-origin allowlist `applyCorsPolicy` already uses, so a token's
// `azp` claim naming any other origin is rejected.
async function testVerifierPassesAuthorizedPartiesFromAllowedOrigins() {
  const fake = fakeVerifyToken(async () => ({ data: { sub: 'user_from_verify_token' } }));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret', STORY_LAB_ALLOWED_ORIGINS: 'https://app.example.com' },
    { verifyToken: fake.verifyToken }
  );

  await verifier!('session-token-value', {});
  assert(fake.calls.length === 1, 'the verifier should call verifyToken exactly once');
  assert(
    JSON.stringify(fake.calls[0].authorizedParties) === JSON.stringify(['https://app.example.com']),
    `authorizedParties should be exactly the configured allowed origins, got ${JSON.stringify(fake.calls[0].authorizedParties)}`
  );
}

// A Vercel preview deployment gets a fresh URL nobody hardcoded into
// `STORY_LAB_ALLOWED_ORIGINS`. Vercel itself injects `VERCEL_URL` into that
// deployment's own runtime environment — a caller cannot set it — so it is
// safe to trust as an additional authorized party, unlike a request header.
async function testVerifierIncludesThePlatformAssignedDeploymentUrl() {
  const fake = fakeVerifyToken(async () => ({ data: { sub: 'user_from_verify_token' } }));
  const verifier = createClerkSessionVerifierFromEnv(
    {
      CLERK_SECRET_KEY: 'sk_test_secret',
      STORY_LAB_ALLOWED_ORIGINS: 'https://app.example.com',
      VERCEL_URL: 'my-branch-preview.vercel.app'
    },
    { verifyToken: fake.verifyToken }
  );

  await verifier!('session-token-value', {});

  const authorizedParties = fake.calls[0]?.authorizedParties ?? [];
  assert(
    authorizedParties.includes('https://app.example.com'),
    `authorizedParties should still include the configured static origin, got ${JSON.stringify(authorizedParties)}`
  );
  assert(
    authorizedParties.includes('https://my-branch-preview.vercel.app'),
    `authorizedParties should include the platform-assigned VERCEL_URL, got ${JSON.stringify(authorizedParties)}`
  );
}

// The static list and the platform-assigned URL can legitimately name the
// same deployment — this proves that case doesn't produce a duplicate entry.
async function testVerifierDoesNotDuplicateAnOriginAlreadyInTheStaticList() {
  const fake = fakeVerifyToken(async () => ({ data: { sub: 'user_from_verify_token' } }));
  const verifier = createClerkSessionVerifierFromEnv(
    {
      CLERK_SECRET_KEY: 'sk_test_secret',
      STORY_LAB_ALLOWED_ORIGINS: 'https://app.example.com',
      VERCEL_URL: 'app.example.com'
    },
    { verifyToken: fake.verifyToken }
  );

  await verifier!('session-token-value', {});

  const authorizedParties = fake.calls[0]?.authorizedParties ?? [];
  assert(
    JSON.stringify(authorizedParties) === JSON.stringify(['https://app.example.com']),
    `an origin already in the static list should not be duplicated, got ${JSON.stringify(authorizedParties)}`
  );
}

// The earlier version of this fix derived an authorized party from
// `X-Forwarded-Host` — safe for CORS (a browser-only restriction a
// non-browser caller was never bound by anyway) but not for
// `authorizedParties`, the actual boundary deciding which origins a token
// may claim. A caller holding a valid token from an untrusted sibling origin
// could simply set that header to its own `azp` and pass. This proves a
// forged forwarded-host header is never consulted at all.
async function testVerifierIgnoresAForgedForwardedHostHeader() {
  const fake = fakeVerifyToken(async () => ({ data: { sub: 'user_from_verify_token' } }));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret', STORY_LAB_ALLOWED_ORIGINS: 'https://app.example.com' },
    { verifyToken: fake.verifyToken }
  );

  await verifier!('session-token-value', {
    headers: { 'x-forwarded-host': 'attacker-controlled-sibling.example.com', 'x-forwarded-proto': 'https' }
  });

  const authorizedParties = fake.calls[0]?.authorizedParties ?? [];
  assert(
    !authorizedParties.some(origin => origin.includes('attacker-controlled-sibling.example.com')),
    `a caller-supplied forwarded-host header must never become an authorized party, got ${JSON.stringify(authorizedParties)}`
  );
  assert(
    JSON.stringify(authorizedParties) === JSON.stringify(['https://app.example.com']),
    `authorizedParties should be unaffected by request headers entirely, got ${JSON.stringify(authorizedParties)}`
  );
}

// A deployment with no origin env var set at all still gets the same
// default allowlist `applyCorsPolicy` falls back to, rather than an empty
// (and therefore unchecked, per Clerk's own `assertAuthorizedPartiesClaim`)
// authorizedParties list.
async function testVerifierDefaultsAuthorizedPartiesWhenNoOriginEnvSet() {
  const fake = fakeVerifyToken(async () => ({ data: { sub: 'user_from_verify_token' } }));
  const verifier = createClerkSessionVerifierFromEnv(
    { CLERK_SECRET_KEY: 'sk_test_secret' },
    { verifyToken: fake.verifyToken }
  );

  await verifier!('session-token-value', {});
  assert(
    Array.isArray(fake.calls[0].authorizedParties) && fake.calls[0].authorizedParties!.length > 0,
    'authorizedParties should default to the CORS policy default allowed origins, not an empty list'
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
