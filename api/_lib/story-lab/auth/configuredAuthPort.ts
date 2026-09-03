// Created: 2026-06-08 07:25 EDT

import type { AuthPort } from './authPort';
import { AuthError, createDenyByDefaultAuthPort } from './authPort';
import { createClerkAuthPort, type ClerkAuthPortOptions } from './clerkAuthPort';
import { createClerkSessionVerifier } from './clerkSessionVerifier';
import { logWarn } from '../../utils/logger';

export type StoryLabAuthProviderName = 'none' | 'clerk';

export interface ConfiguredAuthPortOptions {
  provider?: AuthPort | null;
  env?: Record<string, string | undefined>;
  providerName?: string | null;
  clerk?: ClerkAuthPortOptions;
}

export function createConfiguredAuthPort(options: ConfiguredAuthPortOptions = {}): AuthPort {
  if (options.provider) {
    return {
      getCurrentUser(req) {
        return options.provider!.getCurrentUser(req);
      },
      requireUser(req) {
        return options.provider!.requireUser(req);
      }
    };
  }

  const providerName = resolveConfiguredAuthProviderName(options);
  if (!providerName || providerName === 'none') {
    return createDenyByDefaultAuthPort();
  }
  if (providerName === 'clerk') {
    return createClerkAuthPort(options.clerk);
  }

  return createUnsupportedAuthProviderPort(providerName);
}

export function resolveConfiguredAuthProviderName(options: ConfiguredAuthPortOptions = {}): string | null {
  const rawProviderName = options.providerName ?? options.env?.['STORY_LAB_AUTH_PROVIDER'] ?? process.env['STORY_LAB_AUTH_PROVIDER'];
  if (typeof rawProviderName !== 'string') {
    return null;
  }

  const providerName = rawProviderName.trim().toLowerCase();
  if (!providerName) {
    return null;
  }
  if (providerName === 'none' || providerName === 'disabled') {
    return 'none';
  }
  if (providerName === 'clerk') {
    return 'clerk';
  }
  return providerName;
}

function createUnsupportedAuthProviderPort(providerName: string): AuthPort {
  return {
    async getCurrentUser() {
      return null;
    },
    async requireUser() {
      throw new AuthError(`Unsupported Story Lab auth provider configured: ${providerName}.`);
    }
  };
}

/**
 * The `clerk` options for the *production* singleton below, resolved from
 * real environment variables rather than injected by a caller.
 *
 * `createConfiguredAuthPort` itself stays provider-agnostic and fully
 * DI-tested (see `story-lab-configured-auth.test.ts`) - this function is the
 * one place that decides how the `clerk` provider is actually wired when
 * nobody supplies it, which until now was nowhere, leaving `requireUser()`
 * to unconditionally throw even when `STORY_LAB_AUTH_PROVIDER=clerk` was set.
 *
 * A provider selected without the secret key it needs fails fast, at import
 * time, instead of shipping a route that silently 401s every request - the
 * same fail-fast standard `XAI_API_KEY` and `DATABASE_URL` already hold
 * elsewhere in this codebase.
 */
export function resolveProductionClerkAuthPortOptions(
  env: Record<string, string | undefined> = process.env,
  deps: { verifyTokenFn?: Parameters<typeof createClerkSessionVerifier>[0]['verifyTokenFn'] } = {}
): ClerkAuthPortOptions | undefined {
  const providerName = resolveConfiguredAuthProviderName({ env });
  if (providerName !== 'clerk') {
    return undefined;
  }

  const secretKey = env['CLERK_SECRET_KEY']?.trim();
  if (!secretKey) {
    throw new Error(
      'STORY_LAB_AUTH_PROVIDER is set to "clerk" but CLERK_SECRET_KEY is missing. ' +
        'Set CLERK_SECRET_KEY (from the Clerk dashboard) or unset STORY_LAB_AUTH_PROVIDER.'
    );
  }

  const authorizedParties = resolveAuthorizedParties(env);
  if (authorizedParties.length === 0) {
    // Not fail-fast: a single-app Clerk instance works without this. But
    // left unset, a session token minted for *any* party on the same Clerk
    // instance is accepted here, which stops being safe the moment that
    // instance is shared across more than one app or environment.
    logWarn(
      'Clerk auth is configured without CLERK_AUTHORIZED_PARTIES - session tokens are accepted regardless of which app/origin minted them.',
      { endpoint: 'configuredAuthPort.resolveProductionClerkAuthPortOptions' }
    );
  }

  return {
    verifySessionToken: createClerkSessionVerifier({
      secretKey,
      authorizedParties: authorizedParties.length > 0 ? authorizedParties : undefined,
      verifyTokenFn: deps.verifyTokenFn
    })
  };
}

function resolveAuthorizedParties(env: Record<string, string | undefined>): string[] {
  const raw = env['CLERK_AUTHORIZED_PARTIES'];
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map(party => party.trim())
    .filter(party => party.length > 0);
}

export const configuredAuthPort = createConfiguredAuthPort({
  env: process.env,
  clerk: resolveProductionClerkAuthPortOptions(process.env)
});
