#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * What a Story Lab blueprint may say, and the two places that have to agree
 * about it.
 *
 * `parseStoryLabBlueprint` decides what the route accepts; `FormValidationService`
 * decides what the form lets a reader send. Both wrote out all seven
 * vocabularies — creature, tone, spicy level, word budget, batch size, heat
 * tension mode, intimacy boundary — and the route wrote two of them a second
 * time inside its heat-contract guard and restated three more in prose in its
 * error messages. Four of the seven already had a table beside their type in
 * `contracts.ts`, which neither copy read.
 *
 * Two hand-kept copies of one vocabulary fail in a particular direction: the
 * form accepts a value the route refuses, and the reader learns which by
 * pressing generate and being answered `400 INVALID_BLUEPRINT`, naming a field
 * by its wire name, on a form that never said there was a limit. That is the
 * failure `maxCharacterNameLength` in the shared blueprint limits was added to
 * end for the free-text fields; this is the same thing held on the value lists.
 *
 * So this file asserts both halves: that the route accepts every value the
 * contract names and refuses one it does not, and that neither reader has
 * grown its own copy of the list again.
 *
 * `FormValidationService` is read as source text rather than imported: it is an
 * `@Injectable` and the root test runner has no `@angular/core`, the same
 * arrangement `story-prompt-tables` and `author-style-banks` use.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './assert';
import { parseStoryLabBlueprintFromBody } from '../api/_lib/story-lab/validation/blueprintParser';
import {
  CHAPTER_BATCH_SIZES,
  CREATURE_ARCHETYPES,
  HEAT_INTIMACY_BOUNDARIES,
  HEAT_TENSION_MODES,
  NARRATIVE_TONES,
  SPICY_LEVELS,
  WORD_BUDGETS,
  formatChapterBatchSizeList,
  isChapterBatchSize
} from '../api/_lib/story-lab/contracts';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const baseBody = {
  creature: 'vampire',
  tone: 'dark_romance',
  spicyLevel: 3,
  desiredWordBudget: 900,
  chapterBatchSize: 2,
  logline: 'A vampire tests the shared blueprint vocabulary.',
  themes: [
    {
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'Desire has consequences.'
    }
  ],
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'No coercion.'
  }
};

function parseWith(overrides: Record<string, unknown>) {
  return parseStoryLabBlueprintFromBody({ ...baseBody, ...overrides });
}

function parseWithHeat(overrides: Record<string, unknown>) {
  return parseWith({ heatContract: { ...baseBody.heatContract, ...overrides } });
}

// ==================== The route takes every value the contract names ====================

const fields: Array<{
  field: string;
  values: readonly (string | number)[];
  refused: string | number;
}> = [
  { field: 'creature', values: CREATURE_ARCHETYPES, refused: 'basilisk' },
  { field: 'tone', values: NARRATIVE_TONES, refused: 'farce' },
  { field: 'spicyLevel', values: SPICY_LEVELS, refused: 6 },
  { field: 'desiredWordBudget', values: WORD_BUDGETS, refused: 750 },
  { field: 'chapterBatchSize', values: CHAPTER_BATCH_SIZES, refused: 4 }
];

for (const { field, values, refused } of fields) {
  assert(values.length > 0, `${field} should name at least one accepted value`);

  for (const value of values) {
    const result = parseWith({ [field]: value });
    assert(!result.error, `the route should accept ${field}=${value}, which the contract names`);
  }

  const rejected = parseWith({ [field]: refused });
  assert(rejected.error !== undefined, `the route should refuse ${field}=${refused}`);
  assert(
    rejected.error.invalidFields.includes(field),
    `the refusal for ${field}=${refused} should name ${field}`
  );
}

