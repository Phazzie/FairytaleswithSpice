#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * The beat-structure and Chekhov tables are what the story prompt is built
 * from and what the Proving Grounds panel previews, and they lived twice: once
 * in `StoryService` and once again in `GenerationLogicService` in the Angular
 * tree. The twenty entries of each were identical character for character,
 * which is the only reason the panel was telling the truth.
 *
 * The failure that arrangement produces is already on the record one table
 * over. `GenerationLogicService` kept its own copy of the author banks, the API
 * grew `SIREN_STYLES` and `DJINN_STYLES`, and the copy did not — so for two of
 * the ten creatures the panel named twelve fae authors for a story the server
 * wrote from four sea or wish voices. Nothing failed; the preview simply
 * described a run that never happened, and a reader comparing prompts has no
 * way to tell.
 *
 * So this file asserts the property that stops it recurring: the tables are
 * declared once, and both readers read that declaration. A copy pasted back
 * into either tree fails here rather than being noticed by the next author.
 *
 * The Angular service is read as source text rather than imported: it is an
 * `@Injectable` and the root test runner has no `@angular/core`, the same
 * arrangement `proving-grounds-production-prompt` and the component style
 * budget test use.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import {
  STORY_BEAT_STRUCTURES,
  STORY_CHEKHOV_ELEMENTS,
  STORY_CHEKHOV_ELEMENTS_PER_STORY
} from '../shared/storyPromptTables';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const storyServiceSource = readSource('api/_lib/services/storyService.ts');
const generationLogicSource = readSource('story-generator/src/app/proving-grounds/generation-logic.service.ts');

// ==================== The tables themselves ====================

assert(
  STORY_BEAT_STRUCTURES.length === 20,
  `the prompt promises twenty beat structures, found ${STORY_BEAT_STRUCTURES.length}`
);
assert(
  new Set(STORY_BEAT_STRUCTURES.map(structure => structure.name)).size === STORY_BEAT_STRUCTURES.length,
  'two beat structures share a name, so the prompt cannot say which one was drawn'
);
for (const structure of STORY_BEAT_STRUCTURES) {
  for (const field of ['name', 'beats', 'spiceIntegration', 'avoid'] as const) {
    assert(
      typeof structure[field] === 'string' && structure[field].trim().length > 0,
      `beat structure ${structure.name} has no ${field}, and every field is written into the prompt`
    );
    // The rows are delimited, so a cell that still holds the delimiter is a row
    // whose columns did not land where they were meant to — a mistyped edit that
    // would otherwise reach the prompt looking like ordinary prose.
    assert(
      !structure[field].includes('|'),
      `beat structure ${structure.name} has a stray delimiter in ${field}; its row is mis-split`
    );
  }
}

assert(
  STORY_CHEKHOV_ELEMENTS.length === 20,
  `the prompt promises twenty Chekhov elements, found ${STORY_CHEKHOV_ELEMENTS.length}`
);
assert(
  new Set(STORY_CHEKHOV_ELEMENTS).size === STORY_CHEKHOV_ELEMENTS.length,
  'a repeated Chekhov element can be planted twice as if it were two devices'
);
assert(
  STORY_CHEKHOV_ELEMENTS_PER_STORY >= 1 && STORY_CHEKHOV_ELEMENTS_PER_STORY <= STORY_CHEKHOV_ELEMENTS.length,
  'a story cannot plant more distinct elements than the table holds'
);

// ==================== One declaration, two readers ====================

for (const [label, source] of [
  ['StoryService', storyServiceSource],
  ['GenerationLogicService', generationLogicSource]
] as const) {
  assert(
    /from\s+'[^']*shared\/storyPromptTables'/.test(source),
    `${label} should read the prompt tables from shared/storyPromptTables`
  );

  // The declaration, not a mention: `getRandomBeatStructure`'s docblock names
  // TEMPTATION CASCADE in prose, which is fine — a second `name:` entry is the
  // copy this test exists to prevent.
  assert(
    !/name:\s*["']TEMPTATION CASCADE["']/.test(source),
    `${label} declares its own beat-structure table again; there should be one`
  );
  assert(
    !source.includes(`"${STORY_CHEKHOV_ELEMENTS[0]}"`),
    `${label} declares its own Chekhov table again; there should be one`
  );
}

// The count is the API's. A preview listing three where the prompt plants two
// would be describing a run that never happened, so the panel slices by the
// shared constant rather than by a number of its own.
assert(
  generationLogicSource.includes('STORY_CHEKHOV_ELEMENTS_PER_STORY'),
  'the preview should plant as many elements as the prompt does, read from the shared count'
);
assert(
  storyServiceSource.includes('STORY_CHEKHOV_ELEMENTS_PER_STORY'),
  'the prompt should plant as many elements as it names, read from the shared count'
);

// The prompt names them `[Chekhov1]` and `[Chekhov2]`, so a count changed
// without that template changing would leave an element planted and unnamed.
// The three lines they are written into moved to `shared/productionStoryPrompt`
// when the Proving Grounds stopped transcribing the prompt and started building
// it; the slots are counted where they are now written.
const productionPromptSource = readFileSync(
  join(process.cwd(), 'shared/productionStoryPrompt.ts'),
  'utf8'
);
const namedChekhovSlots = (productionPromptSource.match(/\[Chekhov\d+\]:/g) ?? []).length;
assert(
  namedChekhovSlots === STORY_CHEKHOV_ELEMENTS_PER_STORY,
  `the prompt names ${namedChekhovSlots} Chekhov slots but plants ${STORY_CHEKHOV_ELEMENTS_PER_STORY}`
);

console.log('Story prompt table tests passed');
