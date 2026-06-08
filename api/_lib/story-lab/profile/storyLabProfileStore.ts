// Created: 2026-06-08 08:10 EDT

import type { AuthUser } from '../auth/authPort';
import type {
  CreatureArchetype,
  HeatContract,
  NarrativeTone,
  StoryLabLibrarySort,
  StoryLabProfilePreferences,
  StoryLabUserProfile
} from '../contracts';
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

const VALID_CREATURES = new Set<string>([
  'vampire',
  'werewolf',
  'fairy',
  'siren',
  'djinn',
  'witch',
  'dragon',
  'demon',
  'angel',
  'mermaid'
]);
const VALID_TONES = new Set<string>(['romance', 'dark_romance', 'mystery', 'adventure', 'comedy', 'tragedy']);
const VALID_TENSION_MODES = new Set<string>([
  'slow_burn',
  'dangerous_proximity',
  'playful_banter',
  'devotional_longing'
]);
const VALID_INTIMACY_BOUNDARIES = new Set<string>(['fade_to_black', 'closed_door', 'literary_on_page']);
const VALID_LIBRARY_SORTS = new Set<string>(['updated_desc', 'created_desc', 'title_asc']);

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
  preferences?: (Partial<StoryLabProfilePreferences> & {
    defaultHeatContract?: Partial<HeatContract>;
  }) | null
): StoryLabProfilePreferences {
  const defaults = createDefaultStoryLabProfilePreferences();
  const overrides: Record<string, unknown> = isRecord(preferences) ? preferences : {};
  const heatOverrides: Record<string, unknown> = isRecord(overrides.defaultHeatContract)
    ? overrides.defaultHeatContract
    : {};

  return {
    defaultHeatContract: {
      adultOnlyConfirmed: readBoolean(heatOverrides.adultOnlyConfirmed, defaults.defaultHeatContract.adultOnlyConfirmed),
      tensionMode: readAllowedString<HeatContract['tensionMode']>(
        heatOverrides.tensionMode,
        VALID_TENSION_MODES,
        defaults.defaultHeatContract.tensionMode
      ),
      intimacyBoundary: readAllowedString<HeatContract['intimacyBoundary']>(
        heatOverrides.intimacyBoundary,
        VALID_INTIMACY_BOUNDARIES,
        defaults.defaultHeatContract.intimacyBoundary
      ),
      noGoContent: readOptionalString(heatOverrides.noGoContent, defaults.defaultHeatContract.noGoContent)
    },
    favoriteCreatures: readAllowedStringArray<CreatureArchetype>(
      overrides.favoriteCreatures,
      VALID_CREATURES,
      defaults.favoriteCreatures
    ),
    favoriteTones: readAllowedStringArray<NarrativeTone>(overrides.favoriteTones, VALID_TONES, defaults.favoriteTones),
    contentBoundaries: readOptionalString(overrides.contentBoundaries, defaults.contentBoundaries),
    librarySort: readAllowedString<StoryLabLibrarySort>(overrides.librarySort, VALID_LIBRARY_SORTS, defaults.librarySort)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readOptionalString(value: unknown, fallback?: string): string | undefined {
  return typeof value === 'string' ? value : fallback;
}

function readAllowedString<T extends string>(value: unknown, allowedValues: ReadonlySet<string>, fallback: T): T {
  return typeof value === 'string' && allowedValues.has(value) ? (value as T) : fallback;
}

function readAllowedStringArray<T extends string>(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  fallback: readonly T[]
): T[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value.filter((entry): entry is T => typeof entry === 'string' && allowedValues.has(entry));
}
