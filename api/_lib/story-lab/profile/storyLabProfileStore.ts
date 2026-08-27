// Created: 2026-06-08 08:10 EDT

import type { AuthUser } from '../auth/authPort';
import {
  CREATURE_ARCHETYPES,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  NARRATIVE_TONES,
  STORY_LAB_LIBRARY_SORTS,
  type CreatureArchetype,
  type HeatContract,
  type NarrativeTone,
  type StoryLabLibrarySort,
  type StoryLabProfilePreferences,
  type StoryLabUserProfile
} from '../contracts';
import { createDefaultStoryLabProfilePreferences } from './profileDefaults';
import { STORY_LAB_PROFILE_LIMITS } from '../../../../shared/storyBlueprintLimits';

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

const VALID_CREATURES = new Set<string>(CREATURE_ARCHETYPES);
const VALID_TONES = new Set<string>(NARRATIVE_TONES);
const VALID_TENSION_MODES = new Set<string>(HEAT_TENSION_MODES);
const VALID_INTIMACY_BOUNDARIES = new Set<string>(HEAT_INTIMACY_BOUNDARIES);
const VALID_LIBRARY_SORTS = new Set<string>(STORY_LAB_LIBRARY_SORTS);

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
  return {
    userId: user.userId,
    displayName: profile.displayName || 'Story Lab Writer',
    preferences: normalizeStoryLabProfilePreferences(profile.preferences),
    createdAt: (existingCreatedAt ?? profile.createdAt) || now,
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
  const heatOverrides: Record<string, unknown> = isRecord(overrides['defaultHeatContract'])
    ? overrides['defaultHeatContract']
    : {};

  return {
    defaultHeatContract: {
      adultOnlyConfirmed: readBoolean(heatOverrides['adultOnlyConfirmed'], defaults.defaultHeatContract.adultOnlyConfirmed),
      tensionMode: readAllowedString<HeatContract['tensionMode']>(
        heatOverrides['tensionMode'],
        VALID_TENSION_MODES,
        defaults.defaultHeatContract.tensionMode
      ),
      intimacyBoundary: readAllowedString<HeatContract['intimacyBoundary']>(
        heatOverrides['intimacyBoundary'],
        VALID_INTIMACY_BOUNDARIES,
        defaults.defaultHeatContract.intimacyBoundary
      ),
      noGoContent: readOptionalString(heatOverrides['noGoContent'], defaults.defaultHeatContract.noGoContent)
    },
    favoriteCreatures: readAllowedStringArray<CreatureArchetype>(
      overrides['favoriteCreatures'],
      VALID_CREATURES,
      defaults.favoriteCreatures
    ),
    favoriteTones: readAllowedStringArray<NarrativeTone>(overrides['favoriteTones'], VALID_TONES, defaults.favoriteTones),
    contentBoundaries: readOptionalString(overrides['contentBoundaries'], defaults.contentBoundaries),
    librarySort: readAllowedString<StoryLabLibrarySort>(overrides['librarySort'], VALID_LIBRARY_SORTS, defaults.librarySort)
  };
}

/**
 * Name the first profile field whose free text is past its cap, or `null`.
 *
 * Read at the route, before the profile is handed to a store, rather than
 * inside `normalizeStoryLabProfilePreferences`. The two do different jobs and
 * only one of them may refuse: normalizing runs on every *read* as well as
 * every write — a profile that predates this cap has to keep loading, and a
 * default built from partial options has to keep being built — while this runs
 * only on `PUT`, where the caller is present and can be told which field to
 * shorten.
 *
 * Refused rather than truncated, which is the one place this route's usual
 * "replace what is not allowed with the default" reading would be wrong.
 * `noGoContent` and `contentBoundaries` say what a reader does not want
 * written; a silently shortened list of those is a shortened set of
 * constraints, and the reader would have no way to see that the end of theirs
 * had been dropped.
 *
 * One field per answer, the shape `describeOversizedThemeSeed` uses in the
 * blueprint parser: each is a separate input, and the caller fixes the one
 * named.
 */
export function describeOversizedStoryLabProfileField(profile: StoryLabUserProfile): string | null {
  const fields: ReadonlyArray<{ name: string; value: unknown; limit: number }> = [
    {
      name: 'displayName',
      value: profile.displayName,
      limit: STORY_LAB_PROFILE_LIMITS.maxDisplayNameLength
    },
    {
      name: 'preferences.contentBoundaries',
      value: profile.preferences?.contentBoundaries,
      limit: STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength
    },
    {
      name: 'preferences.defaultHeatContract.noGoContent',
      value: profile.preferences?.defaultHeatContract?.noGoContent,
      limit: STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength
    }
  ];

  for (const field of fields) {
    if (typeof field.value === 'string' && field.value.length > field.limit) {
      return `${field.name} must be ${field.limit} characters or fewer.`;
    }
  }

  return null;
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
