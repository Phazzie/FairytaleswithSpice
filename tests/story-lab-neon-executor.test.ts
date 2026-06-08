#!/usr/bin/env tsx
// Created: 2026-06-08 11:00 EDT

import { createNeonStoryLabQueryExecutor } from '../api/_lib/story-lab/storage/neonStoryLabExecutor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  await testInjectedNeonQueryReceivesSqlAndParams();
  await testMissingDatabaseUrlFailsBeforeCreatingQuery();
  await testQueryErrorsPropagateToStores();

  console.log('Story Lab Neon executor tests passed');
}

async function testInjectedNeonQueryReceivesSqlAndParams() {
  let factoryCalls = 0;
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  const executor = createNeonStoryLabQueryExecutor('postgres://example.invalid/story_lab', {
    createQuery(databaseUrl) {
      factoryCalls += 1;
      assert(databaseUrl === 'postgres://example.invalid/story_lab', 'Neon factory should receive database URL');
      return async (sql, params) => {
        calls.push({ sql, params });
        return [{ id: 'row-1' }];
      };
    }
  });

  const result = await executor.query<{ id: string }>('select * from story_projects where owner_user_id = $1', [
    'user-owner'
  ]);

  assert(factoryCalls === 1, 'Neon query factory should run once');
  assert(result.rows[0]?.id === 'row-1', 'executor should return query rows');
  assert(calls[0]?.sql.includes('story_projects'), 'executor should pass SQL text to Neon');
  assert(calls[0]?.params[0] === 'user-owner', 'executor should pass params to Neon');
}

async function testMissingDatabaseUrlFailsBeforeCreatingQuery() {
  let factoryCalls = 0;

  try {
    createNeonStoryLabQueryExecutor('', {
      createQuery() {
        factoryCalls += 1;
        return async () => [];
      }
    });
    throw new Error('missing database URL should throw');
  } catch (error) {
    assert(error instanceof Error, 'missing URL failure should be an Error');
    assert(error.message.includes('DATABASE_URL'), 'missing URL error should name DATABASE_URL');
  }

  assert(factoryCalls === 0, 'missing URL should not create a Neon query function');
}

async function testQueryErrorsPropagateToStores() {
  const executor = createNeonStoryLabQueryExecutor('postgres://example.invalid/story_lab', {
    createQuery() {
      return async () => {
        throw new Error('database unavailable');
      };
    }
  });

  try {
    await executor.query('select 1', []);
    throw new Error('query failure should throw');
  } catch (error) {
    assert(error instanceof Error, 'query failure should remain an Error');
    assert(error.message.includes('database unavailable'), 'query failure should preserve provider error for store handling');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
