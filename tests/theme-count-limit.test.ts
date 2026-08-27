#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// How many themes one story may weave was written three times: once as
// `STORY_BLUEPRINT_LIMITS.maxThemes`, which the Story Lab form and
// `parseStoryLabBlueprint` enforce; once as `VALIDATION_RULES.themes.maxCount`,
// which `StoryService.validateStoryInput` enforces on the array that same
// blueprint becomes; and once as a bare `5` inside `toClassicThemes`, the
// function that turns the first into the second.
//
// `STORY_EVALUATION_LIMITS.maxThemes` beside the first already read it, and
// says why: these fields "name the same things". These two did not, and each
// direction of the drift fails silently in its own way — a sixth seed the
// picker offers and the classic route refuses after the reader presses
// generate, or a sixth seed everything accepts and `toClassicThemes` drops on
// the way to the generator, so the story is written without a theme the reader
// chose and nothing in the response says which.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VALIDATION_RULES } from '../api/_lib/types/contracts';
import { STORY_BLUEPRINT_LIMITS, STORY_EVALUATION_LIMITS } from '../shared/storyBlueprintLimits';
import { CLASSIC_STORY_THEMES } from '../shared/themeVocabulary';
import { toClassicGenerationInput } from '../api/_lib/story-lab/storyLabEngine';
import { assert } from './assert';

const repoRoot = process.cwd();

// ==================== One number, three readers ====================

assert(
  VALIDATION_RULES.themes.maxCount === STORY_BLUEPRINT_LIMITS.maxThemes,
  'the classic theme cap should be the shared blueprint limit'
);
assert(
  STORY_EVALUATION_LIMITS.maxThemes === STORY_BLUEPRINT_LIMITS.maxThemes,
  'the evaluation theme cap should be the shared blueprint limit'
);

const engineSource = readFileSync(join(repoRoot, 'api/_lib/story-lab/storyLabEngine.ts'), 'utf8');
assert(
  /\.slice\(0,\s*STORY_BLUEPRINT_LIMITS\.maxThemes\)/.test(engineSource),
  'toClassicThemes should cut at the shared limit rather than at a literal'
);

// ==================== The seam cuts where the validators cut ====================

// A blueprint carrying exactly the cap survives the conversion whole, and a
// blueprint carrying one more is cut to the number the classic validator will
// take — which is the same number, so nothing the two agree on is ever lost and
// nothing the conversion produces is ever refused.
function blueprintWithThemeCount(count: number) {
  return {
    creature: 'vampire',
    themes: Array.from({ length: count }, (_unused, index) => ({
      id: CLASSIC_SEED_IDS[index % CLASSIC_SEED_IDS.length],
      label: `Theme ${index}`,
      description: 'A seed.'
    })),
    logline: 'A duel at dawn.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black'
    }
  } as never;
}

// Distinct classic theme ids, so the count this measures is the cut and not a
// deduplication happening somewhere else.
const CLASSIC_SEED_IDS: readonly string[] = CLASSIC_STORY_THEMES;

assert(
  CLASSIC_SEED_IDS.length > STORY_BLUEPRINT_LIMITS.maxThemes,
  'this test needs more distinct classic themes than the cap allows'
);

const atCap = toClassicGenerationInput(blueprintWithThemeCount(STORY_BLUEPRINT_LIMITS.maxThemes));
assert(
  atCap.themes.length === STORY_BLUEPRINT_LIMITS.maxThemes,
  `a blueprint at the cap should keep every theme, got ${atCap.themes.length}`
);

const overCap = toClassicGenerationInput(blueprintWithThemeCount(STORY_BLUEPRINT_LIMITS.maxThemes + 1));
assert(
  overCap.themes.length === VALIDATION_RULES.themes.maxCount,
  `the conversion should cut to the count the classic route accepts, got ${overCap.themes.length}`
);

console.log('Theme count limit tests passed');
