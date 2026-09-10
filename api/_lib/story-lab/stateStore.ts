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
  /**
   * The signed-in caller who wrote this snapshot, or `undefined` when it was
   * written by a caller with no session — see `getTransientStorySnapshot`.
   */
  ownerUserId?: string;
}

/**
 * How many story snapshots this process keeps in memory at once.
 *
 * Every snapshot holds a story's whole chapter set as generated HTML, and one
 * is written on every genesis and every continuation. The map was unbounded and
 * nothing ever removed an entry, so it grew by one full story per generation
 * for as long as the process lived. A Vercel invocation is not the short-lived
 * thing that makes that safe: an instance is kept warm and reused across
 * requests, so every story generated on one accumulates in the same map until
 * the platform recycles it — and the local Node run used for development and
 * smoke tests holds them for the whole session. The sibling
 * `NonDurableStoryLabJobStore` bounds itself for exactly this reason; this
 * store now does the same.
 *
 * The bound is on the number of stories, not on bytes, and it does not claim a
 * ceiling on the memory held. A story's snapshot carries every chapter written
 * so far and continuations keep appending, so one serial grows without limit
 * however few of them are retained. Capping the chapter set is not available
 * here: a continuation reads this snapshot to know what came before, so a
 * truncated one would silently break the story it is meant to continue. What
 * this bound removes is the unbounded *count* — the failure that needed no
 * unusual usage at all, just traffic.
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

/**
 * Reads back a snapshot for `storyId`, scoped to the caller who is asking for
 * it.
 *
 * This store is keyed only by `storyId` — a random UUID minted once per story
 * (`mockData.ts`), never by who wrote it — and every durable sibling this
 * process has (`postgresStoryProjectStore.ts`, `postgresStoryLabJobStore.ts`,
 * `inMemoryStoryProjectStore.ts` via `authorizeProjectAccess.ts`) checks an
 * owner on every read. This one did not, and `createContinuationJob`
 * (`jobRouteHandlers.ts`) reads it *before* the route's own auth/ownership
 * check ever runs: a signed-in caller who supplied only another user's
 * `storyId` — omitting `storyState`/`previouslyGeneratedChapters` — had this
 * function hand back that other user's cached title, prior chapters, and
 * continuity state, which the route then fed to the generator and returned
 * inside the *caller's own* job. The route requires sign-in and looks
 * protected; the leak came through a fallback nobody had scoped to an owner.
 *
 * `callerOwnerUserId` is the asking caller's own id (`undefined` for a caller
 * with no session — resolved via `resolveCallerOwnerUserId`, a soft lookup
 * that never throws). A mismatch against the stored `ownerUserId` — including
 * a signed-in caller reading a snapshot with no recorded owner, or vice versa
 * — is answered exactly like "no snapshot exists", never a distinguishable
 * "forbidden": the caller falls back to supplying their own state, the same
 * outcome an expired/evicted snapshot already produces today. Comparing with
 * `??` rather than `===` is what keeps two anonymous callers (`undefined` on
 * both sides) matching each other exactly as they always have, so a fully
 * anonymous deployment — no `STORY_LAB_AUTH_PROVIDER` configured, every caller
 * unauthenticated — sees no behavior change at all.
 */
export function getTransientStorySnapshot(storyId: string, callerOwnerUserId?: string): StoredStorySnapshot | null {
  const snapshot = transientSnapshots.get(storyId);
  if (!snapshot) {
    return null;
  }

  if ((snapshot.ownerUserId ?? null) !== (callerOwnerUserId ?? null)) {
    return null;
  }

  markStoryAsRecentlyUsed(storyId, snapshot);

  return clone(snapshot);
}

export function persistStoryIteration(
  payload: StoryIterationPayload,
  previousChapters: GeneratedChapter[] = [],
  ownerUserId?: string
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
    updatedAt: persistedAt,
    ownerUserId
  });
  evictLeastRecentlyUsedSnapshots();

  return {
    mode: 'transient_memory',
    persistedRevision: payload.state.revision,
    persistedAt,
    warning: 'Transient memory is for local story-lab continuity only; choose durable Vercel storage before treating this as production persistence.'
  };
}
