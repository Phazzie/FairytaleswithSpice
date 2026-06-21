// Created: 2026-06-08 08:28 EDT

import type { AuthPort, AuthUser } from '../auth/authPort';
import { isAuthError } from '../auth/authPort';
import { configuredAuthPort } from '../auth/configuredAuthPort';
import type {
  ApiResponse,
  CloudLibrarySyncState,
  CloudStoryProjectDeleteReceipt,
  CloudStoryProjectLoadResult,
  CloudStoryProjectList,
  CloudStoryProjectStorageMode,
  CloudStoryProjectSaveReceipt,
  SavedStoryProject,
  StoryLabUserProfile
} from '../contracts';
import { applyCorsPolicy } from '../../http/corsPolicy';
import {
  createDefaultStoryLabUserProfile,
  normalizeStoryLabProfilePreferences,
  StoryLabProfileStore,
  StoryLabProfileStoreError
} from '../profile/storyLabProfileStore';
import { createStoryLabCloudStorage } from '../storage/storyLabCloudStorageConfig';
import {
  StoryProjectDeleteReceipt,
  StoryProjectListItem,
  StoryProjectStore,
  StoryProjectStoreError,
  StoredStoryProjectRecord
} from '../storage/storyProjectStore';

type RequestValue = string | string[] | undefined;

interface RequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, RequestValue>;
  url?: string;
  headers?: Record<string, RequestValue>;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
  end?(): void;
}

export interface StoryLabAccountRouteDependencies {
  authPort?: AuthPort;
  profileStore?: StoryLabProfileStore;
  projectStore?: StoryProjectStore;
  now?: () => string;
}

type AccountResource = 'profile' | 'projects' | 'project';

interface AccountRouteTarget {
  resource: AccountResource;
  projectId?: string;
}

interface StoryLabAccountRouteContext {
  authPort: AuthPort;
  profileStore: StoryLabProfileStore;
  projectStore: StoryProjectStore;
  now: () => string;
}

const MAX_PROJECT_ID_LENGTH = 128;
const PROJECT_ID_ROUTE_PATTERN = /\/account\/projects\/([^/]+)$/;

export function createStoryLabAccountRouteHandler(
  dependencies: StoryLabAccountRouteDependencies = {}
): (req: RequestLike, res: ResponseLike) => Promise<void> {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const cloudStorage = createStoryLabCloudStorage({ now });
  const context: StoryLabAccountRouteContext = {
    authPort: dependencies.authPort ?? configuredAuthPort,
    profileStore: dependencies.profileStore ?? cloudStorage.profileStore,
    projectStore: dependencies.projectStore ?? cloudStorage.projectStore,
    now
  };

  return async function storyLabAccountRouteHandler(req: RequestLike, res: ResponseLike): Promise<void> {
    await handleStoryLabAccountRouteWithContext(context, req, res);
  };
}

export const handleStoryLabAccountRoute = createStoryLabAccountRouteHandler();

async function handleStoryLabAccountRouteWithContext(
  context: StoryLabAccountRouteContext,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  const target = readAccountRouteTarget(req);
  if (!target) {
    sendJson(res, 404, accountRouteNotFound());
    return;
  }

  const user = await requireAccountUser(context.authPort, req, res);
  if (!user) {
    return;
  }

  if (target.resource === 'profile') {
    await handleProfileRoute(context, user, req, res);
    return;
  }

  if (target.resource === 'projects') {
    await handleProjectsRoute(context, user, req, res);
    return;
  }

  await handleProjectRoute(context, user, target.projectId ?? '', req, res);
}

