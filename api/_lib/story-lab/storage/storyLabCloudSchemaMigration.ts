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
  let current = '';
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;

  for (let index = 0; index < schemaSql.length; index += 1) {
    const char = schemaSql[index] ?? '';
    const next = schemaSql[index + 1] ?? '';

    if (dollarQuoteTag) {
      if (schemaSql.startsWith(dollarQuoteTag, index)) {
        current += dollarQuoteTag;
        index += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && char === '-' && next === '-') {
      inLineComment = true;
      current += char;
      continue;
    }

    if (!inSingleQuote && char === '/' && next === '*') {
      inBlockComment = true;
      current += char;
      continue;
    }

    const openingDollarQuoteTag = !inSingleQuote ? readDollarQuoteTag(schemaSql, index) : null;
    if (openingDollarQuoteTag) {
      dollarQuoteTag = openingDollarQuoteTag;
      current += openingDollarQuoteTag;
      index += openingDollarQuoteTag.length - 1;
      continue;
    }

    if (char === "'") {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        index += 1;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === ';' && !inSingleQuote) {
      pushStatement(statements, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushStatement(statements, current);

  return statements.filter(statement => hasSqlBody(statement));
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
  const match = schemaSql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
  return match?.[0] ?? null;
}

function stripBlockComments(statement: string): string {
  return statement.replace(/\/\*[\s\S]*?\*\//g, '');
}
