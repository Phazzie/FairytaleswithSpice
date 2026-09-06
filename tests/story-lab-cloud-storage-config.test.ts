#!/usr/bin/env tsx
// Created: 2026-06-08 10:50 EDT

import type { AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { createDefaultStoryLabUserProfile } from '../api/_lib/story-lab/profile/storyLabProfileStore';
import { createStoryLabCloudStorage } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
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

class FakeCloudExecutor {
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
}

const owner: AuthUser = {
  userId: 'user-owner',
  email: 'owner@example.com'
};
/** The listing these tests ask for; paging itself is covered in the storage-port suite. */
const wholeLibraryQuery = { sort: 'updated_desc', limit: 50 } as const;

const now = '2026-06-08T10:50:00.000Z';

async function main() {
  await testMissingDatabaseDoesNotCreateExecutor();
  await testExplicitEnvDoesNotFallThroughToProcessEnv();
  await testConfiguredExecutorFactoryBuildsProfileAndProjectStores();
  await testValidDatabaseUrlCreatesBundledNeonExecutor();
  await testInvalidDatabaseUrlFailsClosed();
  await testDefaultModeIsPostgres();
  await testNonDurableMemoryModeUsesInMemoryStores();
  await testExplicitNowIsolatesFromTheSharedSingleton();
  await testNonDurableMemorySharesStoreAcrossSeparateCalls();
  await testUnsupportedModeFailsClosed();
  await testCloudStorageModeEnvDoesNotFallThroughToProcessEnv();

  console.log('Story Lab cloud storage config tests passed');
}

async function testMissingDatabaseDoesNotCreateExecutor() {
  let factoryCalls = 0;
  const storage = createStoryLabCloudStorage({
    env: {},
    now: () => now,
    createExecutor() {
      factoryCalls += 1;
      throw new Error('executor should not initialize without DATABASE_URL');
    }
  });

  assert(!storage.databaseUrlConfigured, 'missing DATABASE_URL should be reported');
  assert(!storage.executorConfigured, 'missing DATABASE_URL should not create an executor');
  assert(!storage.isConfigured(), 'cloud storage without DATABASE_URL should not be configured');
  assert(factoryCalls === 0, 'executor factory should not run without DATABASE_URL');

  const profileResult = await storage.profileStore.loadProfile(owner);
  assert(!profileResult.success, 'profile store should fail closed without DATABASE_URL');
  assert(profileResult.error.code === 'STORY_LAB_PROFILE_STORAGE_UNCONFIGURED', 'profile store should expose profile storage config error');

  const projectResult = await storage.projectStore.listProjects(owner, wholeLibraryQuery);
  assert(!projectResult.success, 'project store should fail closed without DATABASE_URL');
  assert(projectResult.error.code === 'STORY_LAB_STORAGE_UNCONFIGURED', 'project store should expose project storage config error');
}

async function testExplicitEnvDoesNotFallThroughToProcessEnv() {
  const originalDatabaseUrl = process.env['DATABASE_URL'];
  process.env['DATABASE_URL'] = 'postgresql://user:password@process-env.example.invalid/story_lab';
  let factoryCalls = 0;

  try {
    const storage = createStoryLabCloudStorage({
      env: {},
      now: () => now,
      createExecutor() {
        factoryCalls += 1;
        throw new Error('explicit empty env should not create an executor from process.env');
      }
    });

    assert(!storage.databaseUrlConfigured, 'explicit empty env should keep database URL unconfigured');
    assert(!storage.executorConfigured, 'explicit empty env should not create an executor');
    assert(!storage.isConfigured(), 'explicit empty env should not claim cloud storage is configured');
    assert(factoryCalls === 0, 'explicit env should prevent implicit process.env executor creation');
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  }
}

async function testConfiguredExecutorFactoryBuildsProfileAndProjectStores() {
  const executor = new FakeCloudExecutor();
  let factoryCalls = 0;
  const databaseUrl = 'postgres://example.invalid/story_lab';
  const storage = createStoryLabCloudStorage({
    env: { DATABASE_URL: databaseUrl },
    now: () => now,
    createExecutor(resolvedDatabaseUrl) {
      factoryCalls += 1;
      assert(resolvedDatabaseUrl === databaseUrl, 'executor factory should receive DATABASE_URL');
      return executor;
    }
  });

  assert(storage.databaseUrlConfigured, 'DATABASE_URL should be reported as configured');
  assert(storage.executorConfigured, 'executor factory should configure an executor');
  assert(storage.isConfigured(), 'cloud storage should be configured when URL and executor exist');
  assert(factoryCalls === 1, 'executor factory should be called once for shared stores');

  const profile = createDefaultStoryLabUserProfile(owner, {
    displayName: 'Avery',
    now
  });
  executor.enqueueRows([createProfileRow(profile)]);
  const profileResult = await storage.profileStore.loadProfile(owner);
  assert(profileResult.success, 'profile store should use configured executor');
  assert(profileResult.data?.profile.displayName === 'Avery', 'profile store should map configured executor row');

  const project = createProject();
  executor.enqueueRows([createProjectRow(project)]);
  executor.enqueueRows([{ total: 1 }]);
  const listResult = await storage.projectStore.listProjects(owner, wholeLibraryQuery);
  assert(listResult.success, 'project store should use configured executor');
  assert(listResult.data.items[0]?.projectId === project.id, 'project store should map configured executor row');

  assert(executor.queries.some(query => query.sql.includes('story_lab_profiles')), 'shared executor should receive profile SQL');
  assert(executor.queries.some(query => query.sql.includes('story_projects')), 'shared executor should receive project SQL');
}

async function testValidDatabaseUrlCreatesBundledNeonExecutor() {
  const storage = createStoryLabCloudStorage({
    env: { DATABASE_URL: 'postgresql://user:password@example.invalid/story_lab' },
    now: () => now
  });

  assert(storage.databaseUrlConfigured, 'valid database URL should be detected');
  assert(storage.executorConfigured, 'valid database URL should create the bundled Neon executor');
  assert(storage.isConfigured(), 'valid database URL plus bundled driver should configure cloud storage');
}

async function testInvalidDatabaseUrlFailsClosed() {
  const storage = createStoryLabCloudStorage({
    env: { DATABASE_URL: 'postgres://example.invalid/story_lab' },
    now: () => now
  });

  assert(storage.databaseUrlConfigured, 'invalid database URL should still be detected as present');
  assert(!storage.executorConfigured, 'invalid database URL should not configure an executor');
  assert(!storage.isConfigured(), 'invalid database URL should not claim configured cloud sync');

  const profileResult = await storage.profileStore.loadProfile(owner);
  assert(!profileResult.success, 'profile store without executor should fail closed');
  assert(profileResult.error.code === 'STORY_LAB_PROFILE_STORAGE_DRIVER_MISSING', 'profile store should expose driver-missing error');

  const projectResult = await storage.projectStore.listProjects(owner, wholeLibraryQuery);
  assert(!projectResult.success, 'project store without executor should fail closed');
  assert(projectResult.error.code === 'STORY_LAB_STORAGE_DRIVER_MISSING', 'project store should expose driver-missing error');
}

// Unlike `storyLabJobStoreConfig.ts`/`rateLimitStoreConfig.ts`, whose only
// prior implementation was in-memory, this store's only prior implementation
// was Postgres — so the default here stays `postgres`, preserving every test
// above byte-for-byte, rather than matching the siblings' `non_durable_memory`
// default and silently downgrading an existing `DATABASE_URL`-backed deployment.
async function testDefaultModeIsPostgres() {
  const storage = createStoryLabCloudStorage({ env: {}, now: () => now });

  assert(storage.mode === 'postgres', 'default cloud storage mode should stay postgres');
  assert(storage.requestedMode === 'postgres', 'default requested mode should be reported as postgres');
}

// An explicit `now` builds its own isolated, deterministically clocked store
// rather than reusing the shared singleton — the same tradeoff as passing
// `nonDurableProfileStore`/`nonDurableProjectStore` directly. Every real route
// (including `createStoryLabAccountRouteHandler()`'s own default path, which
// passes `options.now` through as `undefined` rather than defaulting it to a
// closure first) omits `now` entirely and gets the shared singleton instead —
// see `testNonDurableMemorySharesStoreAcrossSeparateCalls` below for that path.
async function testNonDurableMemoryModeUsesInMemoryStores() {
  let factoryCalls = 0;
  const storage = createStoryLabCloudStorage({
    env: { STORY_LAB_CLOUD_STORAGE: 'non_durable_memory' },
    now: () => now,
    createExecutor() {
      factoryCalls += 1;
      throw new Error('executor should not initialize in non_durable_memory mode');
    }
  });

  assert(storage.mode === 'non_durable_memory', 'explicit opt-in should report non_durable_memory mode');
  assert(!storage.databaseUrlConfigured, 'non_durable_memory mode should not require DATABASE_URL');
  assert(!storage.executorConfigured, 'non_durable_memory mode should not create an executor');
  assert(storage.isConfigured(), 'non_durable_memory mode should be immediately configured');
  assert(factoryCalls === 0, 'executor factory should not run in non_durable_memory mode');

  const profile = createDefaultStoryLabUserProfile(owner, { displayName: 'Riven', now });
  const saveResult = await storage.profileStore.saveProfile(owner, profile);
  assert(saveResult.success, 'non-durable profile store should accept saves');
  const loadResult = await storage.profileStore.loadProfile(owner);
  assert(loadResult.success && loadResult.data?.profile.displayName === 'Riven', 'non-durable profile store should round-trip in-process');
  assert(loadResult.data?.createdAt === now, 'an explicit now should build a store that honors its own injected clock');

  const project = createProject();
  const projectSaveResult = await storage.projectStore.saveProject(owner, project);
  assert(projectSaveResult.success, 'non-durable project store should accept saves');
  const listResult = await storage.projectStore.listProjects(owner, wholeLibraryQuery);
  assert(listResult.success && listResult.data.items[0]?.projectId === project.id, 'non-durable project store should round-trip in-process');
}

// An explicit `now` is isolation, not just a clock override: a call that
// supplies one must not see records saved by a bare call sharing the
// singleton, or vice versa — otherwise "isolated" would be a lie.
async function testExplicitNowIsolatesFromTheSharedSingleton() {
  const isolatedStorage = createStoryLabCloudStorage({
    env: { STORY_LAB_CLOUD_STORAGE: 'non_durable_memory' },
    now: () => now
  });
  const sharedStorage = createStoryLabCloudStorage({ env: { STORY_LAB_CLOUD_STORAGE: 'non_durable_memory' } });

  const profile = createDefaultStoryLabUserProfile(owner, { displayName: 'Isolated-Clock-Caller' });
  const saveResult = await isolatedStorage.profileStore.saveProfile(owner, profile);
  assert(saveResult.success, 'the clock-isolated store should accept the save');

  const loadResult = await sharedStorage.profileStore.loadProfile(owner);
  assert(
    loadResult.success && loadResult.data === null,
    'the shared singleton should not see a save made through an explicit-now, isolated store'
  );
}

// Two independent `createStoryLabCloudStorage()` calls, exactly like two
// different route handlers each calling it once — neither passing `now` — must
// see the same records: a profile saved through one has to be visible through
// the other. This is the shape every real call site except the account route
// uses; `testDefaultAccountHandlerSharesNonDurableStorageWithGenerationRoutes`
// in `tests/story-lab-account-routes.test.ts` covers the account route's own
// call shape directly, against the real (unmodified) handler — a prior
// version of this suite instead hand-simulated that call shape here, which
// silently stopped matching the real code once the handler's own call site
// was fixed (see that file's own comment on this exact regression).
async function testNonDurableMemorySharesStoreAcrossSeparateCalls() {
  const firstCallStorage = createStoryLabCloudStorage({ env: { STORY_LAB_CLOUD_STORAGE: 'non_durable_memory' } });
  const secondCallStorage = createStoryLabCloudStorage({ env: { STORY_LAB_CLOUD_STORAGE: 'non_durable_memory' } });

  const profile = createDefaultStoryLabUserProfile(owner, { displayName: 'Marnie' });
  const saveResult = await firstCallStorage.profileStore.saveProfile(owner, profile);
  assert(saveResult.success, 'the first call\'s profile store should accept the save');

  const loadResult = await secondCallStorage.profileStore.loadProfile(owner);
  assert(
    loadResult.success && loadResult.data?.profile.displayName === 'Marnie',
    'a second, independent createStoryLabCloudStorage() call should see the first call\'s save'
  );
}

async function testUnsupportedModeFailsClosed() {
  const storage = createStoryLabCloudStorage({
    env: { STORY_LAB_CLOUD_STORAGE: 'planet-scale' },
    now: () => now
  });

  assert(storage.mode === 'unsupported', 'an unrecognized mode value should report unsupported');
  assert(storage.errorCode === 'STORY_LAB_CLOUD_STORAGE_UNSUPPORTED_MODE', 'unsupported mode should carry its error code');
  assert(!storage.isConfigured(), 'unsupported mode should never report configured');

  const profileResult = await storage.profileStore.loadProfile(owner);
  assert(!profileResult.success, 'profile store should fail closed on an unsupported mode');

  const projectResult = await storage.projectStore.listProjects(owner, wholeLibraryQuery);
  assert(!projectResult.success, 'project store should fail closed on an unsupported mode');
}

async function testCloudStorageModeEnvDoesNotFallThroughToProcessEnv() {
  const previousMode = process.env['STORY_LAB_CLOUD_STORAGE'];
  process.env['STORY_LAB_CLOUD_STORAGE'] = 'non_durable_memory';

  try {
    const storage = createStoryLabCloudStorage({ env: {}, now: () => now });
    assert(storage.mode === 'postgres', 'explicit empty env should not read process.env for the mode either');
  } finally {
    if (previousMode === undefined) {
      delete process.env['STORY_LAB_CLOUD_STORAGE'];
    } else {
      process.env['STORY_LAB_CLOUD_STORAGE'] = previousMode;
    }
  }
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
    id: 'project-cloud-config-1',
    storyId: 'story-cloud-config-1',
    title: 'Cloud Config Chapel',
    synopsis: 'A private oath saved through configured storage.',
    blueprint: {
      creature: 'witch',
      themes: [],
      logline: 'A witch protects a configured cloud library.',
      spicyLevel: 2,
      tone: 'gothic_romance',
      desiredWordBudget: 900,
      chapterBatchSize: 1,
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door',
        noGoContent: ''
      }
    },
    summary: {
      storyId: 'story-cloud-config-1',
      title: 'Cloud Config Chapel',
      synopsis: 'A private oath saved through configured storage.',
      tone: 'gothic_romance',
      spicyLevel: 2,
      createdAt: now,
      updatedAt: now
    },
    state: {
      storyId: 'story-cloud-config-1',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Gothic and precise.',
      lastUpdatedAt: now
    },
    chapters: [],
    createdAt: now,
    updatedAt: now
  };
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
