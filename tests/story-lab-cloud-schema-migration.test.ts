#!/usr/bin/env tsx
// Created: 2026-06-08 11:05 EDT

import type { StoryLabCloudQueryExecutor } from '../api/_lib/story-lab/storage/storyLabCloudStorageConfig';
import {
  applyStoryLabCloudSchema,
  loadStoryLabCloudSchemaSql,
  splitStoryLabCloudSchemaStatements
} from '../api/_lib/story-lab/storage/storyLabCloudSchemaMigration';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

class FakeSchemaExecutor implements StoryLabCloudQueryExecutor {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  async query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }> {
    this.queries.push({ sql, params });
    return { rows: [] };
  }
}

async function main() {
  await testApplyRunsTrackedSchemaStatementsInOrder();
  testSqlSplitterKeepsSemicolonsInsideStrings();
  testSqlSplitterKeepsSemicolonsInsideBlockCommentsAndDollarQuotes();
  await testEmptySchemaFailsBeforeExecutorCall();
  testSchemaLoaderIsIndependentOfCurrentWorkingDirectory();

  console.log('Story Lab cloud schema migration tests passed');
}

async function testApplyRunsTrackedSchemaStatementsInOrder() {
  const executor = new FakeSchemaExecutor();
  const result = await applyStoryLabCloudSchema(executor, {
    now: () => '2026-06-08T11:05:00.000Z'
  });

  assert(result.applied, 'schema application should report applied');
  assert(result.appliedAt === '2026-06-08T11:05:00.000Z', 'schema application should use injected clock');
  assert(result.statementCount === executor.queries.length, 'result should report executed statement count');
  assert(executor.queries.length >= 6, 'tracked schema should execute all table, index, and comment statements');
  assert(executor.queries[0]?.sql.includes('create table if not exists story_lab_profiles'), 'profile table should be applied first');
  assert(executor.queries[1]?.sql.includes('create table if not exists story_projects'), 'project table should be applied second');
  assert(executor.queries.every(query => query.params.length === 0), 'schema statements should not use runtime params');
  assert(executor.queries.every(query => !query.sql.trim().endsWith(';')), 'schema statements should be sent without trailing semicolons');
}

function testSqlSplitterKeepsSemicolonsInsideStrings() {
  const statements = splitStoryLabCloudSchemaStatements(`
create table example (id text);
comment on table example is 'keep this semicolon; inside text';
create index example_idx on example (id);
  `);

  assert(statements.length === 3, 'splitter should return three statements');
  assert(statements[1]?.includes('semicolon; inside text'), 'splitter should keep semicolons inside quoted strings');
}

function testSqlSplitterKeepsSemicolonsInsideBlockCommentsAndDollarQuotes() {
  const statements = splitStoryLabCloudSchemaStatements(`
/* block comment with ; and ' characters */
create function example_fn() returns text as $$
begin
  return 'quoted; value';
end;
$$ language plpgsql;
create table example (id text);
  `);

  assert(statements.length === 2, 'splitter should ignore semicolons inside block comments and dollar quotes');
  assert(statements[0]?.includes("return 'quoted; value'"), 'splitter should preserve dollar-quoted function body');
  assert(statements[1]?.includes('create table example'), 'splitter should continue after dollar-quoted statement');
}

async function testEmptySchemaFailsBeforeExecutorCall() {
  const executor = new FakeSchemaExecutor();

  try {
    await applyStoryLabCloudSchema(executor, {
      schemaSql: "/* block comment with ; and ' only */\n -- comments only\n",
      now: () => '2026-06-08T11:05:00.000Z'
    });
    throw new Error('empty schema should throw');
  } catch (error) {
    assert(error instanceof Error, 'empty schema failure should be an Error');
    assert(error.message.includes('empty'), 'empty schema error should explain the problem');
  }

  assert(executor.queries.length === 0, 'empty schema should not call executor');
}

function testSchemaLoaderIsIndependentOfCurrentWorkingDirectory() {
  const originalCwd = process.cwd();

  try {
    process.chdir('tests');
    const loadedSchema = loadStoryLabCloudSchemaSql();
    assert(loadedSchema.includes('story_lab_profiles'), 'schema loader should use the module-relative schema path');
  } finally {
    process.chdir(originalCwd);
  }
}

const loadedSchema = loadStoryLabCloudSchemaSql();
assert(loadedSchema.includes('story_lab_profiles'), 'schema loader should read the tracked profile table contract');

main().catch(error => {
  console.error(error);
  process.exit(1);
});
