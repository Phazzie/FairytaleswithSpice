// Created: 2026-05-26 06:55 EDT

import type {
  GeneratedChapter,
  StoryIterationPayload,
  StoryPersistenceReceipt,
  StoryStateSnapshot,
  StorySummary
} from './contracts';

export interface StoredStorySnapshot {
  summary: StorySummary;
  state: StoryStateSnapshot;
  chapters: GeneratedChapter[];
  updatedAt: string;
}

/**
 * How many story snapshots the process keeps in memory at once.
 *
 * Every snapshot holds a story's whole chapter set as generated HTML, and one
 * is written on every genesis and every continuation. The map was unbounded, so
 * on the long-lived Node/Docker deployment — where the process outlives a single
 * request, unlike a serverless invocation — it grew by one full story per
 * generation and nothing ever removed an entry: a day of traffic is a day of
 * story HTML held live, and the only thing that reclaimed it was a restart. The
 * sibling `NonDurableStoryLabJobStore` bounds itself for exactly this reason;
 * this store now does the same.
 *
 * The bound is a count rather than a byte budget because a snapshot's size is
 * bounded in turn: `desiredWordBudget` caps at 1500 words per chapter, so the
 * cap is a predictable ceiling on what the store can hold.
 */
export const MAX_TRANSIENT_STORY_SNAPSHOTS = 200;

const transientSnapshots = new Map<string, StoredStorySnapshot>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Move a story to the newest end of the eviction order.
 *
 * A `Map` orders by first insertion, and re-setting an existing key does not
 * move it, so eviction without this would be by story *age* rather than by last
 * use: a serial someone is still writing would be dropped ahead of an abandoned
 * one that happens to be newer. Deleting before setting is what makes the order
 * least-recently-used, and reading counts as a use because a read is what a
 * continuation does with the snapshot it is about to extend.
 */
function markStoryAsRecentlyUsed(storyId: string, snapshot: StoredStorySnapshot): void {
  transientSnapshots.delete(storyId);
  transientSnapshots.set(storyId, snapshot);
}

function evictLeastRecentlyUsedSnapshots(): void {
  while (transientSnapshots.size > MAX_TRANSIENT_STORY_SNAPSHOTS) {
    const oldestStoryId = transientSnapshots.keys().next().value;
    if (oldestStoryId === undefined) {
      return;
    }

    transientSnapshots.delete(oldestStoryId);
  }
}

/**
 * Exported for tests, which need a known-empty store to assert on the bound
 * without depending on whatever earlier assertions happened to persist.
 */
export function resetTransientStorySnapshots(): void {
  transientSnapshots.clear();
}

export function getTransientStorySnapshot(storyId: string): StoredStorySnapshot | null {
  const snapshot = transientSnapshots.get(storyId);
  if (!snapshot) {
    return null;
  }

  markStoryAsRecentlyUsed(storyId, snapshot);

  return clone(snapshot);
}

export function persistStoryIteration(
  payload: StoryIterationPayload,
  previousChapters: GeneratedChapter[] = []
): StoryPersistenceReceipt {
  const persistedAt = new Date().toISOString();
  const chapterMap = new Map<string, GeneratedChapter>();

  for (const chapter of previousChapters) {
    chapterMap.set(chapter.chapterId, chapter);
  }

  for (const chapter of payload.batch.chapters) {
    chapterMap.set(chapter.chapterId, chapter);
  }

  markStoryAsRecentlyUsed(payload.summary.storyId, {
    summary: clone(payload.summary),
    state: clone(payload.state),
    chapters: Array.from(chapterMap.values()).map(chapter => clone(chapter)),
    updatedAt: persistedAt
  });
  evictLeastRecentlyUsedSnapshots();

  return {
    mode: 'transient_memory',
    persistedRevision: payload.state.revision,
    persistedAt,
    warning: 'Transient memory is for local story-lab continuity only; choose durable Vercel storage before treating this as production persistence.'
  };
}
