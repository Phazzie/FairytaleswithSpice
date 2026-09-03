#!/usr/bin/env tsx
// Created: 2026-06-08 08:20 EDT

import { readFileSync } from 'node:fs';
import accountHandler from '../api/story-lab/account';
import healthHandler from '../api/health';
import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createStoryLabAccountRouteHandler } from '../api/_lib/story-lab/account/accountRouteHandlers';
import { createNonDurableInMemoryStoryLabProfileStore } from '../api/_lib/story-lab/profile/inMemoryStoryLabProfileStore';
import { createDefaultStoryLabUserProfile } from '../api/_lib/story-lab/profile/storyLabProfileStore';
import { createNonDurableInMemoryStoryProjectStore } from '../api/_lib/story-lab/storage/inMemoryStoryProjectStore';
import { createPostgresStoryLabProfileStore } from '../api/_lib/story-lab/profile/postgresStoryLabProfileStore';
import { createPostgresStoryProjectStore } from '../api/_lib/story-lab/storage/postgresStoryProjectStore';
import { STORY_LAB_LIBRARY_MAX_ITEMS } from '../api/_lib/story-lab/storage/storyProjectStore';
import { STORY_LAB_PROFILE_LIMITS } from '../shared/storyBlueprintLimits';
import type {
  StoredStoryProjectRecord,
  StoryProjectDeleteReceipt,
  StoryProjectListPage,
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
  await testHealthEndpointUsesRouteLevelCors();
  await testHealthReportsTheOriginTheCorsPolicyResolved();
  await testDefaultAccountRouteFailsClosedWithoutAuthProvider();
  await testOptionsCorsPreflightUsesCredentialedPolicy();
  await testDisallowedCorsOriginFailsClosed();
  await testProfileReadWriteUsesAuthenticatedOwner();
  await testProfileCrossOwnerSaveIsForbidden();
  await testProfileSaveAllowsMissingOptionalTimestamps();
  await testMalformedProfileBodyFailsClosed();
  await testProjectSaveListLoadDeleteUsesAuthenticatedOwner();
  await testProjectCrossOwnerReadIsForbidden();
  await testProjectSaveAllowsMissingOptionalMetadata();
  await testMissingStorageConfigFailsClosed();
  await testMalformedProjectIdFailsClosed();
  await testInvalidProjectIdsFailClosedBeforeStoreAccess();
  await testInvalidProjectBodyFailsClosedBeforeStoreAccess();
  await testProjectSaveChecksTheFieldsItUsedToCast();
  await testInjectedStoreErrorMessageIsSanitized();
  await testInvalidRouteAndMethodResponses();
  await testLibrarySortPreferenceOrdersTheProjectList();
  await testLibraryListingCapIsAppliedAfterTheReadersSort();
  await testProfileFreeTextIsMeasuredBeforeItIsStored();
  await testAuthConfigReportsNoneWhenNothingConfigured();
  await testAuthConfigReportsClerkOnlyWhenFullyConfigured();
  await testAuthConfigStaysNoneWhenSecretKeyMissing();
  await testAuthConfigStaysNoneWhenPublishableKeyMissing();
  await testAuthConfigStaysNoneWhenNoTrustedOriginSurvivesParsing();
  await testAuthConfigRouteRejectsNonGetMethods();
  await testAuthConfigDoesNotRequireAuthentication();

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

async function testProfileSaveAllowsMissingOptionalTimestamps() {
  const handler = createTestHandler(owner);
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...profile
  } = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });

  const response = new FakeResponse();
  await handler(createRequest('PUT', 'profile', { profile }), response);

  assert(response.statusCode === 200, 'profile save without timestamps should still return 200');
  const body = response.body as any;
  assert(body.data.createdAt === now, 'profile save should fill missing createdAt through store normalization');
  assert(body.data.updatedAt === now, 'profile save should fill missing updatedAt through store normalization');
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

  const malformedWrapperResponse = new FakeResponse();
  await handler(createRequest('PUT', 'profile', {
    profile: 'not-a-profile-object',
    userId: owner.userId,
    displayName: 'Avery',
    preferences: {}
  }), malformedWrapperResponse);
  assert(malformedWrapperResponse.statusCode === 400, 'malformed profile wrapper should not fall back to outer fields');
  assert(
    (malformedWrapperResponse.body as any).error.code === 'INVALID_REQUEST',
    'malformed profile wrapper should use invalid request code'
  );

  const malformedTimestampResponse = new FakeResponse();
  await handler(createRequest('PUT', 'profile', {
    profile: {
      userId: owner.userId,
      displayName: 'Avery',
      preferences: {},
      createdAt: 42
    }
  }), malformedTimestampResponse);
  assert(malformedTimestampResponse.statusCode === 400, 'profile save with malformed timestamp should return 400');
  assert(
    (malformedTimestampResponse.body as any).error.code === 'INVALID_REQUEST',
    'malformed profile timestamp should use invalid request code'
  );
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
  assert(listBody.data.projects[0].acceptedMemoryCardCount === 1, 'list item should carry accepted memory count without full card text');
  const acceptedMemoryDetail = project.acceptedMemoryCards?.[0]?.detail ?? '';
  assert(acceptedMemoryDetail.length > 0, 'test fixture should include accepted memory detail');
  assert(
    !JSON.stringify(listBody.data.projects[0]).includes(acceptedMemoryDetail),
    'project list item should not expose accepted memory card detail'
  );

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
  assert(loadBody.data.project.acceptedMemoryCards[0].title === 'Avery', 'project load should preserve accepted memory cards');

  const deleteResponse = new FakeResponse();
  await handler(createRequest('DELETE', 'project', undefined, project.id), deleteResponse);
  assert(deleteResponse.statusCode === 200, 'project delete should return 200');
  const deleteBody = deleteResponse.body as any;
  assert(deleteBody.data.ownerUserId === owner.userId, 'project delete receipt should carry owner id');
  assert(
    deleteBody.data.storageMode === 'non_durable_memory',
    'non-durable project delete should not claim cloud Postgres storage'
  );
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

