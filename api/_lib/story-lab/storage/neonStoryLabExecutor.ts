// Created: 2026-06-08 11:00 EDT

import { neon } from '@neondatabase/serverless';
import type { StoryLabCloudQueryExecutor } from './storyLabCloudStorageConfig';

export type NeonStoryLabQuery = (sql: string, params: readonly unknown[]) => Promise<unknown[]>;

export interface NeonStoryLabExecutorOptions {
  createQuery?: (databaseUrl: string) => NeonStoryLabQuery;
}

export function createNeonStoryLabQueryExecutor(
  databaseUrl: string,
  options: NeonStoryLabExecutorOptions = {}
): StoryLabCloudQueryExecutor {
  const normalizedDatabaseUrl = databaseUrl.trim();
  if (!normalizedDatabaseUrl) {
    throw new Error('DATABASE_URL is required to create the Story Lab Neon executor.');
  }

  const runQuery = options.createQuery?.(normalizedDatabaseUrl) ?? createDefaultNeonQuery(normalizedDatabaseUrl);

  return {
    async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
      const rows = await runQuery(sql, params);
      return {
        rows: rows as T[]
      };
    }
  };
}

function createDefaultNeonQuery(databaseUrl: string): NeonStoryLabQuery {
  const sql = neon(databaseUrl);
  return async (queryText, params) => sql.query(queryText, [...params]);
}
