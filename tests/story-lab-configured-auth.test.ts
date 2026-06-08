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

main().catch(error => {
  console.error(error);
  process.exit(1);
});