async function testProjectSaveAllowsMissingOptionalMetadata() {
  const handler = createTestHandler(owner);
  const {
    synopsis: _synopsis,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...project
  } = createProject();
  const projectWithoutOptionalMetadata = {
    ...project,
    id: 'project-account-no-optional-metadata'
  };

  const saveResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', { project: projectWithoutOptionalMetadata }), saveResponse);
  assert(saveResponse.statusCode === 200, 'project save without optional metadata should return 200');

  const loadResponse = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, 'project-account-no-optional-metadata'), loadResponse);
  assert(loadResponse.statusCode === 200, 'project without optional metadata should remain loadable');
  const loadBody = loadResponse.body as any;
  assert(loadBody.data.project.createdAt === now, 'project save should fill missing createdAt through store normalization');
  assert(loadBody.data.project.updatedAt === now, 'project save should fill missing updatedAt through store normalization');
  assert(loadBody.data.project.synopsis === 'A private oath in a haunted chapel.', 'project save should derive missing synopsis from summary');
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
    String.raw`project\account-1`,
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

  const arrayShapeResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: {
      id: 'project-account-1',
      storyId: 'story-account-1',
      title: 'Array shaped project internals',
      summary: [],
      state: [],
      blueprint: [],
      chapters: []
    }
  }), arrayShapeResponse);
  assert(arrayShapeResponse.statusCode === 400, 'project save with array-shaped internals should return 400');
  assert(
    (arrayShapeResponse.body as any).error.code === 'INVALID_REQUEST',
    'project save with array-shaped internals should use invalid request code'
  );

  const malformedOptionalStringResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: {
      ...createProject(),
      synopsis: 42
    }
  }), malformedOptionalStringResponse);
  assert(malformedOptionalStringResponse.statusCode === 400, 'project save with malformed synopsis should return 400');
  assert(
    (malformedOptionalStringResponse.body as any).error.code === 'INVALID_REQUEST',
    'malformed project synopsis should use invalid request code'
  );

  const malformedWrapperResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: 'not-a-project-object',
    ...createProject()
  }), malformedWrapperResponse);
  assert(malformedWrapperResponse.statusCode === 400, 'malformed project wrapper should not fall back to outer fields');
  assert(
    (malformedWrapperResponse.body as any).error.code === 'INVALID_REQUEST',
    'malformed project wrapper should use invalid request code'
  );
}

/**
 * The five fields the save route used to take on trust.
 *
 * `readProjectFromBody` checked eight fields and wrote the last five down as
 * casts: `chapters` got as far as `Array.isArray` and its entries were never
 * looked at, and `telemetry`, `continuityExtraction`, `pinnedMemoryCardDraftIds`
 * and `acceptedMemoryCards` were not looked at at all.
 *
 * The cost is not hypothetical. `toStoryProjectListItem` computes
 * `acceptedMemoryCardCount` as `acceptedMemoryCards?.length ?? 0`, so a project
 * saved with the string `"none"` in that field was a library card announcing
 * **four** memory cards for a story with none — `.length` of a string, counted
 * and rendered. Meanwhile the Angular tree had already written
 * `normalizeAcceptedMemoryCards` and `normalizePinnedMemoryCardDraftIds` over
 * `unknown` for two of those five fields, defending itself on load against data
 * its own server let in without looking.
 */
