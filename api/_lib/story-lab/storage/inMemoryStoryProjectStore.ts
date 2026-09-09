// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../auth/authPort';
import { authorizeProjectAccess, isProjectAuthorizationError } from '../auth/authorizeProjectAccess';
import type { SavedStoryProject } from '../contracts';
import {
  cloneStoredStoryProjectRecord,
  createStoredStoryProjectRecord,
  createStoryProjectStoreError,
  errorResult,
  projectAccessRecordFromStoredProject,
  sortStoryProjectListItems,
  StoryProjectDeleteReceipt,
  StoryProjectListPage,
  StoryProjectListQuery,
  StoryProjectStore,
  StoryProjectStoreError,
  StoryProjectStoreResult,
  StoredStoryProjectRecord,
  successResult,
  toStoryProjectListItem
} from './storyProjectStore';

export interface NonDurableInMemoryStoryProjectStoreOptions {
  now?: () => string;
  maxProjects?: number;
}

/**
 * How many Story Lab projects this process keeps in memory at once.
 *
 * Every record holds a project's whole `SavedStoryProject` — every chapter's
 * HTML, its blueprint, its accepted memory cards — and one is written on
 * every save. This map was unbounded and nothing ever removed an entry, so it
 * grew by one full project per save for as long as the process lived. A
 * Vercel invocation is not the short-lived thing that makes that safe: an
 * instance is kept warm and reused across requests, so every project saved
 * on one accumulates here until the platform recycles it — and this store is
 * live whenever `STORY_LAB_CLOUD_STORAGE=non_durable_memory` is set, or
 * whenever `DATABASE_URL` is absent and the config falls back to it. The
 * sibling `stateStore.ts` transient snapshot map and `NonDurableStoryLabJobStore`
 * both bound themselves for exactly this reason; this store now does the same.
 */
const DEFAULT_MAX_STORY_LAB_PROJECTS = 200;

export function createNonDurableInMemoryStoryProjectStore(
  options: NonDurableInMemoryStoryProjectStoreOptions = {}
): StoryProjectStore {
  return new NonDurableInMemoryStoryProjectStore(
    options.now ?? (() => new Date().toISOString()),
    options.maxProjects ?? DEFAULT_MAX_STORY_LAB_PROJECTS
  );
}

class NonDurableInMemoryStoryProjectStore implements StoryProjectStore {
  readonly mode = 'non_durable_memory';
  readonly durable = false;

  private readonly records = new Map<string, StoredStoryProjectRecord>();

  constructor(
    private readonly now: () => string,
    private readonly maxProjects: number = DEFAULT_MAX_STORY_LAB_PROJECTS
  ) {}

  isConfigured(): boolean {
    return true;
  }

  async saveProject(
    user: AuthUser,
    project: SavedStoryProject
  ): Promise<StoryProjectStoreResult<StoredStoryProjectRecord>> {
    const projectId = project.id || project.storyId;
    const existing = this.records.get(projectId);
    if (existing) {
      const accessError = this.authorizeOwner(user, existing);
      if (accessError) {
        return errorResult(accessError);
      }
    }

    const record = createStoredStoryProjectRecord({
      user,
      project,
      storageMode: this.mode,
      now: this.now(),
      existingCreatedAt: existing?.createdAt
    });

    this.markProjectAsRecentlyUsed(record.projectId, cloneStoredStoryProjectRecord(record));
    this.evictLeastRecentlyUsedProjects();
    return successResult(cloneStoredStoryProjectRecord(record));
  }

  async loadProject(
    user: AuthUser,
    projectId: string
  ): Promise<StoryProjectStoreResult<StoredStoryProjectRecord | null>> {
    const record = this.records.get(projectId);
    if (!record) {
      return successResult(null);
    }

    const accessError = this.authorizeOwner(user, record);
    if (accessError) {
      return errorResult(accessError);
    }

    // A read the owner check refuses is not a use: an unauthorized probe must
    // not be able to keep someone else's project alive, or reorder the
    // eviction queue at all.
    this.markProjectAsRecentlyUsed(projectId, record);

    return successResult(cloneStoredStoryProjectRecord(record));
  }

  // The ordering and the cap are the query's, so this adapter answers them with
  // the shared comparator rather than a second reading of its own: it and the
  // Postgres adapter have to agree about what "the first `limit` by this sort"
  // means, and the only way two implementations agree is by not being two.
  async listProjects(user: AuthUser, query: StoryProjectListQuery): Promise<StoryProjectStoreResult<StoryProjectListPage>> {
    const owned = Array.from(this.records.values())
      .filter(record => record.ownerUserId === user.userId)
      .map(toStoryProjectListItem);

    return successResult({
      items: sortStoryProjectListItems(owned, query.sort).slice(0, query.limit),
      totalCount: owned.length
    });
  }

  async deleteProject(user: AuthUser, projectId: string): Promise<StoryProjectStoreResult<StoryProjectDeleteReceipt>> {
    const record = this.records.get(projectId);
    if (!record) {
      return successResult({
        projectId,
        deleted: false
      });
    }

    const accessError = this.authorizeOwner(user, record);
    if (accessError) {
      return errorResult(accessError);
    }

    this.records.delete(projectId);
    return successResult({
      projectId,
      deleted: true
    });
  }

  /**
   * Move a project to the newest end of the eviction order.
   *
   * A `Map` orders by first insertion, and re-setting an existing key does not
   * move it, so eviction without this would be by project *age* rather than by
   * last use: a project someone is still editing would be dropped ahead of an
   * abandoned one that happens to be newer.
   */
  private markProjectAsRecentlyUsed(projectId: string, record: StoredStoryProjectRecord): void {
    this.records.delete(projectId);
    this.records.set(projectId, record);
  }

  private evictLeastRecentlyUsedProjects(): void {
    while (this.records.size > this.maxProjects) {
      const oldestProjectId = this.records.keys().next().value;
      if (oldestProjectId === undefined) {
        return;
      }

      this.records.delete(oldestProjectId);
    }
  }

  private authorizeOwner(user: AuthUser, record: StoredStoryProjectRecord): StoryProjectStoreError | null {
    try {
      authorizeProjectAccess(user, projectAccessRecordFromStoredProject(record));
      return null;
    } catch (error) {
      if (isProjectAuthorizationError(error)) {
        return createStoryProjectStoreError(
          'STORY_LAB_PROJECT_FORBIDDEN',
          'You do not have access to this Story Lab project.',
          403
        );
      }
      throw error;
    }
  }
}
