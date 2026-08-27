#!/usr/bin/env tsx
// Created: 2026-06-05 04:02 EDT

import type { AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createNonDurableInMemoryStoryProjectStore } from '../api/_lib/story-lab/storage/inMemoryStoryProjectStore';
import {
  createPostgresStoryProjectStore,
  PostgresQueryExecutor
} from '../api/_lib/story-lab/storage/postgresStoryProjectStore';
import {
  sortStoryProjectListItems,
  STORY_LAB_LIBRARY_MAX_ITEMS,
  type StoryProjectListItem
} from '../api/_lib/story-lab/storage/storyProjectStore';
import type { SavedStoryProject } from '../story-generator/src/app/contracts';
import { createSavedStoryProjectFixture } from './story-lab-test-fixtures';

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

  // `listProjects` issues two statements — the bounded page and the owner's
  // count — so "the last query" no longer names the one under test.
  queryContaining(fragment: string): CapturedQuery {
    const query = this.queries.find(captured => captured.sql.includes(fragment));
    assert(query, `expected a captured Postgres query containing ${JSON.stringify(fragment)}`);
    return query;
  }
}

/** The listing every test that is not about paging asks for. */
const wholeLibraryQuery = { sort: 'updated_desc', limit: STORY_LAB_LIBRARY_MAX_ITEMS } as const;

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
  testLibrarySortOrdersTheList();

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

  const ownerList = await store.listProjects(owner, wholeLibraryQuery);
  assert(ownerList.success, 'owner list should succeed');
  assert(ownerList.data.items.length === 1, 'owner should see exactly one project');
  assert(ownerList.data.totalCount === 1, 'owner count should be the owner\'s own rows');
  assert(ownerList.data.items[0]?.chapterCount === 1, 'list item should expose chapter count');
  assert(ownerList.data.items[0]?.acceptedMemoryCardCount === 1, 'list item should expose accepted memory card count without full card text');

  const otherList = await store.listProjects(otherUser, wholeLibraryQuery);
  assert(otherList.success, 'other user list should succeed');
  assert(otherList.data.items.length === 0, 'other user should not see owner projects');
  assert(otherList.data.totalCount === 0, 'another owner\'s count must not include these projects');

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

  const listResult = await store.listProjects(owner, wholeLibraryQuery);
  assert(listResult.success, 'store should list project snapshots with missing derived metadata');
  assert(listResult.data.items[0]?.title === 'Untitled Story Lab Project', 'list should use normalized title fallback');
  assert(listResult.data.items[0]?.chapterCount === 0, 'missing chapter array should list as zero chapters');
  assert(listResult.data.items[0]?.acceptedMemoryCardCount === 0, 'missing accepted memory array should list as zero memory cards');
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
  executor.enqueueRows([{ total: 1 }]);
  const listResult = await store.listProjects(owner, wholeLibraryQuery);
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
  executor.enqueueRows([{ total: 7 }]);
  const listResult = await store.listProjects(owner, wholeLibraryQuery);
  assert(listResult.success, 'configured Postgres list should succeed');
  assert(listResult.data.items.length === 1, 'configured Postgres list should map rows');
  assert(listResult.data.items[0]?.projectId === project.id, 'list item should include project id');
  assert(listResult.data.items[0]?.acceptedMemoryCardCount === 1, 'Postgres list item should include accepted memory card count');
  // The count is the owner's, not the page's: a page that reports only its own
  // length is indistinguishable from a complete library.
  assert(
    listResult.data.totalCount === 7,
    `list should report the owner's untruncated count (got ${listResult.data.totalCount})`
  );

  const listQuery = executor.queryContaining('limit $2');
  assert(listQuery.sql.includes('where owner_user_id = $1'), 'list SQL should scope by owner id');
  // The cap has to be applied under the ordering the reader asked for, and both
  // have to be in the query: capping above it means reading and parsing every
  // row of the library — `project_json` and all — to throw most of it away,
  // and ordering above a query-level cap means `updated_at desc` chooses which
  // rows survive whatever the reader picked.
  assert(
    listQuery.params[1] === STORY_LAB_LIBRARY_MAX_ITEMS,
    `list SQL should be bounded by the requested limit (got ${JSON.stringify(listQuery.params[1])})`
  );
  const countQuery = executor.queryContaining('count(*)');
  assert(
    countQuery.params[0] === owner.userId && !/\blimit\b/i.test(countQuery.sql),
    'the count query is owner-scoped and unbounded, or it is not a count of the library'
  );

  // The ordering reaches the database as a clause from a closed table rather
  // than as the caller's string: `librarySort` comes off a stored profile, and
  // an `order by` is not a place to discover that a validator was skipped.
  for (const sort of ['updated_desc', 'created_desc', 'title_asc'] as const) {
    executor.enqueueRows([createProjectRow(project)]);
    executor.enqueueRows([{ total: 1 }]);
    const sortedResult = await store.listProjects(owner, { sort, limit: STORY_LAB_LIBRARY_MAX_ITEMS });
    assert(sortedResult.success, `configured Postgres list should succeed for ${sort}`);
    const sortedQuery = executor.queryContaining('limit $2');
    const expectedColumn = { updated_desc: 'updated_at desc', created_desc: 'created_at desc', title_asc: 'lower(title) asc' }[sort];
    assert(
      executor.queries.some(captured => captured.sql.includes(expectedColumn) && captured.sql.includes('limit $2')),
      `${sort} should order the bounded page by ${expectedColumn}`
    );
    assert(sortedQuery.sql.includes('order by'), 'the bounded page is ordered in the query');
  }

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
  return createSavedStoryProjectFixture({
    id: 'project-1',
    storyId: 'story-1',
    title: 'Moonlit Chapel',
    synopsis: 'A forbidden romance in a haunted chapel.',
    now,
    privateStoryText,
    themeId: 'forbidden-oath',
    themeLabel: 'Forbidden oath',
    themeDescription: 'A vow that binds two enemies together.',
    logline: 'A witch and her rival uncover a cursed chapel.',
    chapterSummary: 'Elena finds the hidden vault.',
    acceptedMemoryCards: [
      {
        id: 'memory-card-character-elena',
        label: 'Character card',
        title: 'Elena',
        detail: 'Elena knows where the private vault starts.',
        triggerLabel: 'Trigger: Elena',
        acceptedAt: now
      }
    ]
  });
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