async function testProjectSaveChecksTheFieldsItUsedToCast() {
  const handler = createTestHandler(owner);
  // Named rather than repeated: each id is written at the save and again at the
  // read that checks what the save stored.
  const junkAnnotationsProjectId = 'project-account-junk-annotations';
  const partialCardsProjectId = 'project-account-partial-cards';
  const brokenChapterProjectId = 'project-account-broken-chapter';

  const junkAnnotationsResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: {
      ...createProject(),
      id: junkAnnotationsProjectId,
      telemetry: 'not-telemetry',
      continuityExtraction: 'not-a-receipt',
      pinnedMemoryCardDraftIds: 'memory-card-character-avery',
      acceptedMemoryCards: 'none'
    }
  }), junkAnnotationsResponse);
  assert(
    junkAnnotationsResponse.statusCode === 200,
    'a malformed annotation should not lose the story it annotates'
  );

  const listResponse = new FakeResponse();
  await handler(createRequest('GET', 'projects'), listResponse);
  const listed = (listResponse.body as any).data.projects
    .find((item: any) => item.projectId === junkAnnotationsProjectId);
  assert(Boolean(listed), 'the saved project should be listed');
  assert(
    listed.acceptedMemoryCardCount === 0,
    `the library card should report no memory cards, not the length of a string (got ${listed.acceptedMemoryCardCount})`
  );

  const loadResponse = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, junkAnnotationsProjectId), loadResponse);
  const loaded = (loadResponse.body as any).data.project;
  assert(
    loaded.acceptedMemoryCards === undefined,
    'a non-array memory-card field should be stored as absent rather than as itself'
  );
  assert(
    loaded.pinnedMemoryCardDraftIds === undefined,
    'a non-array pinned-id field should be stored as absent rather than as itself'
  );
  assert(
    loaded.telemetry === undefined && loaded.continuityExtraction === undefined,
    'a receipt that is not an object should be dropped rather than stored as a string'
  );

  // An array with entries in it is the caller trying to report annotations and
  // getting the shape wrong: what survives is kept, and only what survives is
  // counted. Same rule, entry by entry, as the client's own normalizers.
  const partialCardsResponse = new FakeResponse();
  const [realCard] = createProject().acceptedMemoryCards!;
  await handler(createRequest('POST', 'projects', {
    project: {
      ...createProject(),
      id: partialCardsProjectId,
      pinnedMemoryCardDraftIds: ['draft-1', '', 42, null],
      acceptedMemoryCards: [realCard, { id: 'no-other-fields' }, null, 'card']
    }
  }), partialCardsResponse);
  assert(partialCardsResponse.statusCode === 200, 'a partly readable annotation list should still save');

  const partialLoad = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, partialCardsProjectId), partialLoad);
  const partial = (partialLoad.body as any).data.project;
  assert(
    partial.acceptedMemoryCards.length === 1 && partial.acceptedMemoryCards[0].title === 'Avery',
    'the readable memory card should survive and the unreadable ones should not'
  );
  assert(
    partial.pinnedMemoryCardDraftIds.length === 1 && partial.pinnedMemoryCardDraftIds[0] === 'draft-1',
    'a blank or non-string pinned id should be dropped, the way the client drops it on load'
  );

  // The story itself is the other rule: refused, not repaired. Storing the
  // chapters that passed would lose a chapter the caller believed they saved.
  const brokenChapterResponse = new FakeResponse();
  await handler(createRequest('POST', 'projects', {
    project: {
      ...createProject(),
      id: brokenChapterProjectId,
      chapters: [...createProject().chapters, { chapterNumber: 2 }]
    }
  }), brokenChapterResponse);
  assert(
    brokenChapterResponse.statusCode === 400,
    'a chapter list holding something that is not a chapter should be refused, not truncated'
  );
  assert(
    (brokenChapterResponse.body as any).error.code === 'INVALID_REQUEST',
    'an unreadable chapter should use the invalid request code'
  );

  const missingProjectResponse = new FakeResponse();
  await handler(createRequest('GET', 'project', undefined, brokenChapterProjectId), missingProjectResponse);
  assert(
    missingProjectResponse.statusCode === 404,
    'a refused save should store nothing at all'
  );
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
  // RFC 9110 §15.5.6 requires the header, and it is the only part of this
  // answer a caller that does not know this envelope can read. It names the
  // target resource's methods, so the profile resource answers its own three
  // rather than the five the route file declares to CORS.
  assert(
    methodResponse.headers['Allow'] === 'GET, PUT, OPTIONS',
    `profile 405 should send Allow: GET, PUT, OPTIONS, got ${JSON.stringify(methodResponse.headers['Allow'])}`
  );

  const projectsMethodResponse = new FakeResponse();
  await handler(createRequest('PUT', 'projects'), projectsMethodResponse);
  assert(projectsMethodResponse.statusCode === 405, 'unsupported project collection method should return 405');
  assert(
    projectsMethodResponse.headers['Allow'] === 'GET, POST, OPTIONS',
    `project collection 405 should send Allow: GET, POST, OPTIONS, got ${JSON.stringify(projectsMethodResponse.headers['Allow'])}`
  );

  const projectMethodResponse = new FakeResponse();
  await handler(createRequest('PUT', 'project', undefined, 'project-1'), projectMethodResponse);
  assert(projectMethodResponse.statusCode === 405, 'unsupported project item method should return 405');
  assert(
    projectMethodResponse.headers['Allow'] === 'GET, DELETE, OPTIONS',
    `project item 405 should send Allow: GET, DELETE, OPTIONS, got ${JSON.stringify(projectMethodResponse.headers['Allow'])}`
  );
}

