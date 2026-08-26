#!/usr/bin/env tsx
// Created: 2026-08-26 UTC
//
// Every theme seed the Angular tree hands to a blueprint has to be a theme the
// API recognises.
//
// `shared/storyLabThemeSeeds.ts` exists because this list had one copy and
// several readers, and that had already cost the same bug twice —
// `ImageService.mapThemeToVisualElement` describing seven of the twelve seeds to
// the image model as `mysterious elements`, and `toLoggableThemes` counting
// those same seven under `unrecognizedThemeCount`. Moving the list somewhere
// both trees can read it fixed the readers; it did not stop a *writer* from
// spelling a seed by hand.
//
// One had. `StreamingStoryComponent` carried a hand-written blueprint whose
// second seed was `ancient_curses`, which is on neither vocabulary the seams
// accept — not the twelve Story Lab seeds, and not the eighteen classic
// `ThemeType` values — so every stream it opened sent the genesis route, and
// from there the image and log paths, a theme id nothing downstream could read.
//
// This scans the ids that actually reach a blueprint rather than asserting that
// any particular file imports the shared list: a component is free to name a
// seed literally, as `DebugPanel` does, as long as the seed exists.

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { VALIDATION_RULES } from '../api/_lib/types/contracts';
import { STORY_LAB_THEME_SEED_IDS } from '../shared/storyLabThemeSeeds';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const repoRoot = process.cwd();
const angularAppDir = join(repoRoot, 'story-generator/src/app');

/**
 * Both vocabularies, for the reason `toLoggableThemes` recognises both: the
 * seams type `themes` as `string[]`, the pickers send the Story Lab seed ids,
 * and a caller sending a classic `ThemeType` is still sending a theme.
 */
const RECOGNIZED_THEME_IDS = new Set<string>([
  ...VALIDATION_RULES.themes.allowedValues,
  ...STORY_LAB_THEME_SEED_IDS
]);

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(entryPath);
    }

    return extname(entry.name) === '.ts' ? [entryPath] : [];
  });
}

/**
 * The source of every `themes: [...]` array literal in `source`.
 *
 * Bracket-matched rather than matched with one regex: a seed carries a
 * description written in prose, and prose contains brackets. Counting depth
 * from the opening `[` ends the literal where it actually ends, and a literal
 * whose brackets never balance — which would mean the file does not parse — is
 * simply not reported rather than swallowing the rest of the file.
 */
function readThemesArrayLiterals(source: string): string[] {
  const literals: string[] = [];
  const openings = source.matchAll(/\bthemes\s*:\s*\[/g);

  for (const opening of openings) {
    const start = opening.index + opening[0].length - 1;
    let depth = 0;

    for (let cursor = start; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (character === '[') {
        depth += 1;
        continue;
      }

      if (character === ']') {
        depth -= 1;
        if (depth === 0) {
          literals.push(source.slice(start, cursor + 1));
          break;
        }
      }
    }
  }

  return literals;
}

const offenders: string[] = [];
let seedsChecked = 0;

for (const filePath of listTypeScriptFiles(angularAppDir)) {
  const source = readFileSync(filePath, 'utf8');

  for (const literal of readThemesArrayLiterals(source)) {
    for (const seed of literal.matchAll(/\bid\s*:\s*'([^']*)'/g)) {
      const id = seed[1];
      seedsChecked += 1;

      if (!RECOGNIZED_THEME_IDS.has(id)) {
        offenders.push(`${relative(repoRoot, filePath)} sends the theme id '${id}'`);
      }
    }
  }
}

// The scan is only worth its assertion if it found the literals it is about:
// `DebugPanel`'s single hand-written seed is the one this suite knows is there
// and legitimate, so a scan that reports nothing has stopped reading the tree.
assert(
  seedsChecked > 0,
  'the scan should have found at least one hand-written theme seed in the Angular tree'
);

assert(
  offenders.length === 0,
  `every theme seed sent from the Angular tree must be a theme the API recognises:\n  ${offenders.join('\n  ')}`
);

console.log(`Story Lab theme seed usage tests passed (${seedsChecked} hand-written seeds checked)`);