// The heat contract's two vocabularies were stated inline in the guard that
// reads them, where neither the form nor the contract could see them.
for (const tensionMode of HEAT_TENSION_MODES) {
  assert(!parseWithHeat({ tensionMode }).error, `the route should accept tensionMode=${tensionMode}`);
}
for (const intimacyBoundary of HEAT_INTIMACY_BOUNDARIES) {
  assert(!parseWithHeat({ intimacyBoundary }).error, `the route should accept intimacyBoundary=${intimacyBoundary}`);
}
assert(parseWithHeat({ tensionMode: 'smouldering' }).error !== undefined, 'the route should refuse an unknown tension mode');
assert(parseWithHeat({ intimacyBoundary: 'open_door' }).error !== undefined, 'the route should refuse an unknown intimacy boundary');

// The refusal messages restated the tables in prose, so a value added to a
// table left the message naming the old set. They are built from the table now.
const budgetRefusal = parseWith({ desiredWordBudget: 750 });
assert(budgetRefusal.error !== undefined, 'an unsupported word budget should be refused');
for (const budget of WORD_BUDGETS) {
  assert(
    budgetRefusal.error.message.includes(String(budget)),
    `the word-budget refusal should name ${budget}, which the route does accept`
  );
}

// ==================== One declaration, two readers ====================

for (const [label, path] of [
  ['blueprintParser', 'api/_lib/story-lab/validation/blueprintParser.ts'],
  ['FormValidationService', 'story-generator/src/app/form-validation.service.ts']
] as const) {
  const source = readSource(path);

  for (const table of ['CREATURE_ARCHETYPES', 'NARRATIVE_TONES', 'SPICY_LEVELS', 'WORD_BUDGETS', 'CHAPTER_BATCH_SIZES', 'HEAT_TENSION_MODES', 'HEAT_INTIMACY_BOUNDARIES']) {
    assert(source.includes(table), `${label} should read ${table} from the contract`);
  }

  // The declaration, not a mention: a docblock may name a creature in prose,
  // but a literal list of them is the copy this test exists to prevent.
  for (const [vocabulary, firstValue, secondValue] of [
    ['creatures', "'vampire'", "'werewolf'"],
    ['tones', "'romance'", "'dark_romance'"],
    ['tension modes', "'slow_burn'", "'dangerous_proximity'"],
    ['intimacy boundaries', "'fade_to_black'", "'closed_door'"]
  ] as const) {
    assert(
      !new RegExp(`${firstValue},\\s*${secondValue}`).test(source),
      `${label} lists the ${vocabulary} again; there should be one table`
    );
  }
}

// Batch size has a third and fourth checker the two above do not cover, because
// a continuation never reaches `parseStoryLabBlueprint`: it arrives at
// `POST /stories/:storyId/continue` or at the continuation half of `POST /jobs`,
// and both of those declared their own `isValidBatchSize` over a literal
// `[1, 2, 3]` — then explained the refusal as "a chapterBatchSize of 1-3", a
// third and fourth spelling of the same bound in the sentence describing it.
//
// The defect a fourth batch size would have caused is worth naming: the picker
// offers it and genesis accepts it, both reading the table, and the reader's
// next chapter request is refused by a route insisting on a range nobody told it
// had moved — a story generated at a size it cannot be continued at.
for (const [label, path] of [
  ['the continue route', 'api/story-lab/stories/[storyId]/continue.ts'],
  ['the job route handlers', 'api/_lib/story-lab/jobs/jobRouteHandlers.ts']
] as const) {
  const source = readSource(path);

  assert(
    source.includes('isChapterBatchSize'),
    `${label} should check the batch size with the predicate over CHAPTER_BATCH_SIZES`
  );
  assert(
    !/\[\s*1\s*,\s*2\s*,\s*3\s*\]/.test(source),
    `${label} lists the batch sizes again; there should be one table`
  );
  assert(
    !source.includes('chapterBatchSize of 1-3'),
    `${label} should name the accepted batch sizes from the list it checks, not as a prose range`
  );
}

// And the list the refusals render, which is the table's own contents.
assert(
  formatChapterBatchSizeList() === '1, 2, or 3',
  'the refusal should name every batch size the table holds'
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

console.log('Story Lab blueprint vocabulary tests passed');