// `auth-config` is the one resource behind this route file a caller has to
// reach *before* they can have a session — it is the answer to "is there
// anything to sign in with" — so it must not sit behind `requireAccountUser`
// like `profile`/`projects`/`project` do.
async function testAuthConfigDoesNotRequireAuthentication() {
  const response = new FakeResponse();
  await accountHandler(createRequest('GET', 'auth-config'), response);

  assert(response.statusCode === 200, 'auth-config should be reachable without a session, unlike every other resource here');
  const body = response.body as any;
  assert(body.success === true, 'auth-config should answer with a success envelope');
  assert(body.data.provider === 'none', 'the default deployment (no Clerk env) should report provider: none');
  assert(body.data.publishableKey === undefined, 'an unconfigured deployment should not report a publishable key');
}

async function testAuthConfigReportsNoneWhenNothingConfigured() {
  const handler = createStoryLabAccountRouteHandler({ env: {} });
  const response = new FakeResponse();
  await handler(createRequest('GET', 'auth-config'), response);

  assert(response.statusCode === 200, 'auth-config should always answer 200');
  assert((response.body as any).data.provider === 'none', 'no auth env at all should report provider: none');
}

// `provider: 'clerk'` is a promise the frontend acts on — it shows a real
// sign-in button. It should only be made when every piece the button needs is
// actually present: a provider selection, a publishable key the browser can
// load Clerk with, and a secret key the backend can verify sessions against.
async function testAuthConfigReportsClerkOnlyWhenFullyConfigured() {
  const handler = createStoryLabAccountRouteHandler({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'clerk',
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example'
    }
  });
  const response = new FakeResponse();
  await handler(createRequest('GET', 'auth-config'), response);

  const body = response.body as any;
  assert(body.data.provider === 'clerk', 'a fully configured Clerk deployment should report provider: clerk');
  assert(body.data.publishableKey === 'pk_test_example', 'a fully configured Clerk deployment should report its publishable key');
}

async function testAuthConfigStaysNoneWhenSecretKeyMissing() {
  const handler = createStoryLabAccountRouteHandler({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'clerk',
      CLERK_PUBLISHABLE_KEY: 'pk_test_example'
    }
  });
  const response = new FakeResponse();
  await handler(createRequest('GET', 'auth-config'), response);

  assert(
    (response.body as any).data.provider === 'none',
    'a publishable key without a secret key must not report provider: clerk — the backend cannot verify anything a caller sends it'
  );
}

async function testAuthConfigStaysNoneWhenPublishableKeyMissing() {
  const handler = createStoryLabAccountRouteHandler({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'clerk',
      CLERK_SECRET_KEY: 'sk_test_example'
    }
  });
  const response = new FakeResponse();
  await handler(createRequest('GET', 'auth-config'), response);

  assert(
    (response.body as any).data.provider === 'none',
    'a secret key without a publishable key must not report provider: clerk — the frontend has nothing to load Clerk with'
  );
}

