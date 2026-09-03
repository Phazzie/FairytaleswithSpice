// Created: 2026-09-03 04:50 EDT

import { verifyToken } from '@clerk/backend';
import type { VerifiedClerkSession } from './clerkAuthPort';

/**
 * `@clerk/backend`'s own signature, narrowed to the one call this file makes.
 * Threading it through as an option (rather than importing `verifyToken`
 * directly at the call site) is what lets tests exercise the wrapping logic
 * below without a live Clerk secret key or a network call to Clerk's JWKS
 * endpoint.
 */
type VerifyTokenFn = typeof verifyToken;

export interface ClerkSessionVerifierOptions {
  secretKey: string;
  /**
   * The `azp` (authorized party) values a session token must carry to be
   * accepted - normally the app's own origin(s). Left unset, `@clerk/backend`
   * accepts a valid token minted for *any* party on the same Clerk instance,
   * which matters the moment that instance is shared across more than one
   * app or environment. Optional rather than required so an otherwise-valid
   * single-app Clerk setup isn't forced to configure it before this ships.
   */
  authorizedParties?: string[];
  verifyTokenFn?: VerifyTokenFn;
}

/**
 * Wraps `@clerk/backend`'s `verifyToken` into the `verifySessionToken` shape
 * `clerkAuthPort.ts` already expects and already has full test coverage for.
 * This file owns only the translation between Clerk's own result shape and
 * that shape — `clerkAuthPort.ts` itself is untouched.
 */
export function createClerkSessionVerifier(
  options: ClerkSessionVerifierOptions
): (token: string) => Promise<VerifiedClerkSession | null> {
  const verify = options.verifyTokenFn ?? verifyToken;
  const secretKey = options.secretKey;
  const authorizedParties = options.authorizedParties;

  return async function verifySessionToken(token: string): Promise<VerifiedClerkSession | null> {
    const result = await verify(token, { secretKey, authorizedParties });
    if (!result?.['data']) {
      return null;
    }

    const payload = result['data'] as Record<string, unknown>;
    const userId = payload['sub'];
    if (typeof userId !== 'string' || !userId) {
      return null;
    }

    // Default Clerk session tokens carry only `sub` (the user id). An `email`
    // claim only appears when a deployment has customized its session token
    // to include one - read it if present, omit it otherwise rather than
    // guessing.
    const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;

    return { userId, email };
  };
}
