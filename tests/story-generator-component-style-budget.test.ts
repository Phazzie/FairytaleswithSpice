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
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .trim();
}

const appComponentStyleFiles = readdirSync(appStylesDir)
  .filter((fileName) => /^app(?:-.+)?\.css$/.test(fileName))
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