// `createClerkSessionVerifierFromEnv` fails closed (returns `undefined`,
// leaving the deployment unconfigured) when every configured origin is
// invalid and no platform URL is available — see
// `tests/story-lab-clerk-session-verifier.test.ts`. Before this was fixed,
// `resolveStoryLabAuthConfig` didn't share that check: it reported
// `provider: 'clerk'` from the provider/key env vars alone, so the frontend
// would show a working-looking sign-in button whose every subsequent
// request 401s, because the backend verifier itself never got created.
async function testAuthConfigStaysNoneWhenNoTrustedOriginSurvivesParsing() {
  const handler = createStoryLabAccountRouteHandler({
    env: {
      STORY_LAB_AUTH_PROVIDER: 'clerk',
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
      STORY_LAB_ALLOWED_ORIGINS: '*'
    }
  });
  const response = new FakeResponse();
  await handler(createRequest('GET', 'auth-config'), response);

  assert(
    (response.body as any).data.provider === 'none',
    'a deployment whose origin config parses to no trusted origins must not report provider: clerk — the backend verifier fails closed and would 401 every session'
  );
}

async function testAuthConfigRouteRejectsNonGetMethods() {
  const handler = createStoryLabAccountRouteHandler({ env: {} });
  const response = new FakeResponse();
  await handler(createRequest('POST', 'auth-config'), response);

  assert(response.statusCode === 405, 'auth-config should reject non-GET methods');
  assert(
    response.headers['Allow'] === 'GET, OPTIONS',
    `auth-config 405 should send Allow: GET, OPTIONS, got ${JSON.stringify(response.headers['Allow'])}`
  );
}

/**
 * `preferences.librarySort` is validated, stored, and echoed back by the
 * profile route, and until now nothing read it: the project stores order their
 * list newest-updated-first and the route passed that order straight through,
 * so a reader who saved `title_asc` or `created_desc` got the same library back
 * either way. The preference is only reachable through this route, so this is
 * where it has to be proved.
 *
 * The three projects are arranged so that no two of the three orderings agree
 * by accident: `Zephyr Court` is created first and updated last, which puts it
 * at opposite ends of `created_desc` and `updated_desc`, and the titles run in
 * a third order again.
 */
async function testLibrarySortPreferenceOrdersTheProjectList() {
  let tick = 0;
  const advancingNow = () => `2026-06-08T09:${String(tick++).padStart(2, '0')}:00.000Z`;
  const profileStore = createNonDurableInMemoryStoryLabProfileStore({ now: advancingNow });
  const projectStore = createNonDurableInMemoryStoryProjectStore({ now: advancingNow });
  const handler = createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(owner),
    profileStore,
    projectStore,
    now: advancingNow
  });

  // `createdAt` is the caller's on a first save and the stored record's on
  // every one after it, so it is set here rather than taken from the clock.
  const saveProject = async (id: string, title: string, createdAt: string): Promise<void> => {
    const saveResponse = new FakeResponse();
    await handler(createRequest('POST', 'projects', {
      project: { ...createProject(), id, storyId: `story-${id}`, title, createdAt }
    }), saveResponse);
    assert(saveResponse.statusCode === 200, `saving ${id} should succeed`);
  };

  await saveProject('project-zephyr', 'Zephyr Court', '2026-06-08T08:00:00.000Z');
  await saveProject('project-ashen', 'Ashen Vow', '2026-06-08T08:01:00.000Z');
  await saveProject('project-moonlit', 'Moonlit Debt', '2026-06-08T08:02:00.000Z');
  // Re-saving keeps `createdAt` and moves `updatedAt`, which is what separates
  // the two timestamp orderings from each other.
  await saveProject('project-zephyr', 'Zephyr Court', '2026-06-08T08:00:00.000Z');

  const titlesFor = async (): Promise<string> => {
    const listResponse = new FakeResponse();
    await handler(createRequest('GET', 'projects'), listResponse);
    assert(listResponse.statusCode === 200, 'listing projects should succeed');
    return ((listResponse.body as any).data.projects as { title: string }[])
      .map(project => project.title)
      .join(',');
  };

  const saveSort = async (librarySort: string): Promise<void> => {
    const profileResponse = new FakeResponse();
    await handler(createRequest('PUT', 'profile', {
      profile: {
        userId: owner.userId,
        displayName: 'Avery',
        preferences: { librarySort }
      }
    }), profileResponse);
    assert(profileResponse.statusCode === 200, `saving librarySort=${librarySort} should succeed`);
    assert(
      (profileResponse.body as any).data.preferences.librarySort === librarySort,
      `the profile route should keep librarySort=${librarySort}`
    );
  };

  // The default, and the order both stores already answer in.
  const defaultOrder = await titlesFor();
  assert(
    defaultOrder === 'Zephyr Court,Moonlit Debt,Ashen Vow',
    `the default library sort is newest-updated-first (got ${defaultOrder})`
  );

  await saveSort('title_asc');
  const alphabetical = await titlesFor();
  assert(
    alphabetical === 'Ashen Vow,Moonlit Debt,Zephyr Court',
    `title_asc should order the library by title (got ${alphabetical})`
  );

  await saveSort('created_desc');
  const newestCreated = await titlesFor();
  assert(
    newestCreated === 'Moonlit Debt,Ashen Vow,Zephyr Court',
    `created_desc should order the library by creation (got ${newestCreated})`
  );

  await saveSort('updated_desc');
  const newestUpdated = await titlesFor();
  assert(
    newestUpdated === defaultOrder,
    `updated_desc should return the default order (got ${newestUpdated})`
  );

  // A profile store that cannot be read is not a reason to refuse the library:
  // the projects are the answer and the ordering is a preference about them.
  const brokenProfileStore = {
    ...profileStore,
    async loadProfile() {
      throw new Error(privateStoryText);
    }
  } as unknown as ReturnType<typeof createNonDurableInMemoryStoryLabProfileStore>;
  const resilientHandler = createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(owner),
    profileStore: brokenProfileStore,
    projectStore,
    now: advancingNow
  });
  const resilientResponse = new FakeResponse();
  await resilientHandler(createRequest('GET', 'projects'), resilientResponse);
  assert(resilientResponse.statusCode === 200, 'an unreadable profile should not turn a working library into an error');
  assert(
    !JSON.stringify(resilientResponse.body).includes(privateStoryText),
    'a profile store failure should not reach the project list response'
  );
}

