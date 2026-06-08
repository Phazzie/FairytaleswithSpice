#!/usr/bin/env tsx
// Created: 2026-06-08 08:20 EDT

import accountHandler from '../api/story-lab/account';
import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createStoryLabAccountRouteHandler } from '../api/_lib/story-lab/account/accountRouteHandlers';
import { createNonDurableInMemoryStoryLabProfileStore } from '../api/_lib/story-lab/profile/inMemoryStoryLabProfileStore';
import { createDefaultStoryLabUserProfile } from '../api/_lib/story-lab/profile/storyLabProfileStore';
import { createNonDurableInMemoryStoryProjectStore } from '../api/_lib/story-lab/storage/inMemoryStoryProjectStore';
import { createPostgresStoryLabProfileStore } from '../api/_lib/story-lab/profile/postgresStoryLabProfileStore';
import { createPostgresStoryProjectStore } from '../api/_lib/story-lab/storage/postgresStoryProjectStore';
import type { SavedStoryProject } from '../story-generator/src/app/contracts';

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
  await testDefaultAccountRouteFailsClosedWithoutAuthProvider();
  await testOptionsCorsPreflightUsesCredentialedPolicy();
  await testProfileReadWriteUsesAuthenticatedOwner();
  await testProfileCrossOwnerSaveIsForbidden();
  await testProjectSaveListLoadDeleteUsesAuthenticatedOwner();
  await testProjectCrossOwnerReadIsForbidden();
  await testMissingStorageConfigFailsClosed();
  await testInvalidRouteAndMethodResponses();

  console.log('Story Lab account route tests passed');
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
  assert(listBody.data.storageMode === 'non_durable_memory', 'non-durable project list should not claim cloud Postgres storage');
  assert(listBody.data.projects.length === 1, 'owner should see saved project');
  assert(listBody.data.projects[0].title === project.title, 'list item should carry project title');
  assert(listBody.data.projects[0].acceptedMemoryCardCount === 1, 'list item should carry accepted memory count without full card text');

  const loadResponse = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, project.id), loadResponse);
  assert(loadResponse.statusCode === 200, 'project load should return 200');
  const loadBody = loadResponse.body as any;
  assert(loadBody.success === true, 'project load should use success envelope');
  assert(loadBody.data.storageMode === 'non_durable_memory', 'non-durable project load should not claim cloud Postgres storage');
  assert(loadBody.data.project.id === project.id, 'project load should return saved project');
  assert(loadBody.data.project.acceptedMemoryCards[0].title === 'Avery', 'project load should preserve accepted memory cards');

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
  projectStore: ReturnType<typeof createNonDurableInMemoryStoryProjectStore>
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
  return {
    id: 'project-account-1',
    storyId: 'story-account-1',
    title: 'Account Moonlit Chapel',
    synopsis: 'A private oath in a haunted chapel.',
    blueprint: {
      creature: 'witch',
      themes: [
        {
          id: 'private-oath',
          label: 'Private oath',
          description: 'A vow only the owner can see.'
        }
      ],
      logline: privateStoryText,
      spicyLevel: 3,
      tone: 'dark_romance',
      desiredWordBudget: 900,
      chapterBatchSize: 1,
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door',
        noGoContent: 'No humiliation.'
      }
    },
    summary: {
      storyId: 'story-account-1',
      title: 'Account Moonlit Chapel',
      synopsis: 'A private oath in a haunted chapel.',
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    state: {
      storyId: 'story-account-1',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Gothic, intimate, and tense.',
      lastUpdatedAt: now
    },
    chapters: [
      {
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: 'Chapter One',
        htmlContent: `<p>${privateStoryText}</p>`,
        rawContent: privateStoryText,
        summary: 'A private chapel oath begins.',
        wordCount: 9,
        hasCliffhanger: true,
        delta: {
          introducedCharacters: [],
          resolvedThreads: [],
          escalatedThreads: [],
          foreshadowedArtifacts: [],
          continuityFlags: []
        }
      }
    ],
    acceptedMemoryCards: [
      {
        id: 'memory-card-character-avery',
        label: 'Character card',
        title: 'Avery',
        detail: 'Avery is the only one who knows the private chapel oath.',
        triggerLabel: 'Trigger: Avery',
        acceptedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
