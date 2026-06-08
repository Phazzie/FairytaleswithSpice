// Created: 2026-06-08 16:10 EDT

import { nonDurableStoryLabJobStore } from './jobStore';
import type { StoryLabJobStore, StoryLabJobStorageMode } from './jobStorePort';
import {
  createPostgresStoryLabJobStore,
  type PostgresStoryLabJobStoreOptions
} from './postgresStoryLabJobStore';
import { createNeonStoryLabQueryExecutor } from '../storage/neonStoryLabExecutor';
import type { StoryLabCloudQueryExecutor } from '../storage/storyLabCloudStorageConfig';

export type StoryLabJobStoreConfigMode = StoryLabJobStorageMode | 'unsupported';
export type StoryLabJobStoreConfigErrorCode = 'STORY_LAB_JOB_STORE_UNSUPPORTED_MODE';

export interface StoryLabJobStoreConfigOptions {
  jobStoreMode?: string;
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  executor?: StoryLabCloudQueryExecutor;
  createExecutor?: (databaseUrl: string) => StoryLabCloudQueryExecutor;
  nonDurableStore?: StoryLabJobStore;
  now?: PostgresStoryLabJobStoreOptions['now'];
  jobIdFactory?: PostgresStoryLabJobStoreOptions['jobIdFactory'];
  eventIdFactory?: PostgresStoryLabJobStoreOptions['eventIdFactory'];
}

export interface StoryLabJobStoreConfig {
  requestedMode: string;
  mode: StoryLabJobStoreConfigMode;
  databaseUrlConfigured: boolean;
  executorConfigured: boolean;
  store: StoryLabJobStore | null;
  errorCode?: StoryLabJobStoreConfigErrorCode;
  isConfigured(): boolean;
}

export function createStoryLabJobStoreConfig(
  options: StoryLabJobStoreConfigOptions = {}
): StoryLabJobStoreConfig {
  const requestedMode = resolveRawJobStoreMode(options);
  const normalizedMode = normalizeMode(requestedMode);

  if (normalizedMode === 'non_durable_memory' || normalizedMode === 'memory') {
    const store = options.nonDurableStore ?? nonDurableStoryLabJobStore;
    return {
      requestedMode,
      mode: 'non_durable_memory',
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
    const store = createPostgresStoryLabJobStore({
      databaseUrl,
      executor,
      now: options.now,
      jobIdFactory: options.jobIdFactory,
      eventIdFactory: options.eventIdFactory
    });

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
    errorCode: 'STORY_LAB_JOB_STORE_UNSUPPORTED_MODE',
    isConfigured() {
      return false;
    }
  };
}

function resolveRawJobStoreMode(options: StoryLabJobStoreConfigOptions): string {
  return options.jobStoreMode
    ?? options.env?.['STORY_LAB_JOB_STORE']
    ?? process.env['STORY_LAB_JOB_STORE']
    ?? 'non_durable_memory';
}

function normalizeMode(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

function resolveDatabaseUrl(options: StoryLabJobStoreConfigOptions): string {
  return options.databaseUrl ?? options.env?.['DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '';
}

function resolveExecutor(
  databaseUrl: string,
  options: StoryLabJobStoreConfigOptions
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