/**
 * A capped listing has to be capped by the ordering the reader chose.
 *
 * The Postgres adapter carried the cap in its own SQL, as `order by updated_at
 * desc limit 50`, and the route then sorted whatever came back. So the fifty
 * items were always the fifty most recently updated ones and `librarySort` only
 * rearranged them: a reader on `title_asc` was shown the alphabetical order of
 * the fifty most recently touched projects, not the first fifty by title, and
 * the project that should have been at the very top of their library was
 * missing with nothing in the response to say so. The in-memory adapter applied
 * no cap at all, so the two disagreed about what the library contained.
 *
 * The ordering now travels *down* to the store as part of the query, so the
 * cap can stay where the rows are without choosing them under an ordering
 * nobody asked for. This is the end-to-end proof of that: what the reader gets
 * back is the front of their own order, however the adapter beneath produced
 * it.
 *
 * `Aardvark Oath` is the test's whole point: it sorts first by title and last
 * by update, so it is exactly the item the old ordering dropped and the new one
 * must keep.
 */
async function testLibraryListingCapIsAppliedAfterTheReadersSort() {
  let tick = 0;
  const advancingNow = () => `2026-06-08T09:${String(tick++).padStart(2, '0')}:00.000Z`;
  const profileStore = createNonDurableInMemoryStoryLabProfileStore({ now: advancingNow });
  const projectStore = createNonDurableInMemoryStoryProjectStore({ now: advancingNow });
  const handler = createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(owner),
    profileStore,
    projectStore,
    now: advancingNow
  });

  const saveProject = async (id: string, title: string): Promise<void> => {
    const saveResponse = new FakeResponse();
    await handler(createRequest('POST', 'projects', {
      project: { ...createProject(), id, storyId: `story-${id}`, title }
    }), saveResponse);
    assert(saveResponse.statusCode === 200, `saving ${id} should succeed`);
  };

  // Saved first, so it is the least recently updated of the set.
  await saveProject('project-aardvark', 'Aardvark Oath');
  const overflow = STORY_LAB_LIBRARY_MAX_ITEMS + 4;
  for (let index = 0; index < overflow; index += 1) {
    await saveProject(`project-${index}`, `Zephyr Court ${String(index).padStart(3, '0')}`);
  }

  const profileResponse = new FakeResponse();
  await handler(createRequest('PUT', 'profile', {
    profile: {
      userId: owner.userId,
      displayName: 'Avery',
      preferences: { librarySort: 'title_asc' }
    }
  }), profileResponse);
  assert(profileResponse.statusCode === 200, 'saving librarySort=title_asc should succeed');

  const listResponse = new FakeResponse();
  await handler(createRequest('GET', 'projects'), listResponse);
  assert(listResponse.statusCode === 200, 'listing projects should succeed');

  const list = (listResponse.body as any).data as {
    projects: { title: string }[];
    totalProjectCount: number;
  };

  assert(
    list.projects.length === STORY_LAB_LIBRARY_MAX_ITEMS,
    `an over-full library lists at most ${STORY_LAB_LIBRARY_MAX_ITEMS} projects (got ${list.projects.length})`
  );
  assert(
    list.totalProjectCount === overflow + 1,
    `a capped listing reports the untruncated count (got ${list.totalProjectCount}, expected ${overflow + 1})`
  );
  assert(
    list.projects[0].title === 'Aardvark Oath',
    'the cap keeps the front of the reader\'s own ordering, not of the storage\'s ' +
      `(got ${JSON.stringify(list.projects[0].title)})`
  );

  // The count is the owner's, not the page's, so a library inside the cap must
  // not start reporting a number that disagrees with what it carries.
  const smallLibraryStore = createNonDurableInMemoryStoryProjectStore({ now: advancingNow });
  const smallLibraryHandler = createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(owner),
    profileStore: createNonDurableInMemoryStoryLabProfileStore({ now: advancingNow }),
    projectStore: smallLibraryStore,
    now: advancingNow
  });
  const smallSaveResponse = new FakeResponse();
  await smallLibraryHandler(createRequest('POST', 'projects', { project: createProject() }), smallSaveResponse);
  assert(smallSaveResponse.statusCode === 200, 'saving one project should succeed');

  const smallListResponse = new FakeResponse();
  await smallLibraryHandler(createRequest('GET', 'projects'), smallListResponse);
  const smallList = (smallListResponse.body as any).data as {
    projects: unknown[];
    totalProjectCount: number;
  };
  assert(
    smallList.projects.length === 1 && smallList.totalProjectCount === 1,
    'an uncapped listing reports exactly what it carries ' +
      `(got ${smallList.projects.length} of ${smallList.totalProjectCount})`
  );
}

