#!/usr/bin/env tsx
// Created: 2026-06-08 07:58 EDT

import type { AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { logger } from '../api/_lib/utils/logger';
import { createNonDurableInMemoryStoryLabProfileStore } from '../api/_lib/story-lab/profile/inMemoryStoryLabProfileStore';
import {
  createDefaultStoryLabUserProfile,
  createStoryLabProfileStoreError,
  normalizeStoryLabProfilePreferences
} from '../api/_lib/story-lab/profile/storyLabProfileStore';
import {
  createPostgresStoryLabProfileStore,
  PostgresProfileQueryExecutor
} from '../api/_lib/story-lab/profile/postgresStoryLabProfileStore';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface CapturedQuery {
  sql: string;
  params: readonly unknown[];
}

class FakePostgresExecutor implements PostgresProfileQueryExecutor {
  readonly queries: CapturedQuery[] = [];
  private readonly queuedRows: unknown[][] = [];
  private queuedError: Error | null = null;

  enqueueRows(rows: unknown[]): void {
    this.queuedRows.push(rows);
  }

  forceNextQueryError(error: Error): void {
    this.queuedError = error;
  }

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    if (this.queuedError) {
      const error = this.queuedError;
      this.queuedError = null;
      throw error;
    }
    return {
      rows: (this.queuedRows.shift() ?? []) as T[]
    };
  }

  latestQuery(): CapturedQuery {
    const latestQueryIndex = this.queries.length - 1;
    const query = latestQueryIndex >= 0 ? this.queries[latestQueryIndex] : undefined;
    assert(query, 'expected a captured Postgres profile query');
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
const now = '2026-06-08T07:58:00.000Z';

async function main() {
  await testDefaultProfileHelpers();
  await testNonDurableMemoryProfileStore();
  await testPostgresProfileStoreReadiness();
  await testPostgresProfileStoreExecutorPath();
  await testPostgresProfileStoreMalformedRowsFailClosed();
  await testPostgresProfileStoreFailuresLogThroughStructuredLogger();

  console.log('Story Lab profile store tests passed');
}

async function testDefaultProfileHelpers() {
  const profile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });

  assert(profile.userId === owner.userId, 'default profile should use AuthUser owner id');
  assert(profile.displayName === 'Avery', 'default profile should use provided display name');
  assert(profile.preferences.librarySort === 'updated_desc', 'default profile should sort library by updated date');
  assert(!profile.preferences.defaultHeatContract.adultOnlyConfirmed, 'default profile should not pre-confirm adult content');

  const forbidden = createStoryLabProfileStoreError(
    'STORY_LAB_PROFILE_FORBIDDEN',
    'You do not have access to this Story Lab profile.',
    403
  );
  assert(forbidden.code === 'STORY_LAB_PROFILE_FORBIDDEN', 'profile errors should carry typed codes');

  const normalizedPreferences = normalizeStoryLabProfilePreferences({
    defaultHeatContract: {
      adultOnlyConfirmed: 'yes',
      tensionMode: 'instant_fire',
      intimacyBoundary: 'graphic',
      noGoContent: 42
    },
    favoriteCreatures: ['witch', 'unknown-creature', 17],
    favoriteTones: 'romance',
    contentBoundaries: 99,
    librarySort: 'owner_first'
  } as any);
  assert(normalizedPreferences.defaultHeatContract.adultOnlyConfirmed === false, 'invalid adult confirmation should fall back to default false');
  assert(normalizedPreferences.defaultHeatContract.tensionMode === 'slow_burn', 'invalid tension mode should fall back to default');
  assert(normalizedPreferences.defaultHeatContract.intimacyBoundary === 'closed_door', 'invalid intimacy boundary should fall back to default');
  assert(normalizedPreferences.defaultHeatContract.noGoContent === undefined, 'invalid no-go content should not be saved');
  assert(normalizedPreferences.favoriteCreatures.length === 1 && normalizedPreferences.favoriteCreatures[0] === 'witch', 'favorite creatures should keep only known creature ids');
  assert(normalizedPreferences.favoriteTones.length === 0, 'favorite tones should fall back when the payload is not an array');
  assert(normalizedPreferences.contentBoundaries === undefined, 'invalid content boundaries should not be saved');
  assert(normalizedPreferences.librarySort === 'updated_desc', 'invalid library sort should fall back to updated-desc');
}

