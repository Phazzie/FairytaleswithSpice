// Created: 2026-06-08 08:28 EDT

import type { AuthPort, AuthUser } from '../auth/authPort';
import { isAuthError } from '../auth/authPort';
import { configuredAuthPort, resolveConfiguredAuthProviderName } from '../auth/configuredAuthPort';
import type {
  ApiResponse,
  CloudLibrarySyncState,
  CloudStoryProjectDeleteReceipt,
  CloudStoryProjectLoadResult,
  CloudStoryProjectList,
  CloudStoryProjectStorageMode,
  CloudStoryProjectSaveReceipt,
  SavedStoryProject,
  StoryLabAuthConfig,
  StoryLabLibrarySort,
  StoryLabUserProfile,
  StoryMemoryCard
} from '../contracts';
import { applyCorsPolicy } from '../../http/corsPolicy';
import { sendMethodNotAllowed } from '../../http/methodNotAllowed';
import { settleRequestCorrelationId } from '../../http/requestCorrelationId';
import { createDefaultStoryLabProfilePreferences } from '../profile/profileDefaults';
import {
  createDefaultStoryLabUserProfile,
  describeOversizedStoryLabProfileField,
  normalizeStoryLabProfilePreferences,
  StoryLabProfileStore,
  StoryLabProfileStoreError
} from '../profile/storyLabProfileStore';
import { createStoryLabCloudStorage } from '../storage/storyLabCloudStorageConfig';
import {
  sortStoryProjectListItems,
  STORY_LAB_LIBRARY_MAX_ITEMS,
  StoryProjectDeleteReceipt,
  StoryProjectListItem,
  StoryProjectStore,
  StoryProjectStoreError,
  StoredStoryProjectRecord
} from '../storage/storyProjectStore';

/**
 * What each resource behind this route file serves.
 *
 * One CORS policy covers the whole file — a preflight is answered before the
 * path is even read — but `Allow` is the *target resource*'s list, and these
 * four resources do not serve the same methods. `OPTIONS` is on every one of
 * them because `applyCorsPolicy` really does answer it for every path here.
 */
const ACCOUNT_ROUTE_CORS_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'];
const PROFILE_ROUTE_METHODS = ['GET', 'PUT', 'OPTIONS'];
const PROJECT_COLLECTION_ROUTE_METHODS = ['GET', 'POST', 'OPTIONS'];
const PROJECT_ITEM_ROUTE_METHODS = ['GET', 'DELETE', 'OPTIONS'];
const AUTH_CONFIG_ROUTE_METHODS = ['GET', 'OPTIONS'];

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
  env?: Record<string, string | undefined>;
}

type AccountResource = 'profile' | 'projects' | 'project' | 'auth-config';

interface AccountRouteTarget {
  resource: AccountResource;
  projectId?: string;
}

interface StoryLabAccountRouteContext {
  authPort: AuthPort;
  profileStore: StoryLabProfileStore;
  projectStore: StoryProjectStore;
  now: () => string;
  env: Record<string, string | undefined>;
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
    now,
    env: dependencies.env ?? process.env
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
  // Every path in this file is reached through here, on both deployments, so
  // this is the one place the id is settled — before the preflight branch, so
  // an `OPTIONS` answer carries it too. The return value is deliberately not
  // bound: this file writes no log lines today, and the id's whole job here is
  // to be the value a caller quotes for a request the platform's own logs
  // recorded. The first log line added to this file should take it from here
  // rather than reading the header again.
  settleRequestCorrelationId(req, res);

