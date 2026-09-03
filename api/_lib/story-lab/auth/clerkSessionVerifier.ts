// Created: 2026-09-02 20:40 EDT

import { verifyToken as clerkVerifyToken } from '@clerk/backend';
import { parseAllowedOrigins } from '../../http/corsPolicy';
import type { AuthRequestLike } from './authPort';
import type { ClerkAuthPortOptions, VerifiedClerkSession } from './clerkAuthPort';

/**
 * The shape `@clerk/backend`'s `verifyToken` actually has: it does not throw
 * on an invalid or expired token, it resolves to `{ errors: [...] }`. A
 * verifier built on the assumption that a bad token throws would read
 * `data.sub` off that shape and either crash or, worse, treat `undefined` as
 * a signed-in user. Only this much of the real function's shape is pinned
 * here so a test can inject a fake with the same contract without pulling in
 * the SDK.
 */
export type ClerkVerifyTokenFn = (
  token: string,
  options: { secretKey: string; authorizedParties?: string[] }
) => Promise<{ data?: { sub: string; [claim: string]: unknown }; errors?: unknown[] }>;

export interface ClerkSessionVerifierDependencies {
  verifyToken?: ClerkVerifyTokenFn;
}

/**
 * Builds the real `verifySessionToken` `configuredAuthPort` needs, or `undefined`
 * when `CLERK_SECRET_KEY` is not set.
 *
 * `undefined` is the load-bearing case, not a leftover branch: it is what
 * makes `createClerkAuthPort`'s existing "not configured" fail-closed path
 * (`clerkAuthPort.ts:37-39`) the behavior for every deployment that has not
 * set the key, which is every deployment today. Adding this file changes
 * nothing for those until the key is set.
 */
export function createClerkSessionVerifierFromEnv(
  env: Record<string, string | undefined>,
  dependencies: ClerkSessionVerifierDependencies = {}
): ClerkAuthPortOptions['verifySessionToken'] | undefined {
  const secretKey = env['CLERK_SECRET_KEY']?.trim();
  if (!secretKey) {
    return undefined;
  }

  const verifyToken = dependencies.verifyToken ?? (clerkVerifyToken as ClerkVerifyTokenFn);
  // The same allowlist `applyCorsPolicy` already trusts as this deployment's
  // frontend origin(s) — passed as Clerk's `authorizedParties` so a token
  // whose `azp` claim names a different origin (e.g. an untrusted sibling
  // subdomain that can also obtain a Clerk session under the same instance)
  // is rejected rather than accepted on signature validity alone.
  const authorizedParties = parseAllowedOrigins(env);

  return async function verifySessionToken(
    token: string,
    _req: AuthRequestLike
  ): Promise<VerifiedClerkSession | null> {
    const result = await verifyToken(token, { secretKey, authorizedParties });
    if (result.errors || !result.data?.sub) {
      return null;
    }

    // A session token only carries `email` when the deployment's Clerk
    // instance is configured to add it as a custom claim; `clerkAuthPort`'s
    // `AuthUser.email` is already optional for exactly this reason, so an
    // absent claim is a normal case, not a fallback.
    const email = typeof result.data['email'] === 'string' ? result.data['email'] : undefined;

    return {
      userId: result.data.sub,
      email
    };
  };
}
