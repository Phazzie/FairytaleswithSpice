#!/usr/bin/env tsx
// Created: 2026-06-08 08:20 EDT

import { readFileSync } from 'node:fs';
import accountHandler from '../api/story-lab/account';
import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createStoryLabAccountRouteHandler } from '../api/_lib/story-lab/account/accountRouteHandlers';
import { createNonDurableInMemoryStoryLabProfileStore } from '../api/_lib/story-lab/profile/inMemoryStoryLabProfileStore';
import { createDefaultStoryLabUserProfile } from '../api/_lib/story-lab/profile/storyLabProfileStore';
import { createNonDurableInMemoryStoryProjectStore } from '../api/_lib/story-lab/storage/inMemoryStoryProjectStore';
import { createPostgresStoryLabProfileStore } from '../api/_lib/story-lab/profile/postgresStoryLabProfileStore';
import { createPostgresStoryProjectStore } from '../api/_lib/story-lab/storage/postgresStoryProjectStore';
import type {
  StoredStoryProjectRecord,
  StoryProjectDeleteReceipt,
  StoryProjectListItem,
  StoryProjectStore,
  StoryProjectStoreResult
} from '../api/_lib/story-lab/storage/storyProjectStore';
import type { SavedStoryProject } from '../story-generator/src/app/contracts';
import { createSavedStoryProjectFixture } from './story-lab-test-fixtures';

interface FakeRequest {
  method: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  end(): void {
    this.ended = true;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const owner: AuthUser = {
  userId: 'user-owner',
  email: 'owner@example.com'
};
const otherUser: AuthUser = {
  userId: 'user-other',
  email: 'other@example.com'
};
const now = '2026-06-08T08:20:00.000Z';
const privateStoryText = 'The private chapel oath belongs only to Avery.';

async function main() {
  testVercelConfigDoesNotSetWildcardApiCors();
  await testDefaultAccountRouteFailsClosedWithoutAuthProvider();
  await testOptionsCorsPreflightUsesCredentialedPolicy();
  await testDisallowedCorsOriginFailsClosed();
  await testProfileReadWriteUsesAuthenticatedOwner();
  await testProfileCrossOwnerSaveIsForbidden();
  await testMalformedProfileBodyFailsClosed();
  await testProjectSaveListLoadDeleteUsesAuthenticatedOwner();
  await testProjectCrossOwnerReadIsForbidden();
  await testMissingStorageConfigFailsClosed();
  await testMalformedProjectIdFailsClosed();
  await testInvalidProjectIdsFailClosedBeforeStoreAccess();
  await testInvalidProjectBodyFailsClosedBeforeStoreAccess();
  await testInjectedStoreErrorMessageIsSanitized();
  await testInvalidRouteAndMethodResponses();

  console.log('Story Lab account route tests passed');
}

function testVercelConfigDoesNotSetWildcardApiCors() {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    headers?: {
      source?: string;
      headers?: { key?: string; value?: string }[];
    }[];
  };
  const wildcardApiCors = (config.headers ?? []).some(entry =>
    entry.source === '/api/(.*)' &&
    (entry.headers ?? []).some(header =>
      header.key?.toLowerCase() === 'access-control-allow-origin' && header.value === '*'
    )
  );

  assert(!wildcardApiCors, 'vercel.json should not set wildcard CORS for private-capable API routes');
}

async function testDefaultAccountRouteFailsClosedWithoutAuthProvider() {
  const response = new FakeResponse();
  await accountHandler(createRequest('GET', 'profile', undefined, undefined, {
    authorization: 'Bearer raw-provider-token'
  }), response);

  assert(response.statusCode === 401, 'default account route should require configured auth');
  const body = response.body as any;
  assert(body.success === false, 'missing auth should use failure envelope');
  assert(body.error.code === 'UNAUTHORIZED', 'missing auth should return UNAUTHORIZED');
  assert(!body.error.message.includes('raw-provider-token'), 'auth failure should not echo raw bearer tokens');
}

async function testOptionsCorsPreflightUsesCredentialedPolicy() {
  const handler = createTestHandler(owner);
  const response = new FakeResponse();
  await handler(createRequest('OPTIONS', 'profile', undefined, undefined, {
    origin: 'http://localhost:4200'
  }), response);

  assert(response.statusCode === 200, 'OPTIONS should be handled by CORS policy');
  assert(response.headers['Access-Control-Allow-Credentials'] === 'true', 'account route should allow credentials');
  assert(response.headers['Access-Control-Allow-Origin'] === 'http://localhost:4200', 'known local origin should be allowed');
  assert(response.headers['Access-Control-Allow-Origin'] !== '*', 'account route should not emit wildcard CORS');
}

async function testDisallowedCorsOriginFailsClosed() {
  const handler = createTestHandler(owner);
  const response = new FakeResponse();
  await handler(createRequest('GET', 'profile', undefined, undefined, {
    origin: 'https://evil.example'
  }), response);

  assert(response.statusCode === 403, 'disallowed account origin should return 403');
  const body = response.body as any;
  assert(body.error.code === 'ORIGIN_NOT_ALLOWED', 'disallowed account origin should use CORS error code');
  assert(response.headers['Access-Control-Allow-Origin'] !== '*', 'disallowed account origin should not emit wildcard CORS');
}

async function testProfileReadWriteUsesAuthenticatedOwner() {
  const handler = createTestHandler(owner);

  const initialResponse = new FakeResponse();
  await handler(createRequest('GET', 'profile'), initialResponse);
  assert(initialResponse.statusCode === 200, 'missing profile should return default profile');
  const initialBody = initialResponse.body as any;
  assert(initialBody.data.userId === owner.userId, 'default profile should use authenticated owner id');
  assert(initialBody.data.preferences.librarySort === 'updated_desc', 'default profile should include default preferences');

  const profile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });
  profile.preferences.contentBoundaries = 'No humiliation.';

  const saveResponse = new FakeResponse();
  await handler(createRequest('PUT', 'profile', { profile }), saveResponse);
  assert(saveResponse.statusCode === 200, 'profile save should return 200');
  const saveBody = saveResponse.body as any;
  assert(saveBody.data.displayName === 'Avery', 'profile save should return saved profile');
  assert(saveBody.data.preferences.contentBoundaries === 'No humiliation.', 'profile save should preserve preferences');

  const loadResponse = new FakeResponse();
  await handler(createRequest('GET', 'profile'), loadResponse);
  const loadBody = loadResponse.body as any;
  assert(loadBody.data.displayName === 'Avery', 'profile load should return persisted profile');
}