/**
 * The profile is the one thing this API stores durably on a caller's word, and
 * its three free-text fields were the last ones in the repository that nothing
 * measured. `normalizeStoryLabProfilePreferences` checks every closed field on
 * the same object against its allowed set and reads these three through a
 * helper that asks only whether the value is a string, so an authenticated
 * caller could park as much prose per account as a request body carries and
 * have this route hand it back on every read afterwards.
 *
 * `noGoContent` is the sharp end: `parseStoryLabBlueprint` refuses that field
 * past `maxNoGoContentLength` on the generation routes, so the *default* for a
 * field was accepted at any length while the per-story value of it was capped.
 *
 * Refusal rather than truncation is the behaviour under test. These fields say
 * what a reader does not want written; a silently shortened one is a shortened
 * set of constraints they cannot see the end of.
 */
async function testProfileFreeTextIsMeasuredBeforeItIsStored() {
  const profileStore = createNonDurableInMemoryStoryLabProfileStore({ now: () => now });
  const handler = createStoryLabAccountRouteHandler({
    authPort: createStaticAuthPort(owner),
    profileStore,
    projectStore: createNonDurableInMemoryStoryProjectStore({ now: () => now }),
    now: () => now
  });

  const putProfile = async (preferences: unknown, displayName = 'Avery'): Promise<FakeResponse> => {
    const response = new FakeResponse();
    await handler(createRequest('PUT', 'profile', {
      profile: { userId: owner.userId, displayName, preferences }
    }), response);
    return response;
  };

  const oversized: Array<{ label: string; field: string; response: Promise<FakeResponse> }> = [
    {
      label: 'displayName',
      field: 'displayName',
      response: putProfile({}, 'A'.repeat(STORY_LAB_PROFILE_LIMITS.maxDisplayNameLength + 1))
    },
    {
      label: 'contentBoundaries',
      field: 'preferences.contentBoundaries',
      response: putProfile({
        contentBoundaries: 'B'.repeat(STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength + 1)
      })
    },
    {
      label: 'noGoContent',
      field: 'preferences.defaultHeatContract.noGoContent',
      response: putProfile({
        defaultHeatContract: {
          noGoContent: 'C'.repeat(STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength + 1)
        }
      })
    }
  ];

  for (const candidate of oversized) {
    const response = await candidate.response;
    assert(
      response.statusCode === 400,
      `an oversized ${candidate.label} should be refused, not stored (got ${response.statusCode})`
    );
    const body = response.body as any;
    assert(
      body.error.code === 'INVALID_REQUEST',
      `an oversized ${candidate.label} should answer INVALID_REQUEST (got ${JSON.stringify(body.error.code)})`
    );
    assert(
      typeof body.error.message === 'string' && body.error.message.startsWith(candidate.field),
      `the refusal should name the field to shorten (got ${JSON.stringify(body.error.message)})`
    );
  }

  // Nothing was written: a refused PUT must not have left the oversized value
  // in the store for the next GET to hand back.
  const afterRefusals = new FakeResponse();
  await handler(createRequest('GET', 'profile'), afterRefusals);
  assert(afterRefusals.statusCode === 200, 'reading the profile after a refused write should succeed');
  assert(
    !JSON.stringify(afterRefusals.body).includes('BBBBBBBBBB'),
    'a refused profile write should leave nothing behind'
  );

  // Exactly at the cap is accepted: the limit is inclusive, the way every other
  // limit in `STORY_BLUEPRINT_LIMITS` is read.
  const atTheCap = await putProfile({
    contentBoundaries: 'B'.repeat(STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength),
    defaultHeatContract: {
      noGoContent: 'C'.repeat(STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength)
    }
  }, 'A'.repeat(STORY_LAB_PROFILE_LIMITS.maxDisplayNameLength));
  assert(atTheCap.statusCode === 200, `a profile exactly at the caps should be stored (got ${atTheCap.statusCode})`);

  const stored = (atTheCap.body as any).data.preferences;
  assert(
    stored.contentBoundaries.length === STORY_LAB_PROFILE_LIMITS.maxContentBoundariesLength
      && stored.defaultHeatContract.noGoContent.length === STORY_LAB_PROFILE_LIMITS.maxNoGoContentLength,
    'an accepted profile keeps its free text whole rather than truncating it'
  );
}

