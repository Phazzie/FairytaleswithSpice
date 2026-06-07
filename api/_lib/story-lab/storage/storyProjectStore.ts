// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../auth/authPort';
import type { ProjectAccessRecord } from '../auth/authorizeProjectAccess';
import type { SavedStoryProject } from '../contracts';

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
    title: project.title || project.summary.title,
    synopsis: project.synopsis || project.summary.synopsis,
    createdAt: existingCreatedAt ?? project.createdAt ?? now,
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
    chapterCount: record.project.chapters.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
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