async function testProfileCrossOwnerSaveIsForbidden() {
  const handler = createTestHandler(otherUser);
  const ownerProfile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });

  const response = new FakeResponse();
  await handler(createRequest('PUT', 'profile', { profile: ownerProfile }), response);

  assert(response.statusCode === 403, 'cross-owner profile save should return 403');
  const body = response.body as any;
  assert(body.error.code === 'STORY_LAB_PROFILE_FORBIDDEN', 'cross-owner profile save should be forbidden');
  assert(!body.error.message.includes(owner.email ?? ''), 'cross-owner profile error should not leak owner email');
}

async function testMalformedProfileBodyFailsClosed() {
  const handler = createTestHandler(owner);
  const response = new FakeResponse();
  await handler(createRequest('PUT', 'profile', {
    profile: {
      userId: owner.userId,
      displayName: 'Avery',
      preferences: 'not-a-profile-preferences-object'
    }
  }), response);

  assert(response.statusCode === 400, 'profile save with malformed preferences should return 400');
  const body = response.body as any;
  assert(body.error.code === 'INVALID_REQUEST', 'malformed profile body should use invalid request code');
  assert(!body.error.message.includes(owner.email ?? ''), 'malformed profile body error should not leak user email');
}

async function testProjectSaveListLoadDeleteUsesAuthenticatedOwner() {
  const handler = createTestHandler(owner);
  const project = createProject();

  const saveResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', { project }), saveResponse);
  assert(saveResponse.statusCode === 200, 'project save should return 200');
  const saveBody = saveResponse.body as any;
  assert(saveBody.data.projectId === project.id, 'save receipt should expose project id');
  assert(saveBody.data.syncState.mode === 'cloud_unavailable', 'non-durable test store should not claim cloud sync');

  const listResponse = new FakeResponse();
  await handler(createRequest('GET', 'projects'), listResponse);
  assert(listResponse.statusCode === 200, 'project list should return 200');
  const listBody = listResponse.body as any;
  assert(listBody.data.ownerUserId === owner.userId, 'project list should carry owner id');
  assert(
    listBody.data.storageMode === 'non_durable_memory',
    'non-durable project list should not claim cloud Postgres storage'
  );
  assert(listBody.data.projects.length === 1, 'owner should see saved project');
  assert(listBody.data.projects[0].title === project.title, 'list item should carry project title');

  const loadResponse = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, project.id), loadResponse);
  assert(loadResponse.statusCode === 200, 'project load should return 200');
  const loadBody = loadResponse.body as any;
  assert(loadBody.success === true, 'project load should use success envelope');
  assert(
    loadBody.data.storageMode === 'non_durable_memory',
    'non-durable project load should not claim cloud Postgres storage'
  );
  assert(loadBody.data.project.id === project.id, 'project load should return saved project');

  const deleteResponse = new FakeResponse();
  await handler(createRequest('DELETE', 'project', undefined, project.id), deleteResponse);
  assert(deleteResponse.statusCode === 200, 'project delete should return 200');
  const deleteBody = deleteResponse.body as any;
  assert(deleteBody.data.deleted, 'project delete should report deleted');
}