async function testNonDurableMemoryProfileStore() {
  const store = createNonDurableInMemoryStoryLabProfileStore({ now: () => now });
  const profile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });

  assert(store.mode === 'non_durable_memory', 'profile memory store should be explicitly non-durable');
  assert(store.durable === false, 'profile memory store should not claim durability');
  assert(store.isConfigured(), 'profile memory store should be configured for local tests');

  const saveResult = await store.saveProfile(owner, profile);
  assert(saveResult.success, 'owner should save profile');
  assert(saveResult.data.profile.userId === owner.userId, 'saved profile should carry owner id');

  profile.displayName = 'Mutated outside store';
  const loadResult = await store.loadProfile(owner);
  assert(loadResult.success, 'owner should load profile');
  assert(loadResult.data?.profile.displayName === 'Avery', 'load should return cloned profile data');

  if (loadResult.data) {
    loadResult.data.profile.displayName = 'Mutated loaded copy';
  }
  const reloadResult = await store.loadProfile(owner);
  assert(reloadResult.success, 'owner should reload profile');
  assert(reloadResult.data?.profile.displayName === 'Avery', 'mutating loaded copy should not mutate store state');

  const crossOwnerSave = await store.saveProfile(otherUser, createDefaultStoryLabUserProfile(owner, { now }));
  assert(!crossOwnerSave.success, 'cross-owner profile save should fail');
  assert(crossOwnerSave.error.code === 'STORY_LAB_PROFILE_FORBIDDEN', 'cross-owner profile save should be forbidden');
  assert(!crossOwnerSave.error.message.includes(owner.email ?? ''), 'profile forbidden error should not leak owner email');

  const otherLoad = await store.loadProfile(otherUser);
  assert(otherLoad.success, 'other user load should succeed');
  assert(otherLoad.data === null, 'other user should not see owner profile');
}

async function testPostgresProfileStoreReadiness() {
  const previousDatabaseUrl = process.env['DATABASE_URL'];
  delete process.env['DATABASE_URL'];

  try {
    const unconfigured = createPostgresStoryLabProfileStore({ now: () => now });
    assert(!unconfigured.isConfigured(), 'Postgres profile store without env should not be configured');

    const saveWithoutEnv = await unconfigured.saveProfile(owner, createDefaultStoryLabUserProfile(owner, { now }));
    assert(!saveWithoutEnv.success, 'Postgres profile store without env should fail closed');
    assert(saveWithoutEnv.error.code === 'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED', 'missing env should use unconfigured error');

    const missingDriver = createPostgresStoryLabProfileStore({
      databaseUrl: 'postgres://example.invalid/story_lab',
      now: () => now
    });
    assert(!missingDriver.isConfigured(), 'Postgres profile store without executor should not be configured');

    const saveWithoutDriver = await missingDriver.saveProfile(owner, createDefaultStoryLabUserProfile(owner, { now }));
    assert(!saveWithoutDriver.success, 'Postgres profile store without executor should fail closed');
    assert(saveWithoutDriver.error.code === 'STORY_LAB_PROFILE_STORAGE_DRIVER_MISSING', 'missing executor should use driver-missing error');
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = previousDatabaseUrl;
    }
  }
}

async function testPostgresProfileStoreExecutorPath() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryLabProfileStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });
  const profile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });

  assert(store.mode === 'postgres', 'Postgres profile store should identify its mode');
  assert(store.durable === true, 'Postgres profile store should identify durability when configured');
  assert(store.isConfigured(), 'Postgres profile store with URL and executor should be configured');

  executor.enqueueRows([createProfileRow(profile)]);
  const saveResult = await store.saveProfile(owner, profile);
  assert(saveResult.success, 'configured Postgres profile save should return saved record');
  assert(saveResult.data.profile.userId === owner.userId, 'configured Postgres save should return database owner');
  const saveQuery = executor.latestQuery();
  assert(saveQuery.sql.includes('story_lab_profiles'), 'save SQL should target story_lab_profiles');
  assert(saveQuery.sql.includes('user_id'), 'save SQL should include user id');
  assert(saveQuery.sql.includes('returning user_id'), 'save SQL should return persisted profile row');
  assert(saveQuery.params.includes(owner.userId), 'save params should include owner id');

  executor.enqueueRows([createProfileRow(profile)]);
  const loadResult = await store.loadProfile(owner);
  assert(loadResult.success, 'configured Postgres profile load should succeed');
  assert(loadResult.data?.profile.userId === owner.userId, 'loaded profile should carry owner id');
  const loadQuery = executor.latestQuery();
  assert(loadQuery.sql.includes('where user_id = $1'), 'load SQL should scope by user id');
  assert(loadQuery.params[0] === owner.userId, 'load params should scope by user id');
}

