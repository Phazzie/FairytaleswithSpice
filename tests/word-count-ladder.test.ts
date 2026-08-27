#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The word counts the classic generator accepts were the last closed set in
// `api/_lib/types/contracts.ts` with no table behind it: a `WordCount` union at
// the top of the file and the bare literal `[600, 700, 900, 1200, 1500]` in
// `VALIDATION_RULES.wordCount.allowedValues` three hundred lines below, with
// nothing tying them together — while both neighbouring rules in that same
// object already read their tables. `StoryService.validateStoryInput` said so out
// loud, widening the literal to `readonly number[]` before testing membership
// because the tuple had no relationship to the union to check against.
//
// `WORD_COUNTS` is the one table now, and `WordCount` is derived from it. What
// this file asserts is the part a type cannot: that every reader is reading it,
// and that the ladder the Angular picker offers still fits inside the ladder
// this route accepts.

import {
  VALIDATION_RULES,
  WORD_COUNTS,
  isSupportedWordCount
} from '../api/_lib/types/contracts';
import { WORD_BUDGETS } from '../story-generator/src/app/contracts';
import { StoryService } from '../api/_lib/services/storyService';
import { assert } from './assert';

// ==================== The table has one home ====================

assert(WORD_COUNTS.length === 5, 'the ladder should still be five word counts');
assert(
  new Set<number>(WORD_COUNTS).size === WORD_COUNTS.length,
  'the ladder should not repeat a word count'
);

// The validation rule points at that same array object rather than a copy of it,
// the way `themes.allowedValues` points at `CLASSIC_STORY_THEMES`.
assert(
  VALIDATION_RULES.wordCount.allowedValues === WORD_COUNTS,
  'VALIDATION_RULES.wordCount.allowedValues should be the table itself'
);

// ==================== The guard answers for the table ====================

for (const wordCount of WORD_COUNTS) {
  assert(isSupportedWordCount(wordCount), `${wordCount} is on the ladder and should be supported`);
}

assert(!isSupportedWordCount(800), 'a budget between two rungs is not on the ladder');
assert(!isSupportedWordCount(1501), 'a budget past the top rung is not on the ladder');
assert(!isSupportedWordCount('900'), 'a budget sent as a string is not a word count');
assert(!isSupportedWordCount(undefined), 'an absent budget is not a word count');
assert(!isSupportedWordCount(Number.NaN), 'NaN is not a word count');

// ==================== The picker fits inside the route ====================

// `WORD_BUDGETS` is the Story Lab picker's four choices and `WORD_COUNTS` is
// what the classic validator accepts, so the picker must be a subset. The
// expensive direction of this drift is a budget the form offers and the route
// refuses: the reader finds out only after pressing generate, on a form that
// only ever offered them four choices.
for (const budget of WORD_BUDGETS) {
  assert(
    isSupportedWordCount(budget),
    `the picker offers ${budget}, so the classic route must accept it`
  );
}

// ==================== The validator reads the guard ====================

const service = new StoryService() as any;

function blueprintWithWordCount(wordCount: number) {
  return {
    creature: 'vampire',
    themes: ['forbidden_love'],
    userInput: 'A test brief.',
    spicyLevel: 3,
    wordCount
  };
}

for (const wordCount of WORD_COUNTS) {
  assert(
    service.validateStoryInput(blueprintWithWordCount(wordCount)) === null,
    `the validator should accept ${wordCount}, which is on the ladder`
  );
}

const offLadder = service.validateStoryInput(blueprintWithWordCount(800));
assert(offLadder !== null, 'the validator should refuse a budget off the ladder');
assert(
  offLadder.field === 'wordCount' && offLadder.expectedType === 'WordCount',
  'the refusal should name the wordCount field and its type'
);

console.log('word-count-ladder tests passed');
