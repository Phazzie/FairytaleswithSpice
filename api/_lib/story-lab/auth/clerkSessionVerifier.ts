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
 * This deployment's own URL(s), as Vercel's platform itself injects them into
 * the runtime environment — never as a request header.
 *
 * `X-Forwarded-Host`/`Host` (what `corsPolicy.ts`'s `getRequestTargetOrigin`
 * reads, safely, for CORS) is not a candidate source here even though it
 * solves the same "Vercel preview URL isn't in `STORY_LAB_ALLOWED_ORIGINS`"
 * problem: CORS only constrains a *browser*, so widening the response header
 * for a non-browser caller who forged that header grants nothing they didn't
 * already have. `authorizedParties` is not a CORS response header — it is
 * the actual boundary that decides which origins a session token may claim
 * to come from — so trusting a caller-supplied header there would let anyone
 * holding a valid token from an untrusted sibling origin simply set
 * `X-Forwarded-Host` to that origin and pass. `VERCEL_URL`/`VERCEL_BRANCH_URL`
 * are set by the platform on the deployment's own environment, not from
 * anything in the request, so a caller cannot influence them.
 */
function resolvePlatformOrigins(env: Record<string, string | undefined>): string[] {
  return [env['VERCEL_URL'], env['VERCEL_BRANCH_URL']]
    .map(host => host?.trim())
    .filter((host): host is string => Boolean(host))
    .map(host => `https://${host}`);
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
  // The configured frontend origin(s) `applyCorsPolicy` also trusts, plus
  // this deployment's own platform-assigned URL(s) — passed as Clerk's
  // `authorizedParties` so a token whose `azp` claim names a different
  // origin (e.g. an untrusted sibling subdomain that can also obtain a
  // Clerk session under the same instance) is rejected rather than accepted
  // on signature validity alone. Computed once, from trusted sources only —
  // see `resolvePlatformOrigins` for why a request header is not one of them.
  const authorizedParties = Array.from(
    new Set([...parseAllowedOrigins(env), ...resolvePlatformOrigins(env)])
  );

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
