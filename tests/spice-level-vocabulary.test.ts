#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The five heat levels are one table, and the classic seam checks membership in
// it rather than a range that only happens to describe it.
//
// `VALIDATION_RULES.spicyLevel` was `{ min: 1, max: 5 }` — the last statement of
// the scale on the path a request actually takes, and the only rule in that
// object describing its closed set as a range instead of naming it. What this
// file asserts is the part a type cannot: that every reader reads
// `shared/spiceLevelVocabulary`, that the refusal names the table's own contents
// rather than the ends of a range, and that the guard answers on membership for
// every value the old integer-plus-range pair answered on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SPICY_LEVELS,
  formatSpicyLevelList,
  isSpicyLevel
} from '../shared/spiceLevelVocabulary';
import { SPICY_LEVELS as CONTRACT_SPICY_LEVELS, VALIDATION_RULES } from '../api/_lib/types/contracts';
import { SPICY_LEVELS as ANGULAR_SPICY_LEVELS } from '../story-generator/src/app/contracts';
import { SPICE_LEVEL_PROMPT_RUNGS } from '../shared/spiceLevelPromptLadder';
import { StoryService } from '../api/_lib/services/storyService';
import { assert } from './assert';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

// ==================== The table has one home ====================

assert(SPICY_LEVELS.length === 5, 'the scale should still be five levels');
assert(
  new Set<number>(SPICY_LEVELS).size === SPICY_LEVELS.length,
  'the scale should not repeat a level'
);

// Both contracts point at that same array object rather than at a copy of it,
// the way `VALIDATION_RULES.themes.allowedValues` points at
// `CLASSIC_STORY_THEMES`.
assert(
  CONTRACT_SPICY_LEVELS === SPICY_LEVELS,
  "the API contract's table should be the shared table itself"
);
assert(
  ANGULAR_SPICY_LEVELS === SPICY_LEVELS,
  "the Angular contract's table should be the shared table itself"
);
assert(
  VALIDATION_RULES.spicyLevel.allowedValues === SPICY_LEVELS,
  'the classic validation rule should read the table rather than a range over it'
);

// ==================== Membership, not a range ====================

for (const level of SPICY_LEVELS) {
  assert(isSpicyLevel(level), `${level} is in the table and should be accepted`);
}
// The first four are what the range check refused too. `2.5` and `'3'` are the
// interesting ones: the range check only refused them because a separate
// `Number.isInteger` guard stood beside it, and `4.0` is accepted by both
// because it *is* the integer 4.
for (const rejected of [0, 6, -1, '3', 2.5, NaN, Infinity, null, undefined, [3]]) {
  assert(
    !isSpicyLevel(rejected),
    `${String(rejected)} is not a level this app writes at and should be refused`
  );
}
assert(isSpicyLevel(4.0), '4.0 is the integer 4 and should still be accepted');

// ==================== Nothing writes the scale out again ====================

// The declaration, not a mention: a docblock may name the range in prose — the
// vocabulary module's own does, at length — but the literal list or the bare
// min/max pair inside code is the copy these files exist without.
for (const [label, path] of [
  ['the classic story service', 'api/_lib/services/storyService.ts'],
  ['the API contract', 'api/_lib/types/contracts.ts'],
  ['the Angular contract', 'story-generator/src/app/contracts.ts']
] as const) {
  const source = readSource(path);

  assert(
    source.includes('spiceLevelVocabulary') || source.includes('SPICY_LEVELS'),
    `${label} should read the levels from the shared vocabulary`
  );
  assert(
    !/\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*\]/.test(source),
    `${label} lists the levels again; there should be one table`
  );
  assert(
    !/spicyLevel:\s*\{\s*\n?\s*min:\s*1/.test(source),
    `${label} states the scale as a range again; the rule reads the table`
  );
}

// ==================== The refusal renders the table ====================

assert(
  formatSpicyLevelList() === '1, 2, 3, 4, or 5',
  'the refusal should name every level the table holds'
);

const service = new StoryService();
const validateStoryInput = (input: unknown) =>
  (service as unknown as {
    validateStoryInput(input: unknown): { message?: string; expectedType?: string } | null;
  }).validateStoryInput(input);

const baseInput = {
  creature: 'vampire',
  themes: ['forbidden_love'],
  userInput: 'A duel at dawn.',
  wordCount: 900
};

const refusal = validateStoryInput({ ...baseInput, spicyLevel: 6 });
assert(refusal, 'a level outside the table should still be refused');
assert(
  refusal.message === `Invalid spicy level (must be ${formatSpicyLevelList()})`,
  `the refusal should name the table's contents, got: ${refusal.message}`
);
assert(
  refusal.expectedType === 'SpicyLevel',
  `the refused type should be the union's own name, got: ${refusal.expectedType}`
);

for (const level of SPICY_LEVELS) {
  assert(
    validateStoryInput({ ...baseInput, spicyLevel: level }) === null,
    `${level} is on the table and should be accepted by the classic seam`
  );
}
// The values the integer-plus-range pair refused, still refused — by one check
// rather than two that had to agree.
for (const rejected of [0, 6, 3.5, '3', undefined, null]) {
  assert(
    validateStoryInput({ ...baseInput, spicyLevel: rejected }) !== null,
    `${String(rejected)} is not a level and should be refused by the classic seam`
  );
}

// ==================== The prompt ladder covers the table ====================

// `readSpiceLevelPromptLabel` falls back to `Spicy` for a level with no rung, so
// a scale and a ladder that disagree reach the model as a `SPICE LEVEL:` line
// naming a rung the system prompt beside it never defines.
for (const level of SPICY_LEVELS) {
  assert(
    SPICE_LEVEL_PROMPT_RUNGS.some(rung => rung.level === level),
    `level ${level} is on the scale and should have a rung in the prompt ladder`
  );
}
assert(
  SPICE_LEVEL_PROMPT_RUNGS.length === SPICY_LEVELS.length,
  'the prompt ladder should describe the scale and nothing beyond it'
);

console.log('Spice level vocabulary tests passed');
