// Created: 2026-09-01 EDT
//
// Shared by `rate-limit-store.test.ts` and `rate-limit-store-config.test.ts`,
// which both need a `StoryLabCloudQueryExecutor` fake that records every
// query it receives and answers with a queued row set — one implementation
// instead of two copies drifting apart.

import type { StoryLabCloudQueryExecutor } from '../../api/_lib/story-lab/storage/storyLabCloudStorageConfig';

export class RecordingQueryExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][] = [];

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return { rows: (this.queuedRows.shift() ?? []) as T[] };
  }
}
