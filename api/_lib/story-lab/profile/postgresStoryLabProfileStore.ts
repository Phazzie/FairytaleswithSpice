// Created: 2026-06-08 08:10 EDT

import type { AuthUser } from '../auth/authPort';
import type { StoryLabProfilePreferences, StoryLabUserProfile } from '../contracts';
import {
  createStoredStoryLabProfileRecord,
  createStoryLabProfileStoreError,
  errorResult,
  normalizeStoryLabProfilePreferences,
  normalizeStoryLabUserProfile,
  profileBelongsToUser,
  StoryLabProfileStore,
  StoryLabProfileStoreError,
  StoryLabProfileStoreResult,
  StoredStoryLabProfileRecord,
  successResult
} from './storyLabProfileStore';

export interface PostgresProfileQueryExecutor {
  query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}

export interface PostgresStoryLabProfileStoreOptions {
  databaseUrl?: string;
  executor?: PostgresProfileQueryExecutor;
  now?: () => string;
}

interface StoryLabProfileRow {
  user_id: string;
  display_name: string | null;
  preferences_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

const SAVE_PROFILE_SQL = `
insert into story_lab_profiles (
  user_id,
  display_name,
  preferences_json,
  created_at,
  updated_at
) values ($1, $2, $3::jsonb, $4, $5)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  preferences_json = excluded.preferences_json,
  updated_at = excluded.updated_at
where story_lab_profiles.user_id = excluded.user_id
returning user_id, display_name, preferences_json, created_at, updated_at
`;

const LOAD_PROFILE_SQL = `
select user_id, display_name, preferences_json, created_at, updated_at
from story_lab_profiles
where user_id = $1
limit 1
`;

export function createPostgresStoryLabProfileStore(
  options: PostgresStoryLabProfileStoreOptions = {}
): StoryLabProfileStore {
  return new PostgresStoryLabProfileStore(options);
}

class PostgresStoryLabProfileStore implements StoryLabProfileStore {
  readonly mode = 'postgres';
  readonly durable = true;

  constructor(private readonly options: PostgresStoryLabProfileStoreOptions) {}

  isConfigured(): boolean {
    return Boolean(this.getDatabaseUrl() && this.options.executor);
  }

  async saveProfile(
    user: AuthUser,
    profile: StoryLabUserProfile
  ): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    if (!profileBelongsToUser(user, profile)) {
      return errorResult(this.forbiddenError());
    }

    const record = createStoredStoryLabProfileRecord({
      user,
      profile,
      storageMode: this.mode,
      now: this.getNow()
    });

    try {
      const result = await this.executor().query<StoryLabProfileRow>(SAVE_PROFILE_SQL, [
        record.userId,
        record.profile.displayName,
        JSON.stringify(record.profile.preferences),
        record.createdAt,
        record.updatedAt
      ]);

      const row = result.rows[0];
      if (!row) {
        return errorResult(this.forbiddenError());
      }

      return successResult(recordFromRow(row));
    } catch {
      return errorResult(this.storageError());
    }
  }

  async loadProfile(user: AuthUser): Promise<StoryLabProfileStoreResult<StoredStoryLabProfileRecord | null>> {
    const readyError = this.getReadinessError();
    if (readyError) {
      return errorResult(readyError);
    }

    try {
      const result = await this.executor().query<StoryLabProfileRow>(LOAD_PROFILE_SQL, [user.userId]);
      const row = result.rows[0];
      if (!row) {
        return successResult(null);
      }

      return successResult(recordFromRow(row));
    } catch {
      return errorResult(this.storageError());
    }
  }

  private getReadinessError(): StoryLabProfileStoreError | null {
    if (!this.getDatabaseUrl()) {
      return createStoryLabProfileStoreError(
        'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED',
        'Story Lab profile storage is not configured.',
        503,
        true
      );
    }

    if (!this.options.executor) {
      return createStoryLabProfileStoreError(
        'STORY_LAB_PROFILE_STORAGE_DRIVER_MISSING',
        'Story Lab profile storage driver is not configured.',
        503,
        true
      );
    }

    return null;
  }

  private getDatabaseUrl(): string {
    return this.options.databaseUrl ?? process.env['DATABASE_URL'] ?? '';
  }

  private getNow(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private executor(): PostgresProfileQueryExecutor {
    const executor = this.options.executor;
    if (!executor) {
      throw new Error('Postgres profile executor missing after readiness check.');
    }
    return executor;
  }

  private storageError(): StoryLabProfileStoreError {
    return createStoryLabProfileStoreError(
      'STORY_LAB_PROFILE_STORAGE_ERROR',
      'Story Lab profile storage failed.',
      500,
      true
    );
  }

  private forbiddenError(): StoryLabProfileStoreError {
    return createStoryLabProfileStoreError(
      'STORY_LAB_PROFILE_FORBIDDEN',
      'You do not have access to this Story Lab profile.',
      403
    );
  }
}

function recordFromRow(row: StoryLabProfileRow): StoredStoryLabProfileRecord {
  const createdAt = toIsoString(row.created_at);
  const updatedAt = toIsoString(row.updated_at);
  const user: AuthUser = {
    userId: row.user_id
  };
  const profile: StoryLabUserProfile = normalizeStoryLabUserProfile(
    user,
    {
      userId: row.user_id,
      displayName: row.display_name || 'Story Lab Writer',
      preferences: preferencesFromJson(row.preferences_json),
      createdAt,
      updatedAt
    },
    updatedAt,
    createdAt
  );

  return {
    userId: row.user_id,
    profile,
    createdAt,
    updatedAt,
    storageMode: 'postgres'
  };
}

function preferencesFromJson(value: unknown): StoryLabProfilePreferences {
  try {
    if (value === null || value === undefined) {
      throw new Error('Stored Story Lab profile preferences are empty.');
    }

    if (typeof value === 'string') {
      return normalizeStoryLabProfilePreferences(JSON.parse(value) as StoryLabProfilePreferences);
    }

    return normalizeStoryLabProfilePreferences(value as StoryLabProfilePreferences);
  } catch {
    throw new Error('Stored Story Lab profile preferences are invalid.');
  }
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