function createTestHandler(user: AuthUser) {
  return createHandlerFor(
    user,
    createNonDurableInMemoryStoryLabProfileStore({ now: () => now }),
    createNonDurableInMemoryStoryProjectStore({ now: () => now })
  );
}

async function testHealthEndpointUsesRouteLevelCors() {
  const response = new FakeResponse();
  await healthHandler({
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:4200'
    }
  }, response);

  assert(response.statusCode === 200, 'health OPTIONS should be handled by route-level CORS');
  assert(response.headers['Access-Control-Allow-Origin'] === 'http://localhost:4200', 'health CORS should allow known local origin');
  assert(response.headers['Access-Control-Allow-Origin'] !== '*', 'health CORS should not rely on wildcard API headers');
}

// The health payload used to re-derive its reported origin from FRONTEND_URL
// alone, so a deployment that configures CORS through STORY_LAB_ALLOWED_ORIGINS
// or ALLOWED_ORIGINS — both of which the policy honours — was shown an origin
// it does not actually allow.
async function testHealthReportsTheOriginTheCorsPolicyResolved() {
  const originalAllowedOrigins = process.env['ALLOWED_ORIGINS'];
  const originalStoryLabOrigins = process.env['STORY_LAB_ALLOWED_ORIGINS'];
  const originalFrontendUrl = process.env['FRONTEND_URL'];
  const configuredOrigin = 'https://spice.example';

  delete process.env['STORY_LAB_ALLOWED_ORIGINS'];
  delete process.env['FRONTEND_URL'];
  process.env['ALLOWED_ORIGINS'] = configuredOrigin;

  try {
    const response = new FakeResponse();
    await healthHandler({ method: 'GET', headers: { origin: configuredOrigin } }, response);

    assert(response.statusCode === 200, 'health GET from an allowed origin should succeed');
    assert(
      response.headers['Access-Control-Allow-Origin'] === configuredOrigin,
      'health CORS headers should allow the configured origin'
    );

    const body = response.body as { data?: { cors?: { allowedOrigin?: string | null } } };
    assert(
      body.data?.cors?.allowedOrigin === configuredOrigin,
      `health payload should report the resolved origin, got ${String(body.data?.cors?.allowedOrigin)}`
    );
  } finally {
    restoreEnv('ALLOWED_ORIGINS', originalAllowedOrigins);
    restoreEnv('STORY_LAB_ALLOWED_ORIGINS', originalStoryLabOrigins);
    restoreEnv('FRONTEND_URL', originalFrontendUrl);
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
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
    async listProjects(): Promise<StoryProjectStoreResult<StoryProjectListPage>> {
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
    chapterSummary: 'A private chapel oath begins.',
    acceptedMemoryCards: [
      {
        id: 'memory-card-character-avery',
        label: 'Character card',
        title: 'Avery',
        detail: 'Avery is the only one who knows the private chapel oath.',
        triggerLabel: 'Trigger: Avery',
        acceptedAt: now
      }
    ]
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
