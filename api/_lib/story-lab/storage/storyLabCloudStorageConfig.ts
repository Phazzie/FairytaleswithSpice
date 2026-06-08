// Created: 2026-06-08 10:50 EDT

import type { StoryLabProfileStore } from '../profile/storyLabProfileStore';
import {
  createPostgresStoryLabProfileStore,
  type PostgresProfileQueryExecutor
} from '../profile/postgresStoryLabProfileStore';
import {
  createPostgresStoryProjectStore,
  type PostgresQueryExecutor
} from './postgresStoryProjectStore';
import { createNeonStoryLabQueryExecutor } from './neonStoryLabExecutor';
import type { StoryProjectStore } from './storyProjectStore';

export interface StoryLabCloudQueryExecutor extends PostgresProfileQueryExecutor, PostgresQueryExecutor {}

export interface StoryLabCloudStorageConfigOptions {
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  executor?: StoryLabCloudQueryExecutor;
  createExecutor?: (databaseUrl: string) => StoryLabCloudQueryExecutor;
  now?: () => string;
}

export interface StoryLabCloudStorageConfig {
  databaseUrlConfigured: boolean;
  executorConfigured: boolean;
  profileStore: StoryLabProfileStore;
  projectStore: StoryProjectStore;
  isConfigured(): boolean;
}

export function createStoryLabCloudStorage(
  options: StoryLabCloudStorageConfigOptions = {}
): StoryLabCloudStorageConfig {
  const databaseUrl = resolveDatabaseUrl(options);
  const executor = databaseUrl ? resolveExecutor(databaseUrl, options) : undefined;
  const profileStore = createPostgresStoryLabProfileStore({
    databaseUrl,
    executor,
    now: options.now
  });
  const projectStore = createPostgresStoryProjectStore({
    databaseUrl,
    executor,
    now: options.now
  });

  return {
    databaseUrlConfigured: Boolean(databaseUrl),
    executorConfigured: Boolean(executor),
    profileStore,
    projectStore,
    isConfigured() {
      return Boolean(databaseUrl && executor && profileStore.isConfigured() && projectStore.isConfigured());
    }
  };
}

function resolveDatabaseUrl(options: StoryLabCloudStorageConfigOptions): string {
  return options.databaseUrl ?? options.env?.['DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '';
}

function resolveExecutor(
  databaseUrl: string,
  options: StoryLabCloudStorageConfigOptions
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
