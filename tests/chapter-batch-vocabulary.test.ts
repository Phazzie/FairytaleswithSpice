#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// A Story Lab `chapterBatchSize` and a classic `requestedChapterCount` are one
// value: `toClassicGenerationInput` and its continuation sibling in
// `storyLabEngine` pass the first straight into the second. The Story Lab half
// of that value was made one table when both continuation routes were caught
// writing `[1, 2, 3].includes(size)` by hand; the classic half kept six copies
// of the same bound, all inside the seam the Story Lab hands its blueprint to.
//
// What this file asserts is the part a type cannot: that every reader is
// reading `shared/chapterBatchVocabulary`, that the refusals name the table's
// own contents rather than a range from memory, and that the clamp behind
// `normalizeChapterCount` still answers what the hardcoded one answered on
// every input the app can produce.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHAPTER_BATCH_SIZES,
  clampToChapterBatchSize,
  formatChapterBatchSizeList,
  isChapterBatchSize
} from '../shared/chapterBatchVocabulary';
import { CHAPTER_BATCH_SIZES as CONTRACT_BATCH_SIZES } from '../api/_lib/types/contracts';
import { CHAPTER_BATCH_SIZES as ANGULAR_BATCH_SIZES } from '../story-generator/src/app/contracts';
import { StoryService } from '../api/_lib/services/storyService';
import { assert } from './assert';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

// ==================== The table has one home ====================

assert(CHAPTER_BATCH_SIZES.length === 3, 'the ladder should still be three batch sizes');
assert(
  new Set<number>(CHAPTER_BATCH_SIZES).size === CHAPTER_BATCH_SIZES.length,
  'the ladder should not repeat a batch size'
);

// Both contracts point at that same array object rather than at a copy of it,
// the way `VALIDATION_RULES.themes.allowedValues` points at
// `CLASSIC_STORY_THEMES`.
assert(
  CONTRACT_BATCH_SIZES === CHAPTER_BATCH_SIZES,
  "the API contract's table should be the shared table itself"
);
assert(
  ANGULAR_BATCH_SIZES === CHAPTER_BATCH_SIZES,
  "the Angular contract's table should be the shared table itself"
);

for (const size of CHAPTER_BATCH_SIZES) {
  assert(isChapterBatchSize(size), `${size} is in the table and should be accepted`);
}
for (const rejected of [0, 4, '2', 2.5, NaN, null, undefined]) {
  assert(
    !isChapterBatchSize(rejected),
    `${String(rejected)} is not a batch size this app runs and should be refused`
  );
}

// ==================== Nothing writes the bound out again ====================

// The declaration, not a mention: a docblock may name the range in prose — the
// vocabulary module's own does, at length — but the literal list or the prose
// range inside code is the copy these files exist without.
for (const [label, path] of [
  ['the classic story service', 'api/_lib/services/storyService.ts'],
  ['the API contract', 'api/_lib/types/contracts.ts'],
  ['the Angular form validator', 'story-generator/src/app/form-validation.service.ts']
] as const) {
  const source = readSource(path);

  assert(
    source.includes('chapterBatchVocabulary') || source.includes('formatChapterBatchSizeList'),
    `${label} should read the batch sizes from the shared vocabulary`
  );
  assert(
    !/\[\s*1\s*,\s*2\s*,\s*3\s*\]/.test(source),
    `${label} lists the batch sizes again; there should be one table`
  );
  assert(
    !/requestedChapterCount\??:\s*1\s*\|\s*2\s*\|\s*3/.test(source),
    `${label} spells the batch sizes as a union again; the type comes from the table`
  );
  assert(
    !source.includes('must be 1, 2, or 3') && !source.includes('Choose 1, 2, or 3'),
    `${label} should name the accepted batch sizes from the list it checks, not from memory`
  );
}

// ==================== The refusals render the table ====================

assert(
  formatChapterBatchSizeList() === '1, 2, or 3',
  'the refusal should name every batch size the table holds'
);

const service = new StoryService();
const refusal = (service as unknown as {
  validateStoryInput(input: unknown): { message?: string; expectedType?: string } | null;
}).validateStoryInput({
  creature: 'vampire',
  themes: ['forbidden_love'],
  userInput: 'A duel at dawn.',
  spicyLevel: 3,
  wordCount: 900,
  requestedChapterCount: 4
});

assert(refusal, 'a batch size outside the table should still be refused');
assert(
  refusal.message === `requestedChapterCount must be ${formatChapterBatchSizeList()}`,
  `the refusal should name the table's contents, got: ${refusal.message}`
);
assert(
  refusal.expectedType === CHAPTER_BATCH_SIZES.join(' | '),
  `the refused type should be read from the table, got: ${refusal.expectedType}`
);

for (const accepted of [...CHAPTER_BATCH_SIZES, undefined]) {
  assert(
    (service as unknown as {
      validateStoryInput(input: unknown): unknown;
    }).validateStoryInput({
      creature: 'vampire',
      themes: ['forbidden_love'],
      userInput: 'A duel at dawn.',
      spicyLevel: 3,
      wordCount: 900,
      requestedChapterCount: accepted
    }) === null,
    `${String(accepted)} is on the table and should be accepted`
  );
}

// The form's refusal is the same sentence for the same reason: it is the one
// message whose whole job is to list the values, so drift reaches the reader as
// a lie rather than as a silence. Read from the source rather than by calling
// the service, which is an Angular injectable and pulls `@angular/core` into a
// tsx run that has no Angular in it — the same reason
// `story-lab-picker-vocabulary` scans these files rather than instantiating
// them.
const formValidatorSource = readSource('story-generator/src/app/form-validation.service.ts');

assert(
  formValidatorSource.includes('`Choose ${formatChapterBatchSizeList()} chapters per batch.`'),
  "the form's batch-size refusal should render the table rather than restate it"
);
assert(
  formValidatorSource.includes('${SPICY_LEVELS[0]}')
    && formValidatorSource.includes('${SPICY_LEVELS[SPICY_LEVELS.length - 1]}'),
  "the form's spicy-level refusal should render the ladder's own ends rather than restate them"
);

// ==================== The clamp reads the table ====================

// `normalizeChapterCount` is reached only after the guard above has accepted
// the value or found it absent, so these are what it answers on every path the
// app can take: exactly what it was given, and the smallest size for nothing.
assert(clampToChapterBatchSize(undefined) === 1, 'an absent count should mean the smallest batch');
for (const size of CHAPTER_BATCH_SIZES) {
  assert(clampToChapterBatchSize(size) === size, `${size} is on the table and should survive intact`);
}

// And these are the guarded paths, kept identical to the hardcoded form the
// clamp replaces — except `NaN`, which satisfied neither `<= 1` nor `>= 3` and
// so fell through to a literal `2`: a two-chapter batch conjured from a value
// that was not a number.
assert(clampToChapterBatchSize(0) === 1, 'a count below the table should clamp up to the smallest');
assert(clampToChapterBatchSize(4) === 3, 'a count above the table should clamp down to the largest');
assert(clampToChapterBatchSize(2.5) === 2, 'a count between two sizes should take the lower one');
assert(clampToChapterBatchSize(NaN) === 1, 'an unreadable count should mean the smallest batch');

console.log('Chapter batch vocabulary tests passed');
