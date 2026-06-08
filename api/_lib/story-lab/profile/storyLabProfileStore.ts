// Created: 2026-06-08 08:10 EDT

import type { AuthUser } from '../auth/authPort';
import type { HeatContract, StoryLabProfilePreferences, StoryLabUserProfile } from '../contracts';
import { createDefaultStoryLabProfilePreferences } from './profileDefaults';

export type StoryLabProfileStorageMode = 'non_durable_memory' | 'postgres';

export type StoryLabProfileStoreErrorCode =
  | 'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED'
  | 'STORY_LAB_PROFILE_STORAGE_DRIVER_MISSING'
  | 'STORY_LAB_PROFILE_NOT_FOUND'
  | 'STORY_LAB_PROFILE_FORBIDDEN'
  | 'STORY_LAB_PROFILE_STORAGE_ERROR';

export type StoryLabProfileStoreResult<T> =
  | { success: true; data: T }
  | { success: false; error: StoryLabProfileStoreError };

export interface StoryLabProfileStoreError {
  code: StoryLabProfileStoreErrorCode;
  message: string;
  statusCode: number;
  retryable: boolean;
}

export interface StoredStoryLabProfileRecord {
  userId: string;
  profile: StoryLabUserProfile;
  createdAt: string;
  updatedAt: string;
  storageMode: StoryLabProfileStorageMode;
}

export interface StoryLabProfileStore {
  readonly mode: StoryLabProfileStorageMode;
  readonly durable: boolean;
  isConfigured(): boolean;
  saveProfile(
    user: AuthUser,
    profile: StoryLabUserProfile
  ): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord>>;
  loadProfile(user: AuthUser): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord | null>>;
}

export interface CreateDefaultStoryLabUserProfileOptions {
  displayName?: string;
  preferences?: Partial<StoryLabProfilePreferences> & {
    defaultHeatContract?: Partial<HeatContract>;
  };
  now?: string;
}

export interface CreateStoredStoryLabProfileRecordInput {
  user: AuthUser;
  profile: StoryLabUserProfile;
  storageMode: StoryLabProfileStorageMode;
  now?: string;
  existingCreatedAt?: string;
}

export function createDefaultStoryLabUserProfile(
  user: AuthUser,
  options: CreateDefaultStoryLabUserProfileOptions = {}
): StoryLabUserProfile {
  const now = options.now ?? new Date().toISOString();

  return {
    userId: user.userId,
    displayName: options.displayName ?? 'Story Lab Writer',
    preferences: normalizeStoryLabProfilePreferences(options.preferences),
    createdAt: now,
    updatedAt: now
  };
}

export function createStoredStoryLabProfileRecord(
  input: CreateStoredStoryLabProfileRecordInput
): StoredStoryLabProfileRecord {
  const now = input.now ?? new Date().toISOString();
  const profile = normalizeStoryLabUserProfile(input.user, input.profile, now, input.existingCreatedAt);

  return {
    userId: profile.userId,
    profile,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    storageMode: input.storageMode
  };
}

export function normalizeStoryLabUserProfile(
  user: AuthUser,
  profile: StoryLabUserProfile,
  now: string,
  existingCreatedAt?: string
): StoryLabUserProfile {
  const clonedProfile = cloneStoryLabUserProfile(profile);

  return {
    ...clonedProfile,
    userId: user.userId,
    displayName: clonedProfile.displayName || 'Story Lab Writer',
    preferences: normalizeStoryLabProfilePreferences(clonedProfile.preferences),
    createdAt: existingCreatedAt ?? clonedProfile.createdAt ?? now,
    updatedAt: now
  };
}

export function normalizeStoryLabProfilePreferences(
  preferences?: Partial<StoryLabProfilePreferences> & {
    defaultHeatContract?: Partial<HeatContract>;
  }
): StoryLabProfilePreferences {
  const defaults = createDefaultStoryLabProfilePreferences();
  const overrides = preferences ? structuredClone(preferences) : {};

  return {
    defaultHeatContract: {
      ...defaults.defaultHeatContract,
      ...overrides.defaultHeatContract
    },
    favoriteCreatures: overrides.favoriteCreatures ?? defaults.favoriteCreatures,
    favoriteTones: overrides.favoriteTones ?? defaults.favoriteTones,
    contentBoundaries: overrides.contentBoundaries,
    librarySort: overrides.librarySort ?? defaults.librarySort
  };
}

export function profileBelongsToUser(user: AuthUser, profile: StoryLabUserProfile): boolean {
  return profile.userId === user.userId;
}

export function cloneStoryLabUserProfile(profile: StoryLabUserProfile): StoryLabUserProfile {
  return structuredClone(profile);
}

export function cloneStoredStoryLabProfileRecord(record: StoredStoryLabProfileRecord): StoredStoryLabProfileRecord {
  return {
    ...record,
    profile: cloneStoryLabUserProfile(record.profile)
  };
}

export function createStoryLabProfileStoreError(
  code: StoryLabProfileStoreErrorCode,
  message: string,
  statusCode: number,
  retryable = false
): StoryLabProfileStoreError {
  return {
    code,
    message,
    statusCode,
    retryable
  };
}

export function successResult<T>(data: T): StoryLabProfileStoreResult<T> {
  return {
    success: true,
    data
  };
}

export function errorResult<T>(error: StoryLabProfileStoreError): StoryLabProfileStoreResult<T> {
  return {
    success: false,
    error
  };
}
