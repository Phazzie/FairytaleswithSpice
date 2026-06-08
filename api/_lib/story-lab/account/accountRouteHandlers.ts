// Created: 2026-06-08 08:28 EDT

import type { AuthPort, AuthUser } from '../auth/authPort';
import { isAuthError } from '../auth/authPort';
import { configuredAuthPort } from '../auth/configuredAuthPort';
import type {
  ApiResponse,
  CloudLibrarySyncState,
  CloudStoryProjectList,
  CloudStoryProjectLoadResult,
  CloudStoryProjectSaveReceipt,
  SavedStoryProject,
  StoryLabUserProfile
} from '../contracts';
import { applyCorsPolicy } from '../../http/corsPolicy';
import { createPostgresStoryLabProfileStore } from '../profile/postgresStoryLabProfileStore';
import {
  createDefaultStoryLabUserProfile,
  StoryLabProfileStore,
  StoryLabProfileStoreError
} from '../profile/storyLabProfileStore';
import { createPostgresStoryProjectStore } from '../storage/postgresStoryProjectStore';
import {
  StoryProjectListItem,
  StoryProjectStore,
  StoryProjectStoreError,
  StoredStoryProjectRecord
} from '../storage/storyProjectStore';

interface RequestLike {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
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

export function createStoryLabAccountRouteHandler(
  dependencies: StoryLabAccountRouteDependencies = {}
): (req: RequestLike, res: ResponseLike) => Promise<void> {
  const context: StoryLabAccountRouteContext = {
    authPort: dependencies.authPort ?? configuredAuthPort,
    profileStore: dependencies.profileStore ?? createPostgresStoryLabProfileStore(),
    projectStore: dependencies.projectStore ?? createPostgresStoryProjectStore(),
    now: dependencies.now ?? (() => new Date().toISOString())
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
      data: toCloudProjectList(user, listResult.data)
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
  if (!projectId) {
    sendJson(res, 400, invalidRequest('Project id is required.'));
    return;
  }

  const method = normalizeMethod(req.method);

  if (method === 'GET') {
    const loadResult = await context.projectStore.loadProject(user, projectId);
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
      data: toCloudProjectLoadResult(user, loadResult.data)
    });
    return;
  }

  if (method === 'DELETE') {
    const deleteResult = await context.projectStore.deleteProject(user, projectId);
    if (deleteResult.success === false) {
      sendJson(res, deleteResult.error.statusCode, projectStoreErrorResponse(deleteResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: deleteResult.data
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
  const match = /\/account\/projects\/([^/]+)$/.exec(pathname);
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const candidate = 'profile' in body ? (body as { profile?: unknown }).profile : body;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const profile = candidate as Partial<StoryLabUserProfile>;
  if (typeof profile.userId !== 'string' || typeof profile.displayName !== 'string' || !profile.preferences) {
    return null;
  }

  return profile as StoryLabUserProfile;
}

function readProjectFromBody(body: unknown): SavedStoryProject | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const candidate = 'project' in body ? (body as { project?: unknown }).project : body;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const project = candidate as Partial<SavedStoryProject>;
  if (typeof project.id !== 'string' || typeof project.storyId !== 'string' || typeof project.title !== 'string') {
    return null;
  }

  return project as SavedStoryProject;
}

function toCloudProjectList(user: AuthUser, projects: StoryProjectListItem[]): CloudStoryProjectList {
  return {
    ownerUserId: user.userId,
    storageMode: 'cloud_postgres',
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
  user: AuthUser,
  record: StoredStoryProjectRecord
): CloudStoryProjectLoadResult {
  return {
    ownerUserId: user.userId,
    storageMode: 'cloud_postgres',
    projectId: record.projectId,
    storyId: record.storyId,
    project: record.project,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
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
      message: error.message
    }
  };
}

function profileStoreErrorResponse(error: StoryLabProfileStoreError): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message
    }
  };
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