async function testProjectCrossOwnerReadIsForbidden() {
  const profileStore = createNonDurableInMemoryStoryLabProfileStore({ now: () => now });
  const projectStore = createNonDurableInMemoryStoryProjectStore({ now: () => now });
  const ownerHandler = createHandlerFor(owner, profileStore, projectStore);
  const otherHandler = createHandlerFor(otherUser, profileStore, projectStore);
  const project = createProject();

  const saveResponse = new FakeResponse();
  await ownerHandler(createRequest('POST', 'projects', { project }), saveResponse);
  assert(saveResponse.statusCode === 200, 'owner save should return 200 before cross-owner read');

  const otherLoadResponse = new FakeResponse();
  await otherHandler(createRequest('GET', 'project', undefined, project.id), otherLoadResponse);

  assert(otherLoadResponse.statusCode === 403, 'cross-owner project read should return 403');
  const body = otherLoadResponse.body as any;
  assert(body.error.code === 'STORY_LAB_PROJECT_FORBIDDEN', 'cross-owner project read should be forbidden');
  assert(!body.error.message.includes(privateStoryText), 'cross-owner project error should not leak private story text');
}

async function testMissingStorageConfigFailsClosed() {
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  delete process.env['DATABASE_URL'];

  try {
    const handler = createStoryLabAccountRouteHandler({
      authPort: createStaticAuthPort(owner),
      profileStore: createPostgresStoryLabProfileStore({ now: () => now }),
      projectStore: createPostgresStoryProjectStore({ now: () => now }),
      now: () => now
    });

    const profileResponse = new FakeResponse();
    await handler(createRequest('GET', 'profile'), profileResponse);
    assert(profileResponse.statusCode === 503, 'missing profile storage should return 503');
    assert((profileResponse.body as any).error.code === 'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED', 'profile route should expose typed storage config error');

    const projectsResponse = new FakeResponse();
    await handler(createRequest('GET', 'projects'), projectsResponse);
    assert(projectsResponse.statusCode === 503, 'missing project storage should return 503');
    assert((projectsResponse.body as any).error.code === 'STORY_LAB_STORAGE_UNCONFIGURED', 'project route should expose typed storage config error');
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testMalformedProjectIdFailsClosed() {
  const handler = createTestHandler(owner);
  const response = new FakeResponse();
  await handler({
    method: 'GET',
    query: {
      resource: 'project'
    },
    url: '/api/story-lab/account/projects/%E0%A4%A',
    headers: {}
  }, response);

  assert(response.statusCode === 400, 'malformed project id should return 400');
  const body = response.body as any;
  assert(body.success === false, 'malformed project id should use failure envelope');
  assert(body.error.code === 'INVALID_REQUEST', 'malformed project id should use invalid request code');
  assert(!body.error.message.includes(privateStoryText), 'malformed project id error should not leak story text');
}

async function testInvalidProjectIdsFailClosedBeforeStoreAccess() {
  const handler = createTestHandler(owner);
  const invalidProjectIds = [
    ' project-account-1',
    'project-account-1 ',
    'project/account-1',
    'project\\account-1',
    'project%account-1',
    `project-${'\u0001'}`,
    'p'.repeat(129)
  ];

  for (const projectId of invalidProjectIds) {
    const response = new FakeResponse();
    await handler(createRequest('GET', 'project', undefined, projectId), response);
    assert(response.statusCode === 400, `invalid project id should return 400: ${JSON.stringify(projectId)}`);
    const body = response.body as any;
    assert(body.error.code === 'INVALID_REQUEST', 'invalid project id should use invalid request code');
    assert(!body.error.message.includes(privateStoryText), 'invalid project id error should not leak story text');
  }
}

async function testInvalidProjectBodyFailsClosedBeforeStoreAccess() {
  const handler = createTestHandler(owner);
  const response = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: {
      id: 'project-account-1',
      storyId: 'story-account-1',
      title: 'Missing required saved-project fields'
    }
  }), response);

  assert(response.statusCode === 400, 'project save with incomplete project body should return 400');
  const body = response.body as any;
  assert(body.error.code === 'INVALID_REQUEST', 'project save with incomplete body should use invalid request code');
  assert(!body.error.message.includes(privateStoryText), 'invalid project body error should not leak story text');
}

