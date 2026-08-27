// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../auth/authPort';
import type { ProjectAccessRecord } from '../auth/authorizeProjectAccess';
import type { SavedStoryProject, StoryLabLibrarySort } from '../contracts';

export type StoryProjectStorageMode = 'non_durable_memory' | 'postgres';

export type StoryProjectStoreErrorCode =
  | 'STORY_LAB_STORAGE_UNCONFIGURED'
  | 'STORY_LAB_STORAGE_DRIVER_MISSING'
  | 'STORY_LAB_PROJECT_NOT_FOUND'
  | 'STORY_LAB_PROJECT_FORBIDDEN'
  | 'STORY_LAB_STORAGE_ERROR';

export type StoryProjectStoreResult<T> =
  | { success: true; data: T }
  | { success: false; error: StoryProjectStoreError };

export interface StoryProjectStoreError {
  code: StoryProjectStoreErrorCode;
  message: string;
  statusCode: number;
  retryable: boolean;
}

export interface StoredStoryProjectRecord {
  projectId: string;
  storyId: string;
  ownerUserId: string;
  project: SavedStoryProject;
  createdAt: string;
  updatedAt: string;
  storageMode: StoryProjectStorageMode;
}

export interface StoryProjectListItem {
  projectId: string;
  storyId: string;
  title: string;
  synopsis: string;
  chapterCount: number;
  acceptedMemoryCardCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface StoryProjectDeleteReceipt {
  projectId: string;
  deleted: boolean;
}

export interface StoryProjectStore {
  readonly mode: StoryProjectStorageMode;
  readonly durable: boolean;
  isConfigured(): boolean;
  saveProject(user: AuthUser, project: SavedStoryProject): Promise<StoryProjectStoreResult<StoredStoryProjectRecord>>;
  loadProject(user: AuthUser, projectId: string): Promise<StoryProjectStoreResult<StoredStoryProjectRecord | null>>;
  listProjects(user: AuthUser): Promise<StoryProjectStoreResult<StoryProjectListItem[]>>;
  deleteProject(user: AuthUser, projectId: string): Promise<StoryProjectStoreResult<StoryProjectDeleteReceipt>>;
}

export interface CreateStoredStoryProjectRecordInput {
  user: AuthUser;
  project: SavedStoryProject;
  storageMode: StoryProjectStorageMode;
  now?: string;
  existingCreatedAt?: string;
}

export function createStoredStoryProjectRecord(input: CreateStoredStoryProjectRecordInput): StoredStoryProjectRecord {
  const now = input.now ?? new Date().toISOString();
  const project = normalizeSavedStoryProject(input.project, now, input.existingCreatedAt);

  return {
    projectId: project.id,
    storyId: project.storyId,
    ownerUserId: input.user.userId,
    project,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    storageMode: input.storageMode
  };
}

export function normalizeSavedStoryProject(
  project: SavedStoryProject,
  now: string,
  existingCreatedAt?: string
): SavedStoryProject {
  const normalizedProject: SavedStoryProject = {
    ...cloneSavedStoryProject(project),
    id: project.id || project.storyId,
    title: project.title || project.summary?.title || 'Untitled Story Lab Project',
    synopsis: project.synopsis || project.summary?.synopsis || '',
    createdAt: (existingCreatedAt ?? project.createdAt) || now,
    updatedAt: now
  };

  return normalizedProject;
}

export function cloneSavedStoryProject(project: SavedStoryProject): SavedStoryProject {
  return structuredClone(project);
}

export function cloneStoredStoryProjectRecord(record: StoredStoryProjectRecord): StoredStoryProjectRecord {
  return {
    ...record,
    project: cloneSavedStoryProject(record.project)
  };
}

export function toStoryProjectListItem(record: StoredStoryProjectRecord): StoryProjectListItem {
  return {
    projectId: record.projectId,
    storyId: record.storyId,
    title: record.project.title,
    synopsis: record.project.synopsis,
    chapterCount: record.project.chapters?.length ?? 0,
    acceptedMemoryCardCount: record.project.acceptedMemoryCards?.length ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/**
 * Order a cloud library the way its owner asked for it.
 *
 * `StoryLabProfilePreferences.librarySort` is a three-value closed set —
 * `updated_desc`, `created_desc`, `title_asc` — declared in the shared
 * contracts, defaulted by `createDefaultStoryLabProfilePreferences`, validated
 * against `STORY_LAB_LIBRARY_SORTS` by `normalizeStoryLabProfilePreferences`,
 * written to both profile stores, and handed back by
 * `GET /api/story-lab/account/profile`. Nothing read it. Both project stores
 * order their own list newest-updated-first and hand it straight to the route,
 * so two of the three values a reader could save were settings with no effect:
 * the preference round-tripped through the API intact and the library came back
 * in the same order whatever it said.
 *
 * The ordering is applied here rather than pushed into the stores because it is
 * a property of the answer, not of the storage: the Postgres store's
 * `LIST_PROJECTS_SQL` and the in-memory store's comparator would otherwise both
 * have to learn the same three orderings and be kept agreeing about them, and
 * the list item already carries all three fields the orderings read.
 *
 * `Date.parse` answers `NaN` for a timestamp it cannot read, and a comparator
 * that answers `NaN` is read as *equal* — `Array.prototype.sort` coerces it to
 * `+0` — so one unreadable entry would compare equal to every other and pin the
 * list in whatever order it arrived in. That is the failure
 * `byNewestUpdateFirst` in `story-workspace-storage.service.ts` was fixed for on
 * the local library, and this is the same reading: an unreadable timestamp sorts
 * as older than any real one, using a finite floor so that two of them compare
 * equal to each other rather than subtracting to `NaN` again.
 *
 * Titles are compared with `localeCompare` so that `Élise` files with the `E`s
 * rather than after `Z`, and the project id breaks every tie so that one library
 * always comes back in one order.
 */
export function sortStoryProjectListItems(
  items: readonly StoryProjectListItem[],
  sort: StoryLabLibrarySort
): StoryProjectListItem[] {
  const ordered = [...items];

  if (sort === 'title_asc') {
    return ordered.sort((first, second) =>
      first.title.localeCompare(second.title) || first.projectId.localeCompare(second.projectId));
  }

  const field = sort === 'created_desc' ? 'createdAt' : 'updatedAt';

  return ordered.sort((first, second) =>
    toSortableTimestamp(second[field]) - toSortableTimestamp(first[field])
      || first.projectId.localeCompare(second.projectId));
}

function toSortableTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MIN_SAFE_INTEGER : parsed;
}

export function projectAccessRecordFromStoredProject(record: StoredStoryProjectRecord): ProjectAccessRecord {
  return {
    projectId: record.projectId,
    ownerUserId: record.ownerUserId
  };
}

export function createStoryProjectStoreError(
  code: StoryProjectStoreErrorCode,
  message: string,
  statusCode: number,
  retryable = false
): StoryProjectStoreError {
  return {
    code,
    message,
    statusCode,
    retryable
  };
}

export function successResult<T>(data: T): StoryProjectStoreResult<T> {
  return {
    success: true,
    data
  };
}

export function errorResult<T>(error: StoryProjectStoreError): StoryProjectStoreResult<T> {
  return {
    success: false,
    error
  };
}