async function handleProfileRoute(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  const method = normalizeMethod(req.method);

  if (method === 'GET') {
    const loadResult = await context.profileStore.loadProfile(user);
    if (loadResult.success === false) {
      sendJson(res, loadResult.error.statusCode, profileStoreErrorResponse(loadResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: loadResult.data?.profile ?? createDefaultStoryLabUserProfile(user, { now: context.now() })
    });
    return;
  }

  if (method === 'PUT') {
    const profile = readProfileFromBody(req.body);
    if (!profile) {
      sendJson(res, 400, invalidRequest('Profile requests must include a Story Lab profile object.'));
      return;
    }

    if (profile.userId !== user.userId) {
      sendJson(res, 403, profileForbidden());
      return;
    }

    const saveResult = await context.profileStore.saveProfile(user, profile);
    if (saveResult.success === false) {
      sendJson(res, saveResult.error.statusCode, profileStoreErrorResponse(saveResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: saveResult.data.profile
    });
    return;
  }

  sendJson(res, 405, methodNotAllowed('Profile routes support GET and PUT.'));
}

async function handleProjectsRoute(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  const method = normalizeMethod(req.method);

  if (method === 'GET') {
    const listResult = await context.projectStore.listProjects(user);
    if (listResult.success === false) {
      sendJson(res, listResult.error.statusCode, projectStoreErrorResponse(listResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: toCloudProjectList(context, user, listResult.data)
    });
    return;
  }

  if (method === 'POST') {
    const project = readProjectFromBody(req.body);
    if (!project) {
      sendJson(res, 400, invalidRequest('Project save requests must include a Story Lab project object.'));
      return;
    }

    const saveResult = await context.projectStore.saveProject(user, project);
    if (saveResult.success === false) {
      sendJson(res, saveResult.error.statusCode, projectStoreErrorResponse(saveResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: toCloudSaveReceipt(context, saveResult.data)
    });
    return;
  }

  sendJson(res, 405, methodNotAllowed('Project collection routes support GET and POST.'));
}

async function handleProjectRoute(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  projectId: string,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    sendJson(res, 400, invalidRequest('Project id is required.'));
    return;
  }

  const method = normalizeMethod(req.method);

  if (method === 'GET') {
    const loadResult = await context.projectStore.loadProject(user, normalizedProjectId);
    if (loadResult.success === false) {
      sendJson(res, loadResult.error.statusCode, projectStoreErrorResponse(loadResult.error));
      return;
    }

    if (!loadResult.data) {
      sendJson(res, 404, projectNotFound());
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: toCloudProjectLoadResult(context, user, loadResult.data)
    });
    return;
  }

  if (method === 'DELETE') {
    const deleteResult = await context.projectStore.deleteProject(user, normalizedProjectId);
    if (deleteResult.success === false) {
      sendJson(res, deleteResult.error.statusCode, projectStoreErrorResponse(deleteResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: toCloudDeleteReceipt(context, user, deleteResult.data)
    });
    return;
  }

  sendJson(res, 405, methodNotAllowed('Project item routes support GET and DELETE.'));
}

async function requireAccountUser(authPort: AuthPort, req: RequestLike, res: ResponseLike): Promise<AuthUser | null> {
  try {
    return await authPort.requireUser(req);
  } catch (error) {
    if (isAuthError(error)) {
      sendJson(res, error.statusCode, {
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
      return null;
    }

    sendJson(res, 401, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Account authentication is required.'
      }
    });
    return null;
  }
}

function readAccountRouteTarget(req: RequestLike): AccountRouteTarget | null {
  const resource = readQueryValue(req.query?.resource);
  const projectId = readQueryValue(req.query?.projectId);

  if (resource === 'profile') {
    return { resource: 'profile' };
  }

  if (resource === 'projects') {
    return { resource: 'projects' };
  }

  if (resource === 'project') {
    return {
      resource: 'project',
      projectId: projectId ?? readProjectIdFromUrl(req.url)
    };
  }

  return readAccountRouteTargetFromUrl(req.url);
}

function readAccountRouteTargetFromUrl(url: string | undefined): AccountRouteTarget | null {
  const pathname = url?.split('?')[0] ?? '';

  if (pathname.endsWith('/api/story-lab/account/profile') || pathname.endsWith('/account/profile')) {
    return { resource: 'profile' };
  }

  if (pathname.endsWith('/api/story-lab/account/projects') || pathname.endsWith('/account/projects')) {
    return { resource: 'projects' };
  }

  const projectId = readProjectIdFromUrl(url);
  if (projectId) {
    return {
      resource: 'project',
      projectId
    };
  }

  return null;
}

function readProjectIdFromUrl(url: string | undefined): string | undefined {
  const pathname = url?.split('?')[0] ?? '';
  const match = PROJECT_ID_ROUTE_PATTERN.exec(pathname);
  if (!match) {
    return undefined;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function readProfileFromBody(body: unknown): StoryLabUserProfile | null {
  if (!isObjectRecord(body)) {
    return null;
  }

  const candidate = readWrappedOrBareBodyRecord(body, 'profile');
  if (!isObjectRecord(candidate)) {
    return null;
  }

  const userId = candidate.userId;
  const displayName = candidate.displayName;
  const createdAt = readOptionalString(candidate.createdAt);
  const updatedAt = readOptionalString(candidate.updatedAt);
  if (
    typeof userId !== 'string' ||
    !userId.trim() ||
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    !isObjectRecord(candidate.preferences) ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    userId,
    displayName,
    preferences: normalizeStoryLabProfilePreferences(candidate.preferences),
    createdAt: createdAt ?? '',
    updatedAt: updatedAt ?? ''
  };
}

function readProjectFromBody(body: unknown): SavedStoryProject | null {
  if (!isObjectRecord(body)) {
    return null;
  }

  const candidate = readWrappedOrBareBodyRecord(body, 'project');
  if (!isObjectRecord(candidate)) {
    return null;
  }

  const projectId = normalizeProjectId(candidate.id);
  const synopsis = readOptionalString(candidate.synopsis);
  const createdAt = readOptionalString(candidate.createdAt);
  const updatedAt = readOptionalString(candidate.updatedAt);
  if (
    !projectId ||
    !isNonBlankString(candidate.storyId) ||
    !isNonBlankString(candidate.title) ||
    synopsis === null ||
    createdAt === null ||
    updatedAt === null ||
    !isObjectRecord(candidate.summary) ||
    !isObjectRecord(candidate.state) ||
    !isObjectRecord(candidate.blueprint) ||
    !Array.isArray(candidate.chapters)
  ) {
    return null;
  }

  return {
    id: projectId,
    storyId: candidate.storyId,
    title: candidate.title,
    synopsis: synopsis ?? '',
    blueprint: candidate.blueprint as unknown as SavedStoryProject['blueprint'],
    summary: candidate.summary as unknown as SavedStoryProject['summary'],
    state: candidate.state as unknown as SavedStoryProject['state'],
    chapters: candidate.chapters as SavedStoryProject['chapters'],
    telemetry: candidate.telemetry as SavedStoryProject['telemetry'],
    continuityExtraction: candidate.continuityExtraction as SavedStoryProject['continuityExtraction'],
    pinnedMemoryCardDraftIds: candidate.pinnedMemoryCardDraftIds as SavedStoryProject['pinnedMemoryCardDraftIds'],
    acceptedMemoryCards: candidate.acceptedMemoryCards as SavedStoryProject['acceptedMemoryCards'],
    createdAt: createdAt ?? '',
    updatedAt: updatedAt ?? ''
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readWrappedOrBareBodyRecord(body: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : body;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === 'string' ? value : null;
}

function normalizeProjectId(projectId: unknown): string | null {
  if (typeof projectId !== 'string') {
    return null;
  }

  const trimmed = projectId.trim();
  if (
    !trimmed ||
    trimmed !== projectId ||
    trimmed.length > MAX_PROJECT_ID_LENGTH ||
    /[\\/?#%\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function toCloudProjectList(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  projects: StoryProjectListItem[]
): CloudStoryProjectList {
  return {
    ownerUserId: user.userId,
    storageMode: toCloudStorageMode(context.projectStore),
    projects
  };
}

function toCloudSaveReceipt(
  context: StoryLabAccountRouteContext,
  record: StoredStoryProjectRecord
): CloudStoryProjectSaveReceipt {
  return {
    projectId: record.projectId,
    storyId: record.storyId,
    savedAt: record.updatedAt,
    syncState: buildSyncState(context)
  };
}

function toCloudProjectLoadResult(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  record: StoredStoryProjectRecord
): CloudStoryProjectLoadResult {
  return {
    ownerUserId: user.userId,
    storageMode: toCloudStorageMode(context.projectStore),
    projectId: record.projectId,
    storyId: record.storyId,
    project: record.project,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toCloudDeleteReceipt(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  receipt: StoryProjectDeleteReceipt
): CloudStoryProjectDeleteReceipt {
  return {
    ownerUserId: user.userId,
    storageMode: toCloudStorageMode(context.projectStore),
    projectId: receipt.projectId,
    deleted: receipt.deleted
  };
}

function toCloudStorageMode(projectStore: StoryProjectStore): CloudStoryProjectStorageMode {
  return projectStore.mode === 'postgres' ? 'cloud_postgres' : 'non_durable_memory';
}

function buildSyncState(context: StoryLabAccountRouteContext): CloudLibrarySyncState {
  if (!context.projectStore.durable) {
    return {
      mode: 'cloud_unavailable',
      message: 'Story Lab cloud storage is using non-durable local memory.'
    };
  }

  return {
    mode: 'cloud_synced',
    lastSyncedAt: context.now()
  };
}

function projectStoreErrorResponse(error: StoryProjectStoreError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: projectStorePublicMessage(error)
    }
  };
}

function profileStoreErrorResponse(error: StoryLabProfileStoreError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: profileStorePublicMessage(error)
    }
  };
}

function projectStorePublicMessage(error: StoryProjectStoreError): string {
  switch (error.code) {
    case 'STORY_LAB_STORAGE_UNCONFIGURED':
      return 'Story Lab cloud storage is not configured.';
    case 'STORY_LAB_STORAGE_DRIVER_MISSING':
      return 'Story Lab cloud storage driver is not configured.';
    case 'STORY_LAB_PROJECT_NOT_FOUND':
      return 'Story Lab project was not found.';
    case 'STORY_LAB_PROJECT_FORBIDDEN':
      return 'You do not have access to this Story Lab project.';
    case 'STORY_LAB_STORAGE_ERROR':
    default:
      return 'Story Lab cloud storage failed.';
  }
}

function profileStorePublicMessage(error: StoryLabProfileStoreError): string {
  switch (error.code) {
    case 'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED':
      return 'Story Lab profile storage is not configured.';
    case 'STORY_LAB_PROFILE_STORAGE_DRIVER_MISSING':
      return 'Story Lab profile storage driver is not configured.';
    case 'STORY_LAB_PROFILE_NOT_FOUND':
      return 'Story Lab profile was not found.';
    case 'STORY_LAB_PROFILE_FORBIDDEN':
      return 'You do not have access to this Story Lab profile.';
    case 'STORY_LAB_PROFILE_STORAGE_ERROR':
    default:
      return 'Story Lab profile storage failed.';
  }
}

function sendJson<T>(res: ResponseLike, statusCode: number, body: T): void {
  res.status(statusCode).json(body);
}

function readQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeMethod(method: string | undefined): string {
  return (method ?? '').toUpperCase();
}

function methodNotAllowed(message: string): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message
    }
  };
}

function invalidRequest(message: string): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'INVALID_REQUEST',
      message
    }
  };
}

function accountRouteNotFound(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'ACCOUNT_ROUTE_NOT_FOUND',
      message: 'Story Lab account route was not found.'
    }
  };
}

function projectNotFound(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'PROJECT_NOT_FOUND',
      message: 'Story Lab project was not found.'
    }
  };
}

function profileForbidden(): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'STORY_LAB_PROFILE_FORBIDDEN',
      message: 'You do not have access to this Story Lab profile.'
    }
  };
}
