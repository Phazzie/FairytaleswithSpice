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
  StoryProjectDeleteReceipt,
  StoryProjectListItem,
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

  async listProjects(user: AuthUser): Promise<StoryProjectStoreResult<StoryProjectListItem[]>> {
    const items = Array.from(this.records.values())
      .filter(record => record.ownerUserId === user.userId)
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .map(toStoryProjectListItem);

    return successResult(items);
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
