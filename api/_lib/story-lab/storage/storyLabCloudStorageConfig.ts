// Created: 2026-06-08 10:50 EDT
//
// Mirrors `../jobs/storyLabJobStoreConfig.ts` and `../../middleware/rateLimitStoreConfig.ts`:
// an env-driven switch between a non-durable default and a Postgres-backed
// store, sharing the same env-resolution dance via `durableStoreEnvResolution.ts`.
// Unlike those two siblings, this store's *only* prior implementation was
// Postgres (implicitly selected whenever `DATABASE_URL` was set, with no way
// to opt out), so the default mode here is `postgres` rather than
// `non_durable_memory` — flipping it would have silently downgraded any
// deployment that already relies on `DATABASE_URL` to ephemeral, per-instance
// storage the moment this shipped. `STORY_LAB_CLOUD_STORAGE=non_durable_memory`
// opts a deployment into the non-durable stores explicitly instead, the same
// way `RATE_LIMIT_STORE=postgres` opts into durability on the other two.

import type { StoryLabProfileStore } from '../profile/storyLabProfileStore';
import {
  createPostgresStoryLabProfileStore,
  type PostgresProfileQueryExecutor
} from '../profile/postgresStoryLabProfileStore';
import { createNonDurableInMemoryStoryLabProfileStore } from '../profile/inMemoryStoryLabProfileStore';
import {
  createPostgresStoryProjectStore,
  type PostgresQueryExecutor
} from './postgresStoryProjectStore';
import { createNonDurableInMemoryStoryProjectStore } from './inMemoryStoryProjectStore';
import { createNeonStoryLabQueryExecutor } from './neonStoryLabExecutor';
import type { StoryProjectStore } from './storyProjectStore';
import {
  normalizeDurableStoreMode,
  resolveDurableStoreDatabaseUrl,
  resolveDurableStoreExecutor,
  resolveDurableStoreMode
} from './durableStoreEnvResolution';

const STORY_LAB_CLOUD_STORAGE_ENV_VAR = 'STORY_LAB_CLOUD_STORAGE';
const DEFAULT_STORY_LAB_CLOUD_STORAGE_MODE = 'postgres';

export interface StoryLabCloudQueryExecutor extends PostgresProfileQueryExecutor, PostgresQueryExecutor {}

export type StoryLabCloudStorageConfigMode = 'postgres' | 'non_durable_memory' | 'unsupported';
export type StoryLabCloudStorageConfigErrorCode = 'STORY_LAB_CLOUD_STORAGE_UNSUPPORTED_MODE';

export interface StoryLabCloudStorageConfigOptions {
  cloudStorageMode?: string;
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  executor?: StoryLabCloudQueryExecutor;
  createExecutor?: (databaseUrl: string) => StoryLabCloudQueryExecutor;
  nonDurableProfileStore?: StoryLabProfileStore;
  nonDurableProjectStore?: StoryProjectStore;
  now?: () => string;
}

export interface StoryLabCloudStorageConfig {
  requestedMode: string;
  mode: StoryLabCloudStorageConfigMode;
  databaseUrlConfigured: boolean;
  executorConfigured: boolean;
  profileStore: StoryLabProfileStore;
  projectStore: StoryProjectStore;
  errorCode?: StoryLabCloudStorageConfigErrorCode;
  isConfigured(): boolean;
}

export function createStoryLabCloudStorage(
  options: StoryLabCloudStorageConfigOptions = {}
): StoryLabCloudStorageConfig {
  const requestedMode = resolveDurableStoreMode(
    STORY_LAB_CLOUD_STORAGE_ENV_VAR,
    DEFAULT_STORY_LAB_CLOUD_STORAGE_MODE,
    { modeOverride: options.cloudStorageMode, env: options.env }
  );
  const normalizedMode = normalizeDurableStoreMode(requestedMode);

  if (normalizedMode === 'non_durable_memory' || normalizedMode === 'memory') {
    const profileStore = options.nonDurableProfileStore ?? createNonDurableInMemoryStoryLabProfileStore({ now: options.now });
    const projectStore = options.nonDurableProjectStore ?? createNonDurableInMemoryStoryProjectStore({ now: options.now });
    return {
      requestedMode,
      mode: 'non_durable_memory',
      databaseUrlConfigured: false,
      executorConfigured: false,
      profileStore,
      projectStore,
      isConfigured() {
        return profileStore.isConfigured() && projectStore.isConfigured();
      }
    };
  }

  if (normalizedMode === 'postgres') {
    const databaseUrl = resolveDurableStoreDatabaseUrl(options);
    const executor = databaseUrl
      ? resolveDurableStoreExecutor(databaseUrl, options.executor, options.createExecutor, createNeonStoryLabQueryExecutor)
      : undefined;
    const profileStore = createPostgresStoryLabProfileStore({ databaseUrl, executor, now: options.now });
    const projectStore = createPostgresStoryProjectStore({ databaseUrl, executor, now: options.now });

    return {
      requestedMode,
      mode: 'postgres',
      databaseUrlConfigured: Boolean(databaseUrl),
      executorConfigured: Boolean(executor),
      profileStore,
      projectStore,
      isConfigured() {
        return Boolean(databaseUrl && executor && profileStore.isConfigured() && projectStore.isConfigured());
      }
    };
  }

  // An unrecognized mode value (a typo'd env var) fails closed the same way an
  // unreachable `postgres` deployment already does — no executor, no
  // database URL — rather than introducing a third kind of store to fail
  // through. `/api/health` surfaces this distinctly via `errorCode`.
  const profileStore = createPostgresStoryLabProfileStore({ databaseUrl: '', now: options.now });
  const projectStore = createPostgresStoryProjectStore({ databaseUrl: '', now: options.now });
  return {
    requestedMode,
    mode: 'unsupported',
    databaseUrlConfigured: Boolean(resolveDurableStoreDatabaseUrl(options)),
    executorConfigured: false,
    profileStore,
    projectStore,
    errorCode: 'STORY_LAB_CLOUD_STORAGE_UNSUPPORTED_MODE',
    isConfigured() {
      return false;
    }
  };
}
