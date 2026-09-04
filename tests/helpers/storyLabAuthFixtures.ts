// Created: 2026-09-04 00:00 UTC

import type { AuthPort, AuthUser } from '../../api/_lib/story-lab/auth/authPort';
import { AuthError } from '../../api/_lib/story-lab/auth/authPort';
import type { StoryLabUserProfile } from '../../api/_lib/story-lab/contracts';
import type { StoryLabProfileStore } from '../../api/_lib/story-lab/profile/storyLabProfileStore';

/**
 * An auth port that always resolves to the given user, for tests that need a
 * signed-in caller without exercising a real provider.
 */
export function createStaticAuthPort(user: AuthUser): AuthPort {
  return {
    async getCurrentUser() {
      return user;
    },
    async requireUser() {
      return user;
    }
  };
}

/**
 * An auth port with no signed-in caller: `getCurrentUser` resolves to `null`,
 * the shape every unauthenticated request already produces, and `requireUser`
 * throws the way a route that gates on auth expects.
 */
export function createRejectingAuthPort(): AuthPort {
  return {
    async getCurrentUser() {
      return null;
    },
    async requireUser() {
      throw new AuthError('Account authentication is required.');
    }
  };
}

/**
 * A profile store backed by a single fixed profile (or none), for tests that
 * need `loadProfile` to answer deterministically without a real store.
 */
export function createStubProfileStore(profile: StoryLabUserProfile | null): StoryLabProfileStore {
  return {
    mode: 'non_durable_memory',
    durable: false,
    isConfigured: () => true,
    async saveProfile(user, savedProfile) {
      return {
        success: true,
        data: {
          userId: user.userId,
          profile: savedProfile,
          createdAt: savedProfile.createdAt,
          updatedAt: savedProfile.updatedAt,
          storageMode: 'non_durable_memory'
        }
      };
    },
    async loadProfile(user) {
      return {
        success: true,
        data: profile
          ? {
              userId: user.userId,
              profile,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
              storageMode: 'non_durable_memory'
            }
          : null
      };
    }
  };
}

/**
 * Asserts a continuation was refused because a signed-in caller's stored
 * content boundaries had no Heat Contract to merge into —
 * `resolveContinuationHeatContract`'s `{ ok: false }` case, surfaced
 * identically by both the direct continuation route
 * (`createStoryLabContinuationHandler`) and the job route
 * (`createStoryLabJobsRouteHandler`). Shared so the two route tests that
 * prove it don't carry two copies of the same four checks.
 */
export function assertRefusedForUnhonorableContentBoundary(
  response: { statusCode: number; body: unknown },
  engineCalled: boolean
): void {
  if (response.statusCode !== 400) {
    throw new Error(
      `a signed-in caller with stored boundaries and no request heat contract should be refused, got ${response.statusCode}`
    );
  }

  const body = response.body as { success?: boolean; error?: { code?: string } };
  if (body.success !== false) {
    throw new Error('the refusal should be an error payload');
  }
  if (body.error?.code !== 'INVALID_REQUEST') {
    throw new Error(`the refusal should be a caller error, got ${JSON.stringify(body.error)}`);
  }
  if (engineCalled) {
    throw new Error('the engine should never be called when the boundary cannot be honored');
  }
}
