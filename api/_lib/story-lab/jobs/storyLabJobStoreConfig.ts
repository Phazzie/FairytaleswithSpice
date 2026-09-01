// Created: 2026-06-08 16:10 EDT

import { nonDurableStoryLabJobStore } from './jobStore';
import type { StoryLabJobStore, StoryLabJobStorageMode } from './jobStorePort';
import {
  createPostgresStoryLabJobStore,
  type PostgresStoryLabJobStoreOptions
} from './postgresStoryLabJobStore';
import { createNeonStoryLabQueryExecutor } from '../storage/neonStoryLabExecutor';
import type { StoryLabCloudQueryExecutor } from '../storage/storyLabCloudStorageConfig';
import {
  normalizeDurableStoreMode,
  resolveDurableStoreDatabaseUrl,
  resolveDurableStoreExecutor,
  resolveDurableStoreMode
} from '../storage/durableStoreEnvResolution';

const STORY_LAB_JOB_STORE_ENV_VAR = 'STORY_LAB_JOB_STORE';
const DEFAULT_STORY_LAB_JOB_STORE_MODE = 'non_durable_memory';

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
  const requestedMode = resolveDurableStoreMode(STORY_LAB_JOB_STORE_ENV_VAR, DEFAULT_STORY_LAB_JOB_STORE_MODE, {
    modeOverride: options.jobStoreMode,
    env: options.env
  });
  const normalizedMode = normalizeDurableStoreMode(requestedMode);

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
    const databaseUrl = resolveDurableStoreDatabaseUrl(options);
    const executor = databaseUrl
      ? resolveDurableStoreExecutor(databaseUrl, options.executor, options.createExecutor, createNeonStoryLabQueryExecutor)
      : undefined;
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
    databaseUrlConfigured: Boolean(resolveDurableStoreDatabaseUrl(options)),
    executorConfigured: false,
    store: null,
    errorCode: 'STORY_LAB_JOB_STORE_UNSUPPORTED_MODE',
    isConfigured() {
      return false;
    }
  };
}
