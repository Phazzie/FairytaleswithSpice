#!/usr/bin/env tsx
// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createNonDurableInMemoryStoryProjectStore } from '../api/_lib/story-lab/storage/inMemoryStoryProjectStore';
import {
  createPostgresStoryProjectStore,
  PostgresQueryExecutor
} from '../api/_lib/story-lab/storage/postgresStoryProjectStore';
import type { SavedStoryProject } from '../story-generator/src/app/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface CapturedQuery {
  sql: string;
  params: readonly unknown[];
}

class FakePostgresExecutor implements PostgresQueryExecutor {
  readonly queries: CapturedQuery[] = [];
  private readonly queuedRows: unknown[][] = [];

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return {
      rows: (this.queuedRows.shift() ?? []) as T[]
    };
  }

  latestQuery(): CapturedQuery {
    const latestQueryIndex = this.queries.length - 1;
    const query = latestQueryIndex >= 0 ? this.queries[latestQueryIndex] : undefined;
    assert(query, 'expected a captured Postgres query');
    return query;
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
const now = '2026-06-05T04:02:00.000Z';
const privateStoryText = 'Elena revealed the private vault beneath the moonlit chapel.';

async function main() {
  await testNonDurableMemoryStore();
  await testMissingProjectMetadataFallbacks();
  await testPostgresStoreReadiness();
  await testPostgresStoreExecutorPath();
  await testPostgresStoreOwnerConflict();
  await testPostgresStoreMalformedRowsFailClosed();

  console.log('Story Lab storage port tests passed');
}

async function testNonDurableMemoryStore() {
  const store = createNonDurableInMemoryStoryProjectStore({ now: () => now });
  const project = createProject();

  assert(store.mode === 'non_durable_memory', 'memory store should be explicitly non-durable');
  assert(store.durable === false, 'memory store should not claim durability');
  assert(store.isConfigured(), 'memory store should be configured for local tests');

  const saveResult = await store.saveProject(owner, project);
  assert(saveResult.success, 'owner should save project');
  assert(saveResult.data.ownerUserId === owner.userId, 'saved record should carry owner id');

  project.chapters[0].title = 'Mutated outside store';
  const loadResult = await store.loadProject(owner, 'project-1');
  assert(loadResult.success, 'owner should load project');
  assert(loadResult.data?.project.chapters[0]?.title === 'Chapter One', 'load should return a cloned project');

  if (loadResult.data) {
    loadResult.data.project.chapters[0].title = 'Mutated loaded copy';
  }
  const reloadResult = await store.loadProject(owner, 'project-1');
  assert(reloadResult.success, 'owner should reload project');
  assert(reloadResult.data?.project.chapters[0]?.title === 'Chapter One', 'mutating a loaded copy should not mutate store state');

  const otherLoad = await store.loadProject(otherUser, 'project-1');
  assert(!otherLoad.success, 'cross-owner load should fail');
  assert(otherLoad.error.code === 'STORY_LAB_PROJECT_FORBIDDEN', 'cross-owner load should be forbidden');
  assert(!otherLoad.error.message.includes(privateStoryText), 'forbidden error should not leak private story text');

  const otherSave = await store.saveProject(otherUser, createProject());
  assert(!otherSave.success, 'cross-owner overwrite should fail');
  assert(otherSave.error.code === 'STORY_LAB_PROJECT_FORBIDDEN', 'cross-owner overwrite should be forbidden');

  const ownerList = await store.listProjects(owner);
  assert(ownerList.success, 'owner list should succeed');
  assert(ownerList.data.length === 1, 'owner should see exactly one project');
  assert(ownerList.data[0]?.chapterCount === 1, 'list item should expose chapter count');
  assert(ownerList.data[0]?.acceptedMemoryCardCount === 1, 'list item should expose accepted memory card count without full card text');

  const otherList = await store.listProjects(otherUser);
  assert(otherList.success, 'other user list should succeed');
  assert(otherList.data.length === 0, 'other user should not see owner projects');

  const otherDelete = await store.deleteProject(otherUser, 'project-1');
  assert(!otherDelete.success, 'cross-owner delete should fail');
  assert(otherDelete.error.code === 'STORY_LAB_PROJECT_FORBIDDEN', 'cross-owner delete should be forbidden');

  const deleteResult = await store.deleteProject(owner, 'project-1');
  assert(deleteResult.success, 'owner delete should succeed');
  assert(deleteResult.data.deleted, 'owner delete should report deleted');

  const deletedLoad = await store.loadProject(owner, 'project-1');
  assert(deletedLoad.success, 'loading deleted project should succeed with null');
  assert(deletedLoad.data === null, 'deleted project should not load');
}

async function testPostgresStoreReadiness() {
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  delete process.env['DATABASE_URL'];

  try {
    const unconfigured = createPostgresStoryProjectStore({ now: () => now });
    assert(!unconfigured.isConfigured(), 'Postgres store without env should not be configured');

    const saveWithoutEnv = await unconfigured.saveProject(owner, createProject());
    assert(!saveWithoutEnv.success, 'Postgres store without env should fail closed');
    assert(saveWithoutEnv.error.code === 'STORY_LAB_STORAGE_UNCONFIGURED', 'missing env should use unconfigured error');
    assert(!saveWithoutEnv.error.message.includes(privateStoryText), 'storage readiness error should not leak private story text');

    const missingDriver = createPostgresStoryProjectStore({
      databaseUrl: 'postgres://example.invalid/story_lab',
      now: () => now
    });
    assert(!missingDriver.isConfigured(), 'Postgres store without executor should not be configured');

    const saveWithoutDriver = await missingDriver.saveProject(owner, createProject());
    assert(!saveWithoutDriver.success, 'Postgres store without executor should fail closed');
    assert(saveWithoutDriver.error.code === 'STORY_LAB_STORAGE_DRIVER_MISSING', 'missing executor should use driver-missing error');
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testMissingProjectMetadataFallbacks() {
  const store = createNonDurableInMemoryStoryProjectStore({ now: () => now });
  const saveResult = await store.saveProject(owner, createProjectWithMissingMetadata());
  assert(saveResult.success, 'store should save project snapshots with missing derived metadata');
  assert(saveResult.data.project.title === 'Untitled Story Lab Project', 'missing project title should use safe fallback');
  assert(saveResult.data.project.synopsis === '', 'missing synopsis should use safe fallback');

  const listResult = await store.listProjects(owner);
  assert(listResult.success, 'store should list project snapshots with missing derived metadata');
  assert(listResult.data[0]?.title === 'Untitled Story Lab Project', 'list should use normalized title fallback');
  assert(listResult.data[0]?.chapterCount === 0, 'missing chapter array should list as zero chapters');
  assert(listResult.data[0]?.acceptedMemoryCardCount === 0, 'missing accepted memory array should list as zero memory cards');
}

async function testPostgresStoreMalformedRowsFailClosed() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryProjectStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });

  executor.enqueueRows([
    {
      ...createProjectRow(createProject()),
      project_json: '{not valid json'
    }
  ]);
  const loadResult = await store.loadProject(owner, 'project-1');
  assert(!loadResult.success, 'malformed Postgres project JSON should fail closed on load');
  assert(loadResult.error.code === 'STORY_LAB_STORAGE_ERROR', 'malformed load should return storage error');
  assert(!loadResult.error.message.includes(privateStoryText), 'malformed load error should not leak private story text');

  executor.enqueueRows([
    {
      ...createProjectRow(createProject()),
      project_json: null
    }
  ]);
  const listResult = await store.listProjects(owner);
  assert(!listResult.success, 'empty Postgres project JSON should fail closed on list');
  assert(listResult.error.code === 'STORY_LAB_STORAGE_ERROR', 'malformed list should return storage error');
}

