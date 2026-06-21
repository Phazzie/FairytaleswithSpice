// Created: 2026-06-08 11:05 EDT

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StoryLabCloudQueryExecutor } from './storyLabCloudStorageConfig';

export interface ApplyStoryLabCloudSchemaOptions {
  schemaSql?: string;
  now?: () => string;
}

export interface ApplyStoryLabCloudSchemaResult {
  applied: true;
  statementCount: number;
  appliedAt: string;
}

export async function applyStoryLabCloudSchema(
  executor: StoryLabCloudQueryExecutor,
  options: ApplyStoryLabCloudSchemaOptions = {}
): Promise<ApplyStoryLabCloudSchemaResult> {
  const schemaSql = options.schemaSql ?? loadStoryLabCloudSchemaSql();
  const statements = splitStoryLabCloudSchemaStatements(schemaSql);

  if (statements.length === 0) {
    throw new Error('Story Lab cloud schema is empty.');
  }

  for (const statement of statements) {
    await executor.query(statement, []);
  }

  return {
    applied: true,
    statementCount: statements.length,
    appliedAt: options.now?.() ?? new Date().toISOString()
  };
}

export function loadStoryLabCloudSchemaSql(): string {
  return readFileSync(resolve(__dirname, 'storyLabCloudSchema.sql'), 'utf8');
}

export function splitStoryLabCloudSchemaStatements(schemaSql: string): string[] {
  const statements: string[] = [];
  const state: SchemaSqlSplitState = {
    current: '',
    inSingleQuote: false,
    inLineComment: false,
    inBlockComment: false,
    dollarQuoteTag: null
  };

  for (let index = 0; index < schemaSql.length; index += 1) {
    index = consumeSchemaSqlCharacter(schemaSql, index, state, statements);
  }

  pushStatement(statements, state.current);

  return statements.filter(statement => hasSqlBody(statement));
}

interface SchemaSqlSplitState {
  current: string;
  inSingleQuote: boolean;
  inLineComment: boolean;
  inBlockComment: boolean;
  dollarQuoteTag: string | null;
}

function consumeSchemaSqlCharacter(
  schemaSql: string,
  index: number,
  state: SchemaSqlSplitState,
  statements: string[]
): number {
  const contextIndex = consumeActiveSqlContext(schemaSql, index, state);
  if (contextIndex !== null) {
    return contextIndex;
  }

  const openingIndex = consumeOpeningSqlContext(schemaSql, index, state);
  if (openingIndex !== null) {
    return openingIndex;
  }

  return consumePlainSqlCharacter(schemaSql, index, state, statements);
}

function consumeActiveSqlContext(schemaSql: string, index: number, state: SchemaSqlSplitState): number | null {
  if (state.dollarQuoteTag) {
    return consumeDollarQuotedSql(schemaSql, index, state);
  }

  if (state.inLineComment) {
    return consumeLineComment(schemaSql, index, state);
  }

  if (state.inBlockComment) {
    return consumeBlockComment(schemaSql, index, state);
  }

  return null;
}

function consumeDollarQuotedSql(schemaSql: string, index: number, state: SchemaSqlSplitState): number {
  const tag = state.dollarQuoteTag ?? '';
  if (schemaSql.startsWith(tag, index)) {
    state.current += tag;
    state.dollarQuoteTag = null;
    return index + tag.length - 1;
  }

  state.current += schemaSql[index] ?? '';
  return index;
}

function consumeLineComment(schemaSql: string, index: number, state: SchemaSqlSplitState): number {
  const char = schemaSql[index] ?? '';
  state.current += char;
  if (char === '\n') {
    state.inLineComment = false;
  }

  return index;
}

function consumeBlockComment(schemaSql: string, index: number, state: SchemaSqlSplitState): number {
  const char = schemaSql[index] ?? '';
  const next = schemaSql[index + 1] ?? '';
  state.current += char;
  if (char === '*' && next === '/') {
    state.current += next;
    state.inBlockComment = false;
    return index + 1;
  }

  return index;
}

function consumeOpeningSqlContext(schemaSql: string, index: number, state: SchemaSqlSplitState): number | null {
  const char = schemaSql[index] ?? '';
  const next = schemaSql[index + 1] ?? '';

  if (state.inSingleQuote) {
    return null;
  }

  if (char === '-' && next === '-') {
    state.inLineComment = true;
    state.current += char;
    return index;
  }

  if (char === '/' && next === '*') {
    state.inBlockComment = true;
    state.current += char;
    return index;
  }

  return consumeOpeningDollarQuote(schemaSql, index, state);
}

function consumeOpeningDollarQuote(schemaSql: string, index: number, state: SchemaSqlSplitState): number | null {
  const openingDollarQuoteTag = readDollarQuoteTag(schemaSql, index);
  if (!openingDollarQuoteTag) {
    return null;
  }

  state.dollarQuoteTag = openingDollarQuoteTag;
  state.current += openingDollarQuoteTag;
  return index + openingDollarQuoteTag.length - 1;
}

function consumePlainSqlCharacter(
  schemaSql: string,
  index: number,
  state: SchemaSqlSplitState,
  statements: string[]
): number {
  const char = schemaSql[index] ?? '';
  const next = schemaSql[index + 1] ?? '';

  if (char === "'") {
    return consumeSingleQuote(schemaSql, index, state, next);
  }

  if (char === ';' && !state.inSingleQuote) {
    pushStatement(statements, state.current);
    state.current = '';
    return index;
  }

  state.current += char;
  return index;
}

function consumeSingleQuote(
  schemaSql: string,
  index: number,
  state: SchemaSqlSplitState,
  next: string
): number {
  state.current += schemaSql[index] ?? '';
  if (state.inSingleQuote && next === "'") {
    state.current += next;
    return index + 1;
  }

  state.inSingleQuote = !state.inSingleQuote;
  return index;
}

function pushStatement(statements: string[], statement: string): void {
  const trimmedStatement = statement.trim();
  if (trimmedStatement) {
    statements.push(trimmedStatement);
  }
}

function hasSqlBody(statement: string): boolean {
  return stripBlockComments(statement)
    .split('\n')
    .some(line => {
      const [sqlBeforeLineComment] = line.split('--');
      return Boolean(sqlBeforeLineComment?.trim());
    });
}

function readDollarQuoteTag(schemaSql: string, index: number): string | null {
  const match = /^\$(?:[A-Za-z_]\w*)?\$/.exec(schemaSql.slice(index));
  return match?.[0] ?? null;
}

function stripBlockComments(statement: string): string {
  return statement.replace(/\/\*[\s\S]*?\*\//g, '');
}
