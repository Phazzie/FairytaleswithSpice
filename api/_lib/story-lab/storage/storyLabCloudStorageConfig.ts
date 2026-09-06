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

// Shared at module scope, exactly like `sharedInMemoryRateLimitStore` in
// `rateLimitStoreConfig.ts` and the exported `nonDurableStoryLabJobStore`
// singleton in `jobStore.ts`: every one of the 5 call sites into
// `createStoryLabCloudStorage()` must see the same records, not a fresh
// `Map` per call — otherwise a profile saved through the account route would
// be invisible to the job/genesis/continuation routes within the same
// process. This still does not share state across separate Vercel function
// invocations; that limitation is identical to, and no worse than, the one
// already accepted for the rate-limit and job-store non-durable defaults.
const sharedNonDurableStoryLabProfileStore = createNonDurableInMemoryStoryLabProfileStore();
const sharedNonDurableStoryProjectStore = createNonDurableInMemoryStoryProjectStore();

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
    // The shared singletons always use the real clock, deliberately ignoring
    // `options.now` here — matching `storyLabJobStoreConfig.ts`'s own
    // `nonDurableStoryLabJobStore` singleton, which does the same. This
    // matters because `createStoryLabAccountRouteHandler()` *always*
    // constructs and passes a `now` closure (even when its caller supplied
    // none), not only in tests — so branching on "is `now` present" would
    // give the account route (the one route that actually saves profiles) a
    // private store while every other route kept sharing the singleton,
    // silently reintroducing the exact cross-route isolation bug this
    // singleton exists to fix. A test that wants a controlled clock for this
    // mode should pass `nonDurableProfileStore`/`nonDurableProjectStore`
    // explicitly instead — that path is unaffected by this branch.
    const profileStore = options.nonDurableProfileStore ?? sharedNonDurableStoryLabProfileStore;
    const projectStore = options.nonDurableProjectStore ?? sharedNonDurableStoryProjectStore;
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