  const cors = applyCorsPolicy(req, res, {
    methods: ACCOUNT_ROUTE_CORS_METHODS,
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

  // Unlike every other resource here, this one exists to answer the question
  // "is there anything to sign in with" — so it has to be readable *before*
  // a caller can have a session to send. Gating it behind `requireAccountUser`
  // like the rest of this file would make it as unreachable as the feature it
  // reports on.
  if (target.resource === 'auth-config') {
    handleAuthConfigRoute(context, req, res);
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

    // The profile's free text is the only caller text this route stores
    // durably, and nothing measured it. Answered before the store is reached,
    // naming the field, so the caller is told what to shorten rather than
    // having a boundary they wrote silently kept at whatever length it arrived.
    const oversizedField = describeOversizedStoryLabProfileField(profile);
    if (oversizedField) {
      sendJson(res, 400, invalidRequest(oversizedField));
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

  sendMethodNotAllowed(res, PROFILE_ROUTE_METHODS, 'Profile routes support GET and PUT.');
}

async function handleProjectsRoute(
  context: StoryLabAccountRouteContext,
  user: AuthUser,
  req: RequestLike,
  res: ResponseLike
): Promise<void> {
  const method = normalizeMethod(req.method);

  if (method === 'GET') {
    // The ordering is the reader's and it goes *down* to the store, because the
    // cap belongs with the rows and a cap can only be applied under an
    // ordering. The Postgres adapter used to carry `order by updated_at desc
    // limit 50` in its own SQL while this route sorted whatever came back, so a
    // reader on `title_asc` was shown the alphabetical order of the fifty most
    // recently *updated* projects.
    const librarySort = await readLibrarySort(context, user);
    const listResult = await context.projectStore.listProjects(user, {
      sort: librarySort,
      limit: STORY_LAB_LIBRARY_MAX_ITEMS
    });
    if (listResult.success === false) {
      sendJson(res, listResult.error.statusCode, projectStoreErrorResponse(listResult.error));
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: toCloudProjectList(
        context,
        user,
        // Re-sorted here, over at most `STORY_LAB_LIBRARY_MAX_ITEMS` items, so
        // that the order a caller sees is always `sortStoryProjectListItems`'s
        // — SQL collation and `localeCompare` do not agree about accented
        // titles, and the store's clause decides only which rows the page
        // holds.
        sortStoryProjectListItems(listResult.data.items, librarySort),
        listResult.data.totalCount
      )
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

  sendMethodNotAllowed(res, PROJECT_COLLECTION_ROUTE_METHODS, 'Project collection routes support GET and POST.');
}

/**
 * The order this caller has asked their library to come back in.
 *
 * The preference lives on the profile rather than in the request, so the list
 * route has to read it — the client sends no sort and never has. A caller with
 * no saved profile gets the default the profile route would have answered them
 * with, which is the order the list already came back in.
 *
 * A profile store failure is not a list failure. The projects are the answer
 * here and the ordering is a preference about them, so a store that cannot be
 * read falls back to the default rather than turning a working library into a
 * `503` — the opposite of how `listProjects` above treats its own store, and
 * deliberately so.
 */
async function readLibrarySort(
  context: StoryLabAccountRouteContext,
  user: AuthUser
): Promise<StoryLabLibrarySort> {
  const defaultSort = createDefaultStoryLabProfilePreferences().librarySort;

  try {
    const loadResult = await context.profileStore.loadProfile(user);
    return loadResult.success === true
      ? loadResult.data?.profile.preferences.librarySort ?? defaultSort
      : defaultSort;
  } catch {
    return defaultSort;
  }
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

  sendMethodNotAllowed(res, PROJECT_ITEM_ROUTE_METHODS, 'Project item routes support GET and DELETE.');
}

/**
 * Reports `'clerk'` only when the whole chain a caller would need is present:
 * a provider actually selected, a publishable key the frontend can load
 * Clerk with, and a secret key the backend can verify a session against. Any
 * one of those missing reports `'none'` — the same inert state the frontend
 * already renders today — rather than a sign-in button pointed at a backend
 * that will 401 every session it is handed.
 */
function handleAuthConfigRoute(context: StoryLabAccountRouteContext, req: RequestLike, res: ResponseLike): void {
  const method = normalizeMethod(req.method);
  if (method !== 'GET') {
    sendMethodNotAllowed(res, AUTH_CONFIG_ROUTE_METHODS, 'Auth config routes support GET.');
    return;
  }

  sendJson(res, 200, {
    success: true,
    data: resolveStoryLabAuthConfig(context.env)
  } satisfies ApiResponse<StoryLabAuthConfig>);
}

function resolveStoryLabAuthConfig(env: Record<string, string | undefined>): StoryLabAuthConfig {
  const providerName = resolveConfiguredAuthProviderName({ env });
  const publishableKey = env['CLERK_PUBLISHABLE_KEY']?.trim();
  const hasSecretKey = Boolean(env['CLERK_SECRET_KEY']?.trim());

  if (providerName === 'clerk' && publishableKey && hasSecretKey) {
    return { provider: 'clerk', publishableKey };
  }

  return { provider: 'none' };
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
  const resource = readQueryValue(req.query?.['resource']);
  const projectId = readQueryValue(req.query?.['projectId']);

  if (resource === 'profile') {
    return { resource: 'profile' };
  }

  if (resource === 'projects') {
    return { resource: 'projects' };
  }

  if (resource === 'auth-config') {
    return { resource: 'auth-config' };
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

  if (pathname.endsWith('/api/story-lab/account/auth-config') || pathname.endsWith('/account/auth-config')) {
    return { resource: 'auth-config' };
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

  const userId = candidate['userId'];
  const displayName = candidate['displayName'];
  const createdAt = readOptionalString(candidate['createdAt']);
  const updatedAt = readOptionalString(candidate['updatedAt']);
  if (
    typeof userId !== 'string' ||
    !userId.trim() ||
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    !isObjectRecord(candidate['preferences']) ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    userId,
    displayName,
    preferences: normalizeStoryLabProfilePreferences(candidate['preferences']),
    createdAt: createdAt ?? '',
    updatedAt: updatedAt ?? ''
  };
}

/**
 * The project a save request is asking this account to store.
 *
 * Eight fields were checked here and the last five were written down as casts.
 * `chapters` got as far as `Array.isArray` and its entries were taken on trust;
 * `telemetry`, `continuityExtraction`, `pinnedMemoryCardDraftIds`, and
 * `acceptedMemoryCards` were not looked at at all. A cast is not a check, and
 * these arrive over the wire from whatever posted them.
 *
 * The Angular tree already knows this. `normalizePinnedMemoryCardDraftIds` and
 * `normalizeAcceptedMemoryCards` in `app.ts` are both declared over `unknown`
 * and both filter entry by entry — written for exactly two of the five fields
 * this route was casting, and run on the way *out* of a project this route let
 * in without looking. So the client defends itself against data its own server
 * accepted, which is the wrong half of the seam to be doing it on, and the one
 * reader that is not the Angular tree is not defended at all:
 * `toStoryProjectListItem` computes `acceptedMemoryCardCount` as
 * `acceptedMemoryCards?.length ?? 0`, so a project saved with
 * `"acceptedMemoryCards": "none"` is a library card reporting **four** memory
 * cards for a story that has none — `.length` of a string, counted and shown.
 *
 * Two rules, and the split is deliberate:
 *
 * - The story is refused, not repaired. `chapters` joins `summary`, `state`,
 *   and `blueprint`: a save whose chapter list holds something that is not a
 *   chapter is a `400`, because the alternative is storing the chapters that
 *   passed and silently dropping the ones that did not — and losing a chapter
 *   the caller believed they saved is worse than making them send it again.
 * - The annotations are filtered, not refused. The two memory-card fields and
 *   the two receipts are things said *about* the story, and refusing an entire
 *   novel over one malformed memory card would lose the story to save a note
 *   about it. A list keeps the entries that can be read and drops the rest,
 *   entry by entry, on the client's own rule; a value that is not a list at all
 *   is stored as absent, which is a state the field already has and every
 *   reader already handles — and which the client's normalizers turn back into
 *   `[]` on load, so the two sides agree where it shows.
 */
function readProjectFromBody(body: unknown): SavedStoryProject | null {
  if (!isObjectRecord(body)) {
    return null;
  }

  const candidate = readWrappedOrBareBodyRecord(body, 'project');
  if (!isObjectRecord(candidate)) {
    return null;
  }

  const projectId = normalizeProjectId(candidate['id']);
  const synopsis = readOptionalString(candidate['synopsis']);
  const createdAt = readOptionalString(candidate['createdAt']);
  const updatedAt = readOptionalString(candidate['updatedAt']);
  const chapters = readChapters(candidate['chapters']);
  if (
    !projectId ||
    !isNonBlankString(candidate['storyId']) ||
    !isNonBlankString(candidate['title']) ||
    synopsis === null ||
    createdAt === null ||
    updatedAt === null ||
    !isObjectRecord(candidate['summary']) ||
    !isObjectRecord(candidate['state']) ||
    !isObjectRecord(candidate['blueprint']) ||
    chapters === null
  ) {
    return null;
  }

  return {
    id: projectId,
    storyId: candidate['storyId'],
    title: candidate['title'],
    synopsis: synopsis ?? '',
    blueprint: candidate['blueprint'] as unknown as SavedStoryProject['blueprint'],
    summary: candidate['summary'] as unknown as SavedStoryProject['summary'],
    state: candidate['state'] as unknown as SavedStoryProject['state'],
    chapters,
    telemetry: readObjectRecordOrUndefined(candidate['telemetry']) as unknown as SavedStoryProject['telemetry'],
    continuityExtraction: readObjectRecordOrUndefined(
      candidate['continuityExtraction']
    ) as unknown as SavedStoryProject['continuityExtraction'],
    pinnedMemoryCardDraftIds: readMemoryCardDraftIds(candidate['pinnedMemoryCardDraftIds']),
    acceptedMemoryCards: readAcceptedMemoryCards(candidate['acceptedMemoryCards']),
    createdAt: createdAt ?? '',
    updatedAt: updatedAt ?? ''
  };
}

/**
 * The chapter list, or `null` when it is not one.
 *
 * The fields required are the ones readers dereference rather than every field
 * `GeneratedChapter` declares: `chapterId` selects the chapter in the Angular
 * tree, `chapterNumber` orders it, and `title` and `htmlContent` are what a
 * reader or an export is shown. Demanding all eight would refuse projects saved
 * by an earlier client over a field nothing reads, which is a worse trade than
 * the one this check exists to make.
 *
 * `null` rather than a filtered list: see `readProjectFromBody`. A chapter that
 * cannot be read is a refused save, not a shorter story.
 */
function readChapters(value: unknown): SavedStoryProject['chapters'] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const readable = value.every(chapter =>
    isObjectRecord(chapter)
    && isNonBlankString(chapter['chapterId'])
    && typeof chapter['chapterNumber'] === 'number'
    && typeof chapter['title'] === 'string'
    && typeof chapter['htmlContent'] === 'string');

  return readable ? (value as SavedStoryProject['chapters']) : null;
}

/**
 * An optional receipt: the object it claims to be, or nothing.
 *
 * `telemetry` and `continuityExtraction` are both optional on the project, so a
 * value that is not an object record is dropped to `undefined` — which is what
 * the field already means when the caller omits it, and what every reader of
 * either one already handles.
 */
function readObjectRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return isObjectRecord(value) ? value : undefined;
}

/**
 * The pinned draft ids, filtered the way the client filters them on load.
 *
 * Deliberately the same rule as `normalizePinnedMemoryCardDraftIds` in `app.ts`
 * — non-blank strings, everything else dropped — because a save and the load
 * that follows it disagreeing about which ids are real is the one outcome
 * neither side can detect.
 */
function readMemoryCardDraftIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((id): id is string => isNonBlankString(id));
}

/**
 * The accepted memory cards, filtered the way the client filters them on load.
 *
 * The six required fields are `normalizeAcceptedMemoryCards`'s six in `app.ts`,
 * for the same reason as the ids above. This is also the field
 * `toStoryProjectListItem` counts with a bare `.length`, so what survives here
 * is what the library card reports.
 */
function readAcceptedMemoryCards(value: unknown): SavedStoryProject['acceptedMemoryCards'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((card): card is StoryMemoryCard =>
    isObjectRecord(card)
    && typeof card['id'] === 'string'
    && typeof card['label'] === 'string'
    && typeof card['title'] === 'string'
    && typeof card['detail'] === 'string'
    && typeof card['triggerLabel'] === 'string'
    && typeof card['acceptedAt'] === 'string');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readWrappedOrBareBodyRecord(body: Record<string, unknown>, key: string): unknown {
  return Object.keys(body).includes(key) ? body[key] : body;
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
  projects: StoryProjectListItem[],
  totalProjectCount: number
): CloudStoryProjectList {
  return {
    ownerUserId: user.userId,
    storageMode: toCloudStorageMode(context.projectStore),
    projects,
    totalProjectCount
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

/**
 * Every answer this route file sends, typed as the envelope it is.
 *
 * The parameter was a bare `T`, so nothing checked that a body handed to it was
 * an `ApiResponse` at all — which is the one property every caller of this API
 * relies on and the one a changed response shape can quietly lose. Adding a
 * required field to `CloudStoryProjectList` is exactly that kind of change:
 * the literal below builds the payload by hand, and an unconstrained `T`
 * accepts whatever it happens to be.
 *
 * Constraining the helper rather than annotating one call site is what makes it
 * a rule about this file's answers instead of a note on the one that was
 * changed last.
 */
function sendJson<T>(res: ResponseLike, statusCode: number, body: ApiResponse<T>): void {
  res.status(statusCode).json(body);
}

function readQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeMethod(method: string | undefined): string {
  return (method ?? '').toUpperCase();
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
