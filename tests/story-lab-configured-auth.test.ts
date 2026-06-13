#!/usr/bin/env tsx
// Created: 2026-06-08 07:22 EDT

import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { isAuthError } from '../api/_lib/story-lab/auth/authPort';
import { createConfiguredAuthPort } from '../api/_lib/story-lab/auth/configuredAuthPort';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testConfiguredAuthFailsClosedWithoutProvider();
  await testConfiguredAuthDelegatesToInjectedProvider();
  await testConfiguredAuthSelectsClerkProviderWhenConfigured();
  await testConfiguredAuthFailsClosedForUnknownProvider();
  await testConfiguredAuthIgnoresMalformedRuntimeProviderName();

  console.log('Story Lab configured auth tests passed');
}

async function testConfiguredAuthFailsClosedWithoutProvider() {
  const auth = createConfiguredAuthPort();
  const user = await auth.getCurrentUser({
    headers: {
      authorization: 'Bearer provider-token-without-config'
    }
  });
  assert(user === null, 'configured auth without provider should not create a user from raw headers');

  try {
    await auth.requireUser({ headers: { authorization: 'Bearer provider-token-without-config' } });
    throw new Error('configured auth without provider should require account auth');
  } catch (error) {
    assert(isAuthError(error), 'configured auth without provider should throw AuthError');
    assert(error.message.includes('not configured'), 'missing provider error should be honest');
  }
}

async function testConfiguredAuthDelegatesToInjectedProvider() {
  const expectedUser: AuthUser = {
    userId: 'user-owner',
    email: 'owner@example.com'
  };
  const provider: AuthPort = {
    async getCurrentUser() {
      return expectedUser;
    },
    async requireUser() {
      return expectedUser;
    }
  };
  const auth = createConfiguredAuthPort({ provider });

  const currentUser = await auth.getCurrentUser({});
  assert(currentUser?.userId === expectedUser.userId, 'configured auth should delegate getCurrentUser to provider');

  const requiredUser = await auth.requireUser({});
  assert(requiredUser.userId === expectedUser.userId, 'configured auth should delegate requireUser to provider');
}

async function testConfiguredAuthSelectsClerkProviderWhenConfigured() {
  const seenTokens: string[] = [];
  const auth = createConfiguredAuthPort({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'clerk'
    },
    clerk: {
      verifySessionToken: async token => {
        seenTokens.push(token);
        return {
          userId: 'user_selected_clerk',
          email: 'selected@example.com'
        };
      }
    }
  });

  const user = await auth.requireUser({
    headers: {
      authorization: 'Bearer selected-clerk-token'
    }
  });

  assert(seenTokens[0] === 'selected-clerk-token', 'configured auth should pass bearer tokens to the selected Clerk adapter');
  assert(user.userId === 'user_selected_clerk', 'configured auth should return Clerk-verified users when Clerk is explicitly selected');
}

async function testConfiguredAuthFailsClosedForUnknownProvider() {
  const auth = createConfiguredAuthPort({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'mystery-provider'
    }
  });

  const currentUser = await auth.getCurrentUser({
    headers: {
      authorization: 'Bearer unknown-provider-token'
    }
  });
  assert(currentUser === null, 'unknown auth providers should not create users from raw headers');

  try {
    await auth.requireUser({
      headers: {
        authorization: 'Bearer unknown-provider-token'
      }
    });
    throw new Error('unknown auth providers should require configured account auth');
  } catch (error) {
    assert(isAuthError(error), 'unknown auth provider should throw AuthError');
    assert(error.message.includes('Unsupported Story Lab auth provider'), 'unknown auth provider should be explicit');
    assert(!error.message.includes('unknown-provider-token'), 'unknown auth provider error should not leak bearer tokens');
  }
}

async function testConfiguredAuthIgnoresMalformedRuntimeProviderName() {
  const auth = createConfiguredAuthPort({
    providerName: 42 as any
  });

  const currentUser = await auth.getCurrentUser({
    headers: {
      authorization: 'Bearer malformed-provider-token'
    }
  });
  assert(currentUser === null, 'non-string auth provider names should fail closed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