/**
 * `librarySort` is a three-value closed set the profile stores have persisted
 * and the account route has echoed back since it was introduced, and nothing
 * read it: both project stores order their list newest-updated-first, so two of
 * its three values were settings with no effect.
 */
function testLibrarySortOrdersTheList(): void {
  const item = (
    projectId: string,
    title: string,
    createdAt: string,
    updatedAt: string
  ): StoryProjectListItem => ({
    projectId,
    storyId: `story-${projectId}`,
    title,
    synopsis: '',
    chapterCount: 1,
    acceptedMemoryCardCount: 0,
    createdAt,
    updatedAt
  });

  const items = [
    item('a', 'Zephyr Court', '2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
    item('b', 'Ashen Vow', '2026-02-01T00:00:00.000Z', '2026-01-15T00:00:00.000Z'),
    item('c', 'Moonlit Debt', '2026-01-15T00:00:00.000Z', '2026-02-01T00:00:00.000Z')
  ];

  const ids = (sort: Parameters<typeof sortStoryProjectListItems>[1]) =>
    sortStoryProjectListItems(items, sort).map(entry => entry.projectId).join(',');

  assert(ids('updated_desc') === 'a,c,b', `updated_desc should order by last update (got ${ids('updated_desc')})`);
  assert(ids('created_desc') === 'b,c,a', `created_desc should order by creation (got ${ids('created_desc')})`);
  assert(ids('title_asc') === 'b,c,a', `title_asc should order by title (got ${ids('title_asc')})`);

  assert(
    items.map(entry => entry.projectId).join(',') === 'a,b,c',
    'sorting should not reorder the caller\'s array in place'
  );

  // `Date.parse` answers `NaN` for a timestamp it cannot read, and a comparator
  // that answers `NaN` is read as *equal* — so one unreadable entry would
  // otherwise compare equal to every other and pin the whole list in the order
  // it arrived in. This is the failure `byNewestUpdateFirst` was fixed for on
  // the local library.
  const withCorruptTimestamp = [
    item('x', 'Corrupt', 'not-a-date', 'not-a-date'),
    ...items
  ];
  const corruptOrder = sortStoryProjectListItems(withCorruptTimestamp, 'updated_desc')
    .map(entry => entry.projectId)
    .join(',');
  assert(
    corruptOrder === 'a,c,b,x',
    `an unreadable timestamp should sort last, not stop the sort (got ${corruptOrder})`
  );

  const twoCorrupt = sortStoryProjectListItems([
    item('y', 'Second corrupt', '', ''),
    item('x', 'Corrupt', 'not-a-date', 'not-a-date'),
    ...items
  ], 'updated_desc').map(entry => entry.projectId).join(',');
  assert(
    twoCorrupt === 'a,c,b,x,y',
    `two unreadable timestamps should compare equal to each other, not to NaN (got ${twoCorrupt})`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