async function testPostgresStoreExecutorPath() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryProjectStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });
  const project = createProject();

  assert(store.mode === 'postgres', 'Postgres store should identify its mode');
  assert(store.durable === true, 'Postgres store should identify durability when configured');
  assert(store.isConfigured(), 'Postgres store with URL and executor should be configured');

  executor.enqueueRows([createProjectRow(project)]);
  const saveResult = await store.saveProject(owner, project);
  assert(saveResult.success, 'configured Postgres save should return saved record');
  assert(saveResult.data.ownerUserId === owner.userId, 'configured Postgres save should return database owner');
  const saveQuery = executor.latestQuery();
  assert(saveQuery.sql.includes('story_projects'), 'save SQL should target story_projects');
  assert(saveQuery.sql.includes('owner_user_id'), 'save SQL should include owner column');
  assert(saveQuery.sql.includes('returning id, story_id, owner_user_id'), 'save SQL should return the persisted row');
  assert(saveQuery.params.includes(owner.userId), 'save params should include owner id');
  assert(saveQuery.params.includes(project.id), 'save params should include project id');

  executor.enqueueRows([createProjectRow(project)]);
  const loadResult = await store.loadProject(owner, project.id);
  assert(loadResult.success, 'configured Postgres load should succeed');
  assert(loadResult.data?.ownerUserId === owner.userId, 'loaded row should carry owner id');
  const loadQuery = executor.latestQuery();
  assert(loadQuery.sql.includes('owner_user_id = $2'), 'load SQL should scope by owner id');
  assert(loadQuery.params[1] === owner.userId, 'load params should scope by owner id');

  executor.enqueueRows([createProjectRow(project)]);
  const listResult = await store.listProjects(owner);
  assert(listResult.success, 'configured Postgres list should succeed');
  assert(listResult.data.length === 1, 'configured Postgres list should map rows');
  assert(listResult.data[0]?.projectId === project.id, 'list item should include project id');
  assert(listResult.data[0]?.acceptedMemoryCardCount === 1, 'Postgres list item should include accepted memory card count');
  const listQuery = executor.latestQuery();
  assert(listQuery.sql.includes('where owner_user_id = $1'), 'list SQL should scope by owner id');

  executor.enqueueRows([{ id: project.id }]);
  const deleteResult = await store.deleteProject(owner, project.id);
  assert(deleteResult.success, 'configured Postgres delete should succeed');
  assert(deleteResult.data.deleted, 'configured Postgres delete should report deleted');
  const deleteQuery = executor.latestQuery();
  assert(deleteQuery.sql.includes('owner_user_id = $2'), 'delete SQL should scope by owner id');
}

