// Created: 2026-06-08 07:25 EDT

import type { AuthPort } from './authPort';
import { AuthError, createDenyByDefaultAuthPort } from './authPort';
import { createClerkAuthPort, type ClerkAuthPortOptions } from './clerkAuthPort';
import { createClerkSessionVerifierFromEnv } from './clerkSessionVerifier';

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

// This is what closes the loop `clerkAuthPort.ts` was built to serve: the
// only production call site of `createConfiguredAuthPort`, and the one place
// a `clerk` verifier can reach it. Before this line existed, `options.clerk`
// was `undefined` here no matter what `STORY_LAB_AUTH_PROVIDER` said, so the
// "Clerk provider" was unreachable in every deployment — see
// `createClerkSessionVerifierFromEnv` for why an unset `CLERK_SECRET_KEY`
// still resolves to that same unreachable state rather than a crash.
export const configuredAuthPort = createConfiguredAuthPort({
  env: process.env,
  clerk: { verifySessionToken: createClerkSessionVerifierFromEnv(process.env) }
});