async function testInjectedStoreErrorMessageIsSanitized() {
  const profileStore = createNonDurableInMemoryStoryLabProfileStore({ now: () => now });
  const handler = createHandlerFor(owner, profileStore, createLeakyProjectStore());
  const response = new FakeResponse();

  await handler(createRequest('GET', 'projects'), response);

  assert(response.statusCode === 500, 'injected project store failure should use store status code');
  const body = response.body as any;
  assert(body.error.code === 'STORY_LAB_STORAGE_ERROR', 'injected project store failure should preserve typed code');
  assert(!body.error.message.includes(privateStoryText), 'route should not echo private injected-store errors');
  assert(!body.error.message.includes(owner.email ?? ''), 'route should not echo emails from injected-store errors');
}

async function testInvalidRouteAndMethodResponses() {
  const handler = createTestHandler(owner);

  const invalidResponse = new FakeResponse();
  await handler(createRequest('GET', 'unknown'), invalidResponse);
  assert(invalidResponse.statusCode === 404, 'unknown account resource should return 404');
  assert((invalidResponse.body as any).error.code === 'ACCOUNT_ROUTE_NOT_FOUND', 'unknown account resource should use route not found code');

  const methodResponse = new FakeResponse();
  await handler(createRequest('POST', 'profile'), methodResponse);
  assert(methodResponse.statusCode === 405, 'unsupported account method should return 405');
  assert((methodResponse.body as any).error.code === 'METHOD_NOT_ALLOWED', 'unsupported account method should use method code');
}

function createTestHandler(user: AuthUser) {
  return createHandlerFor(
    user,
    createNonDurableInMemoryStoryLabProfileStore({ now: () => now }),
    createNonDurableInMemoryStoryProjectStore({ now: () => now })
  );
}

function createHandlerFor(
  user: AuthUser,
  profileStore: ReturnType<typeof createNonDurableInMemoryStoryLabProfileStore>,
  projectStore: StoryProjectStore
) {
  return createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(user),
    profileStore,
    projectStore,
    now: () => now
  });
}

function createStaticAuthPort(user: AuthUser): AuthPort {
  return {
    async getCurrentUser() {
      return user;
    },
    async requireUser() {
      return user;
    }
  };
}

function createLeakyProjectStore(): StoryProjectStore {
  const leakResult = <T>(): StoryProjectStoreResult<T> => ({
    success: false,
    error: {
      code: 'STORY_LAB_STORAGE_ERROR',
      message: `SQL failed for ${owner.email}: ${privateStoryText}`,
      statusCode: 500,
      retryable: true
    }
  });

  return {
    mode: 'non_durable_memory',
    durable: false,
    isConfigured() {
      return true;
    },
    async saveProject(): Promise<StoryProjectStoreResult<StoredStoryProjectRecord>> {
      return leakResult();
    },
    async loadProject(): Promise<StoryProjectStoreResult<StoredStoryProjectRecord | null>> {
      return leakResult();
    },
    async listProjects(): Promise<StoryProjectStoreResult<StoryProjectListItem[]>> {
      return leakResult();
    },
    async deleteProject(): Promise<StoryProjectStoreResult<StoryProjectDeleteReceipt>> {
      return leakResult();
    }
  };
}

function createRequest(
  method: string,
  resource: string,
  body?: unknown,
  projectId?: string,
  headers: Record<string, string> = {}
): FakeRequest {
  return {
    method,
    body,
    query: {
      resource,
      ...(projectId ? { projectId } : {})
    },
    url: projectId
      ? `/api/story-lab/account/projects/${encodeURIComponent(projectId)}`
      : `/api/story-lab/account/${resource}`,
    headers
  };
}

function createProject(): SavedStoryProject {
  return createSavedStoryProjectFixture({
    id: 'project-account-1',
    storyId: 'story-account-1',
    title: 'Account Moonlit Chapel',
    synopsis: 'A private oath in a haunted chapel.',
    now,
    privateStoryText,
    themeId: 'private-oath',
    themeLabel: 'Private oath',
    themeDescription: 'A vow only the owner can see.',
    logline: privateStoryText,
    chapterSummary: 'A private chapel oath begins.'
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
