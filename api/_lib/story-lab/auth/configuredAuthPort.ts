// Created: 2026-06-08 07:25 EDT

import type { AuthPort } from './authPort';
import { AuthError, createDenyByDefaultAuthPort } from './authPort';
import { createClerkAuthPort, type ClerkAuthPortOptions } from './clerkAuthPort';

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
  const providerName = rawProviderName?.trim().toLowerCase();
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

export const configuredAuthPort = createConfiguredAuthPort({ env: process.env });
