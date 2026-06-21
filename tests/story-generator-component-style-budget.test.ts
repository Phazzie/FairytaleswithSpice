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
  let compacted = '';
  let lastCompactedChar = '';
  let pendingSlash = false;
  let insideComment = false;
  let commentMayEnd = false;
  let previousWasWhitespace = false;

  for (const current of source) {
    if (insideComment) {
      if (commentMayEnd && current === '/') {
        insideComment = false;
        commentMayEnd = false;
        continue;
      }

      commentMayEnd = current === '*';
      continue;
    }

    if (pendingSlash) {
      if (current === '*') {
        insideComment = true;
        pendingSlash = false;
        commentMayEnd = false;
        continue;
      }

      if (previousWasWhitespace && lastCompactedChar && !isCssSeparator(lastCompactedChar)) {
        compacted += ' ';
        lastCompactedChar = ' ';
      }
      compacted += '/';
      lastCompactedChar = '/';
      pendingSlash = false;
      previousWasWhitespace = false;
    }

    if (current === '/') {
      pendingSlash = true;
      continue;
    }

    if (isCssWhitespace(current)) {
      previousWasWhitespace = compacted.length > 0;
      continue;
    }

    if (isCssSeparator(current)) {
      compacted = compacted.trimEnd() + current;
      lastCompactedChar = current;
      previousWasWhitespace = false;
      continue;
    }

    if (previousWasWhitespace && lastCompactedChar && !isCssSeparator(lastCompactedChar)) {
      compacted += ' ';
      lastCompactedChar = ' ';
    }
    compacted += current;
    lastCompactedChar = current;
    previousWasWhitespace = false;
  }

  if (pendingSlash) {
    compacted += '/';
  }

  return compacted.trim();
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
