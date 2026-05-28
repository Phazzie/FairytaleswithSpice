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

const transientSnapshots = new Map<string, StoredStorySnapshot>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function getTransientStorySnapshot(storyId: string): StoredStorySnapshot | null {
  const snapshot = transientSnapshots.get(storyId);
  return snapshot ? clone(snapshot) : null;
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

  transientSnapshots.set(payload.summary.storyId, {
    summary: clone(payload.summary),
    state: clone(payload.state),
    chapters: Array.from(chapterMap.values()).map(chapter => clone(chapter)),
    updatedAt: persistedAt
  });

  return {
    mode: 'transient_memory',
    persistedRevision: payload.state.revision,
    persistedAt,
    warning: 'Transient memory is for local story-lab continuity only; choose durable Vercel storage before treating this as production persistence.'
  };
}