async function testPostgresProfileStoreMalformedRowsFailClosed() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryLabProfileStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });

  executor.enqueueRows([
    {
      ...createProfileRow(createDefaultStoryLabUserProfile(owner, { now })),
      preferences_json: '{not valid json'
    }
  ]);
  const { result: loadResult, entries } = await captureRecentLogs(() => store.loadProfile(owner));
  assert(!loadResult.success, 'malformed profile JSON should fail closed on load');
  assert(loadResult.error.code === 'STORY_LAB_PROFILE_STORAGE_ERROR', 'malformed profile should return storage error');
  assert(!loadResult.error.message.includes(owner.email ?? ''), 'malformed profile error should not leak user email');
  assert(entries.length === 1, 'malformed profile load should emit one structured diagnostic warning');
  assert(JSON.stringify(entries).includes('STORY_LAB_PROFILE_STORAGE_ERROR') === false, 'diagnostic warning should not include typed storage payloads');
  assert(!JSON.stringify(entries).includes(owner.email ?? ''), 'diagnostic warning should not leak user email');
}

// The last two `console.warn` call sites in the backend were this store's save/load failure
// paths and `clerkAuthPort`'s session-verification failure — every sibling service migrated to
// the structured logger already, which redacts, correlates, and lands the entry in the buffer
// `getRecentLogs()` (and the Error Display panel) actually reads. This asserts the migration
// landed: a save/load failure reaches the buffer as a `warn` entry naming the failing user and
// operation, not just some console output.
async function testPostgresProfileStoreFailuresLogThroughStructuredLogger() {
  const executor = new FakePostgresExecutor();
  const store = createPostgresStoryLabProfileStore({
    databaseUrl: 'postgres://example.invalid/story_lab',
    executor,
    now: () => now
  });
  const profile = createDefaultStoryLabUserProfile(owner, { displayName: 'Avery', now });

  executor.enqueueRows([]);
  const { result: saveResult, entries: saveEntries } = await captureRecentLogs(() => store.saveProfile(owner, profile));
  assert(!saveResult.success, 'a save with no returned row should fail');
  assert(saveEntries.length === 0, 'a forbidden save result should not itself log a storage warning');

  executor.forceNextQueryError(new Error('connection reset'));
  const { result: failedSave, entries: failedSaveEntries } = await captureRecentLogs(() => store.saveProfile(owner, profile));
  assert(!failedSave.success, 'a Postgres error should fail the save');
  const saveWarning = failedSaveEntries[0];
  assert(saveWarning?.level === 'warn', 'a save failure should log at warn level');
  assert(saveWarning?.context?.userId === owner.userId, 'a save failure should carry the acting user id for correlation');
  assert(saveWarning?.context?.endpoint === 'postgresStoryLabProfileStore.save', 'a save failure should identify the failing operation');
  assert(!JSON.stringify(saveWarning).includes('connection reset'), 'the raw driver error message should not be logged verbatim');

  executor.forceNextQueryError(new Error('connection reset'));
  const { result: failedLoad, entries: failedLoadEntries } = await captureRecentLogs(() => store.loadProfile(owner));
  assert(!failedLoad.success, 'a Postgres error should fail the load');
  const loadWarning = failedLoadEntries[0];
  assert(loadWarning?.context?.userId === owner.userId, 'a load failure should carry the acting user id for correlation');
  assert(loadWarning?.context?.endpoint === 'postgresStoryLabProfileStore.load', 'a load failure should identify the failing operation');
}

function createProfileRow(profile: ReturnType<typeof createDefaultStoryLabUserProfile>) {
  return {
    user_id: profile.userId,
    display_name: profile.displayName,
    preferences_json: JSON.stringify(profile.preferences),
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };
}

// The structured logger writes every buffered entry to the console as well, so
// silence it while capturing to keep the test run readable; nothing here
// asserts on raw console output.
async function captureRecentLogs<T>(fn: () => Promise<T>): Promise<{ result: T; entries: ReturnType<typeof logger.getRecentLogs> }> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  logger.clearLogs();

  try {
    const result = await fn();
    return { result, entries: logger.getRecentLogs() };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
