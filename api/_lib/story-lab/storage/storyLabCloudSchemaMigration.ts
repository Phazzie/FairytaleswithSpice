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
  return readFileSync(resolve('api/_lib/story-lab/storage/storyLabCloudSchema.sql'), 'utf8');
}

export function splitStoryLabCloudSchemaStatements(schemaSql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inLineComment = false;

  for (let index = 0; index < schemaSql.length; index += 1) {
    const char = schemaSql[index] ?? '';
    const next = schemaSql[index + 1] ?? '';

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (!inSingleQuote && char === '-' && next === '-') {
      inLineComment = true;
      current += char;
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
  return statement
    .split('\n')
    .some(line => {
      const trimmedLine = line.trim();
      return trimmedLine && !trimmedLine.startsWith('--');
    });
}
