// Created: 2026-09-01 EDT
//
// Mirrors `../story-lab/jobs/storyLabJobStoreConfig.ts`: an env-driven switch
// between a process-local default and a Postgres-backed store, so flipping
// the default is a separate, gated step (see that file's own history) rather
// than something this PR does unilaterally. `RATE_LIMIT_STORE` unset or
// `memory` keeps today's in-memory behavior exactly as it is; `postgres`
// opts a deployment into the shared counter once `DATABASE_URL` is set.
//
// The env-resolution mechanics themselves (mode env var, `DATABASE_URL`,
// executor construction) are shared with that file via
// `durableStoreEnvResolution.ts` rather than duplicated — see that module.

import { InMemoryRateLimitStore } from './inMemoryRateLimitStore';
import { createPostgresRateLimitStore } from './postgresRateLimitStore';
import { createNeonStoryLabQueryExecutor } from '../story-lab/storage/neonStoryLabExecutor';
import type { StoryLabCloudQueryExecutor } from '../story-lab/storage/storyLabCloudStorageConfig';
import {
  normalizeDurableStoreMode,
  resolveDurableStoreDatabaseUrl,
  resolveDurableStoreExecutor,
  resolveDurableStoreMode
} from '../story-lab/storage/durableStoreEnvResolution';
import type { RateLimitStorageMode, RateLimitStore } from './rateLimitStorePort';

export type RateLimitStoreConfigMode = RateLimitStorageMode | 'unsupported';
export type RateLimitStoreConfigErrorCode = 'RATE_LIMIT_STORE_UNSUPPORTED_MODE';

const RATE_LIMIT_STORE_ENV_VAR = 'RATE_LIMIT_STORE';
const DEFAULT_RATE_LIMIT_STORE_MODE = 'memory';

export interface RateLimitStoreConfigOptions {
  rateLimitStoreMode?: string;
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  executor?: StoryLabCloudQueryExecutor;
  createExecutor?: (databaseUrl: string) => StoryLabCloudQueryExecutor;
  memoryStore?: RateLimitStore;
  now?: () => number;
}

export interface RateLimitStoreConfig {
  requestedMode: string;
  mode: RateLimitStoreConfigMode;
  databaseUrlConfigured: boolean;
  executorConfigured: boolean;
  store: RateLimitStore | null;
  errorCode?: RateLimitStoreConfigErrorCode;
  isConfigured(): boolean;
}

const sharedInMemoryRateLimitStore = new InMemoryRateLimitStore();

export function createRateLimitStoreConfig(options: RateLimitStoreConfigOptions = {}): RateLimitStoreConfig {
  const requestedMode = resolveDurableStoreMode(RATE_LIMIT_STORE_ENV_VAR, DEFAULT_RATE_LIMIT_STORE_MODE, {
    modeOverride: options.rateLimitStoreMode,
    env: options.env
  });
  const normalizedMode = normalizeDurableStoreMode(requestedMode);

  if (normalizedMode === 'memory') {
    const store = options.memoryStore ?? sharedInMemoryRateLimitStore;
    return {
      requestedMode,
      mode: 'memory',
      databaseUrlConfigured: false,
      executorConfigured: false,
      store,
      isConfigured() {
        return store.isConfigured();
      }
    };
  }

  if (normalizedMode === 'postgres') {
    const databaseUrl = resolveDurableStoreDatabaseUrl(options);
    const executor = databaseUrl
      ? resolveDurableStoreExecutor(databaseUrl, options.executor, options.createExecutor, createNeonStoryLabQueryExecutor)
      : undefined;
    const store = createPostgresRateLimitStore({ databaseUrl, executor, now: options.now });

    return {
      requestedMode,
      mode: 'postgres',
      databaseUrlConfigured: Boolean(databaseUrl),
      executorConfigured: Boolean(executor),
      store,
      isConfigured() {
        return store.isConfigured();
      }
    };
  }

  return {
    requestedMode,
    mode: 'unsupported',
    databaseUrlConfigured: Boolean(resolveDurableStoreDatabaseUrl(options)),
    executorConfigured: false,
    store: null,
    errorCode: 'RATE_LIMIT_STORE_UNSUPPORTED_MODE',
    isConfigured() {
      return false;
    }
  };
}
