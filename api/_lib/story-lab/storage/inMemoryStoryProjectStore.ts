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
}

export function createNonDurableInMemoryStoryProjectStore(
  options: NonDurableInMemoryStoryProjectStoreOptions = {}
): StoryProjectStore {
  return new NonDurableInMemoryStoryProjectStore(options.now ?? (() => new Date().toISOString()));
}

class NonDurableInMemoryStoryProjectStore implements StoryProjectStore {
  readonly mode = 'non_durable_memory';
  readonly durable = false;

  private readonly records = new Map<string, StoredStoryProjectRecord>();

  constructor(private readonly now: () => string) {}

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

    this.records.set(record.projectId, cloneStoredStoryProjectRecord(record));
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