async function testPostgresStoreOwnerConflict() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryProjectStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });

  const result = await store.saveProject(otherUser, createProject());
  assert(!result.success, 'Postgres save should fail when owner-scoped upsert returns no row');
  assert(result.error.code === 'STORY_LAB_PROJECT_FORBIDDEN', 'zero-row owner-conflict save should be forbidden');
  assert(result.error.statusCode === 403, 'zero-row owner-conflict save should use forbidden status');
  assert(!result.error.message.includes(privateStoryText), 'owner-conflict error should not leak private story text');

  const saveQuery = executor.latestQuery();
  assert(saveQuery.sql.includes('where story_projects.owner_user_id = excluded.owner_user_id'), 'save SQL should preserve owner conflict guard');
  assert(saveQuery.params.includes(otherUser.userId), 'save params should include attempted owner id');
}

function createProjectRow(project: SavedStoryProject) {
  return {
    id: project.id,
    story_id: project.storyId,
    owner_user_id: owner.userId,
    project_json: JSON.stringify(project),
    created_at: project.createdAt,
    updated_at: project.updatedAt
  };
}

function createProject(): SavedStoryProject {
  return {
    id: 'project-1',
    storyId: 'story-1',
    title: 'Moonlit Chapel',
    synopsis: 'A forbidden romance in a haunted chapel.',
    blueprint: {
      creature: 'witch',
      themes: [
        {
          id: 'forbidden-oath',
          label: 'Forbidden oath',
          description: 'A vow that binds two enemies together.'
        }
      ],
      logline: 'A witch and her rival uncover a cursed chapel.',
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
      storyId: 'story-1',
      title: 'Moonlit Chapel',
      synopsis: 'A forbidden romance in a haunted chapel.',
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    state: {
      storyId: 'story-1',
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
        summary: 'Elena finds the hidden vault.',
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
    telemetry: {
      engine: 'grok',
      model: 'grok-4',
      totalLatencyMs: 100,
      averageChapterLatencyMs: 100,
      tokensConsumed: 200,
      retryCount: 0
    },
    continuityExtraction: {
      source: 'heuristic',
      extractedAt: now,
      confidence: 0.7
    },
    acceptedMemoryCards: [
      {
        id: 'memory-card-character-elena',
        label: 'Character card',
        title: 'Elena',
        detail: 'Elena knows where the private vault starts.',
        triggerLabel: 'Trigger: Elena',
        acceptedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function createProjectWithMissingMetadata(): SavedStoryProject {
  return {
    ...createProject(),
    title: '',
    synopsis: '',
    summary: undefined,
    chapters: undefined,
    acceptedMemoryCards: undefined
  } as unknown as SavedStoryProject;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
