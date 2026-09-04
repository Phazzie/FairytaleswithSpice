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
