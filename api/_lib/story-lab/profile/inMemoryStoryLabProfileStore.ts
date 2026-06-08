// Created: 2026-06-08 08:10 EDT

import type { AuthUser } from '../auth/authPort';
import type { StoryLabUserProfile } from '../contracts';
import {
  cloneStoredStoryLabProfileRecord,
  createStoredStoryLabProfileRecord,
  createStoryLabProfileStoreError,
  errorResult,
  profileBelongsToUser,
  StoryLabProfileStore,
  StoryLabProfileStoreResult,
  StoredStoryLabProfileRecord,
  successResult
} from './storyLabProfileStore';

export interface NonDurableInMemoryStoryLabProfileStoreOptions {
  now?: () => string;
}

export function createNonDurableInMemoryStoryLabProfileStore(
  options: NonDurableInMemoryStoryLabProfileStoreOptions = {}
): StoryLabProfileStore {
  return new NonDurableInMemoryStoryLabProfileStore(options.now ?? (() => new Date().toISOString()));
}

class NonDurableInMemoryStoryLabProfileStore implements StoryLabProfileStore {
  readonly mode = 'non_durable_memory';
  readonly durable = false;

  private readonly records = new Map<string, StoredStoryLabProfileRecord>();

  constructor(private readonly now: () => string) {}

  isConfigured(): boolean {
    return true;
  }

  async saveProfile(
    user: AuthUser,
    profile: StoryLabUserProfile
  ): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord>> {
    if (!profileBelongsToUser(user, profile)) {
      return errorResult(this.forbiddenError());
    }

    const existing = this.records.get(user.userId);
    const record = createStoredStoryLabProfileRecord({
      user,
      profile,
      storageMode: this.mode,
      now: this.now(),
      existingCreatedAt: existing?.createdAt
    });

    this.records.set(record.userId, cloneStoredStoryLabProfileRecord(record));
    return successResult(cloneStoredStoryLabProfileRecord(record));
  }

  async loadProfile(user: AuthUser): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord | null>> {
    const record = this.records.get(user.userId);
    if (!record) {
      return successResult(null);
    }

    return successResult(cloneStoredStoryLabProfileRecord(record));
  }

  private forbiddenError() {
    return createStoryLabProfileStoreError(
      'STORY_LAB_PROFILE_FORBIDDEN',
      'You do not have access to this Story Lab profile.',
      403
    );
  }
}
