// Created: 2026-09-02 20:40 EDT

import { verifyToken as clerkVerifyToken } from '@clerk/backend';
import { getRequestTargetOrigin, parseAllowedOrigins } from '../../http/corsPolicy';
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
  // The same static allowlist `applyCorsPolicy` trusts as this deployment's
  // configured frontend origin(s) — passed as Clerk's `authorizedParties` so
  // a token whose `azp` claim names a different origin (e.g. an untrusted
  // sibling subdomain that can also obtain a Clerk session under the same
  // instance) is rejected rather than accepted on signature validity alone.
  const staticAuthorizedParties = parseAllowedOrigins(env);

  return async function verifySessionToken(
    token: string,
    req: AuthRequestLike
  ): Promise<VerifiedClerkSession | null> {
    // `resolveAllowedOrigin` in corsPolicy.ts trusts a same-origin request
    // (the frontend and API served from one dynamic host, e.g. a Vercel
    // preview URL never listed in `STORY_LAB_ALLOWED_ORIGINS`) via
    // `getRequestTargetOrigin`, not just the static list — a token issued by
    // that same dynamic origin has to clear the same bar here, or every
    // deployment whose origin isn't hardcoded into an env var would 401 its
    // own legitimately signed-in users.
    const requestTargetOrigin = getRequestTargetOrigin(req);
    const authorizedParties = requestTargetOrigin && !staticAuthorizedParties.includes(requestTargetOrigin)
      ? [...staticAuthorizedParties, requestTargetOrigin]
      : staticAuthorizedParties;

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
