#!/usr/bin/env tsx

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const componentStyleBudgetBytes = 12_000;
const appStylesDir = join(process.cwd(), 'story-generator/src/app');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function compactCss(source: string): string {
  return compactCssWhitespace(stripCssComments(source)).trim();
}

function stripCssComments(source: string): string {
  let stripped = '';
  let cursor = 0;

  while (cursor < source.length) {
    const commentStart = source.indexOf('/*', cursor);
    if (commentStart === -1) {
      return stripped + source.slice(cursor);
    }

    stripped += source.slice(cursor, commentStart);
    const commentEnd = source.indexOf('*/', commentStart + 2);
    if (commentEnd === -1) {
      return stripped;
    }

    cursor = commentEnd + 2;
  }

  return stripped;
}

function compactCssWhitespace(source: string): string {
  let compacted = '';
  let previousWasWhitespace = false;

  for (const current of source) {
    if (isCssWhitespace(current)) {
      previousWasWhitespace = compacted.length > 0;
      continue;
    }

    if (isCssSeparator(current)) {
      compacted = compacted.trimEnd() + current;
      previousWasWhitespace = false;
      continue;
    }

    if (shouldPreserveCssWhitespace(previousWasWhitespace, compacted)) {
      compacted += ' ';
    }
    compacted += current;
    previousWasWhitespace = false;
  }

  return compacted;
}

function shouldPreserveCssWhitespace(previousWasWhitespace: boolean, compacted: string): boolean {
  const previous = compacted.at(-1) ?? '';
  return previousWasWhitespace && previous.length > 0 && !isCssSeparator(previous);
}

function isCssWhitespace(value: string): boolean {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t' || value === '\f';
}

function isCssSeparator(value: string): boolean {
  return value === '{'
    || value === '}'
    || value === ':'
    || value === ';'
    || value === ','
    || value === '>'
    || value === '+'
    || value === '~';
}

const appComponentStyleFiles = readdirSync(appStylesDir)
  .filter((fileName) => fileName === 'app.css' || (fileName.startsWith('app-') && fileName.endsWith('.css')))
  .sort();

assert(appComponentStyleFiles.length > 0, 'expected Story Lab app component style files to exist');

for (const fileName of appComponentStyleFiles) {
  const filePath = join(appStylesDir, fileName);
  const source = readFileSync(filePath, 'utf8');
  const minified = compactCss(source);
  const byteCount = Buffer.byteLength(minified, 'utf8');

  assert(
    byteCount <= componentStyleBudgetBytes,
    `${fileName} minifies to ${byteCount} bytes; keep each Story Lab component style file at or below ${componentStyleBudgetBytes} bytes`
  );
}

console.log('Story generator component style budget tests passed');
