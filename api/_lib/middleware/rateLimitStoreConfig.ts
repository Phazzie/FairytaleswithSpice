// Created: 2026-09-01 EDT
//
// Mirrors `../story-lab/jobs/storyLabJobStoreConfig.ts`: an env-driven switch
// between a process-local default and a Postgres-backed store, so flipping
// the default is a separate, gated step (see that file's own history) rather
// than something this PR does unilaterally. `RATE_LIMIT_STORE` unset or
// `memory` keeps today's in-memory behavior exactly as it is; `postgres`
// opts a deployment into the shared counter once `DATABASE_URL` is set.

import { InMemoryRateLimitStore } from './inMemoryRateLimitStore';
import { createPostgresRateLimitStore } from './postgresRateLimitStore';
import { createNeonStoryLabQueryExecutor } from '../story-lab/storage/neonStoryLabExecutor';
import type { StoryLabCloudQueryExecutor } from '../story-lab/storage/storyLabCloudStorageConfig';
import type { RateLimitStorageMode, RateLimitStore } from './rateLimitStorePort';

export type RateLimitStoreConfigMode = RateLimitStorageMode | 'unsupported';
export type RateLimitStoreConfigErrorCode = 'RATE_LIMIT_STORE_UNSUPPORTED_MODE';

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
  const requestedMode = resolveRawMode(options);
  const normalizedMode = normalizeMode(requestedMode);

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
    const databaseUrl = resolveDatabaseUrl(options);
    const executor = databaseUrl ? resolveExecutor(databaseUrl, options) : undefined;
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
    databaseUrlConfigured: Boolean(resolveDatabaseUrl(options)),
    executorConfigured: false,
    store: null,
    errorCode: 'RATE_LIMIT_STORE_UNSUPPORTED_MODE',
    isConfigured() {
      return false;
    }
  };
}

function resolveRawMode(options: RateLimitStoreConfigOptions): string {
  const normalizeRawMode = (value: string) => value.trim();
  if (options.rateLimitStoreMode !== undefined) {
    return normalizeRawMode(options.rateLimitStoreMode);
  }

  if (options.env) {
    return normalizeRawMode(options.env['RATE_LIMIT_STORE'] ?? 'memory');
  }

  return normalizeRawMode(process.env['RATE_LIMIT_STORE'] ?? 'memory');
}

function normalizeMode(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

function resolveDatabaseUrl(options: RateLimitStoreConfigOptions): string {
  if (options.databaseUrl !== undefined) {
    return options.databaseUrl.trim();
  }

  if (options.env) {
    return (options.env['DATABASE_URL'] ?? '').trim();
  }

  return (process.env['DATABASE_URL'] ?? '').trim();
}

function resolveExecutor(
  databaseUrl: string,
  options: RateLimitStoreConfigOptions
): StoryLabCloudQueryExecutor | undefined {
  if (options.executor) {
    return options.executor;
  }

  try {
    return options.createExecutor?.(databaseUrl) ?? createNeonStoryLabQueryExecutor(databaseUrl);
  } catch {
    return undefined;
  }
}
