// Created: 2026-09-03 05:05 EDT

import { resolveConfiguredAuthProviderName } from './configuredAuthPort';

export interface AccountPortalAuthConfig {
  /** Which account-auth provider is selected, independent of whether it's usable yet. */
  provider: 'clerk' | 'none';
  /**
   * Base URL of Clerk's hosted Account Portal (e.g. `https://accounts.example.com`),
   * or `null` when the provider isn't `clerk` or the portal URL isn't configured.
   *
   * A base URL rather than a ready-made sign-in link: the caller appends
   * `/sign-in` or `/sign-out` plus a `redirect_url` pointing back to wherever
   * the caller actually is, which this (request-agnostic) resolver has no way
   * to know.
   */
  accountPortalUrl: string | null;
}

/**
 * What `/api/health` reports about account auth, and the only thing it needs
 * to report: whether a real sign-in flow exists to send a caller to. This
 * intentionally carries no session-verification concerns (`CLERK_SECRET_KEY`
 * never appears here) - a hosted Account Portal URL is not a secret, and this
 * function stays safe to call unconditionally from an unauthenticated route.
 */
export function resolveAccountPortalAuthConfig(
  env: Record<string, string | undefined> = process.env
): AccountPortalAuthConfig {
  const providerName = resolveConfiguredAuthProviderName({ env });
  if (providerName !== 'clerk') {
    return { provider: 'none', accountPortalUrl: null };
  }

  const rawPortalUrl = env['CLERK_ACCOUNT_PORTAL_URL']?.trim();
  if (!rawPortalUrl) {
    return { provider: 'clerk', accountPortalUrl: null };
  }

  return { provider: 'clerk', accountPortalUrl: rawPortalUrl.replace(/\/+$/, '') };
}
