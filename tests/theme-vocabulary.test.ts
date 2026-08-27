#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The eighteen classic themes had four hand-written copies: the `ThemeType`
// union, `VALIDATION_RULES.themes.allowedValues` two hundred lines under it,
// `CLASSIC_THEME_TYPES` in the Story Lab engine, and the classic half of the
// image service's visual-element table. They agreed only because nobody had
// added a nineteenth theme yet, and each would have failed differently and
// silently: the log would report the app's own value as `[UNRECOGNIZED]`, the
// Story Lab would drop the theme on the way to the generator and substitute
// `forbidden_love`, and the image prompt would ask for `mysterious elements`.
//
// `shared/themeVocabulary.ts` is the one table now. What this file asserts is
// the part a type cannot: that every reader is reading it.

import { CLASSIC_STORY_THEMES, isClassicStoryTheme } from '../shared/themeVocabulary';
import { VALIDATION_RULES, CLASSIC_STORY_THEMES as CONTRACT_CLASSIC_STORY_THEMES } from '../api/_lib/types/contracts';
import { toClassicGenerationInput } from '../api/_lib/story-lab/storyLabEngine';
import { toLoggableThemes, UNRECOGNIZED_PARAMETER } from '../api/_lib/utils/loggableRequestParameters';
import { ImageService } from '../api/_lib/services/imageService';
import { assert } from './assert';

// ==================== The table has one home ====================

assert(CLASSIC_STORY_THEMES.length === 18, 'the vocabulary should still be eighteen themes');
assert(
  new Set<string>(CLASSIC_STORY_THEMES).size === CLASSIC_STORY_THEMES.length,
  'the vocabulary should not repeat a theme'
);

// The contract re-exports the shared table rather than restating it, and its
// validation rules point at that same array object rather than a copy of it.
assert(
  CONTRACT_CLASSIC_STORY_THEMES === CLASSIC_STORY_THEMES,
  "the API contract's CLASSIC_STORY_THEMES should be the shared table itself"
);
assert(
  VALIDATION_RULES.themes.allowedValues === CLASSIC_STORY_THEMES,
  'VALIDATION_RULES.themes.allowedValues should be the shared table itself'
);

// ==================== Every reader reads it ====================

// The image service's constructor is happy without an API key; only a request
// needs one, and no request is made here.
const imageService = new ImageService() as any;

const blueprintExcept = (themeId: string) => ({
  creature: 'vampire',
  themes: [{ id: themeId, label: themeId, description: 'a theme the reader chose' }],
  tone: 'dark_romance',
  spicyLevel: 3,
  desiredWordBudget: 900,
  chapterBatchSize: 1,
  logline: 'A test blueprint.',
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'closed_door'
  }
});

for (const theme of CLASSIC_STORY_THEMES) {
  assert(isClassicStoryTheme(theme), `${theme} should be recognised as a theme`);

  // The log keeps a theme from the table rather than replacing it with the
  // marker that means "the caller sent something that is not a theme".
  const logged = toLoggableThemes([theme]);
  assert(
    logged.themes.length === 1 && logged.themes[0] === theme,
    `${theme} should be logged as itself, not as ${UNRECOGNIZED_PARAMETER}`
  );

  // The Story Lab carries it through to the classic generator rather than
  // dropping it and substituting the default.
  const classicInput = toClassicGenerationInput(blueprintExcept(theme) as any);
  assert(
    classicInput.themes.length === 1 && classicInput.themes[0] === theme,
    `${theme} should reach the classic generator as itself, not as the default theme`
  );

  // And the image model is told to draw something for it, rather than falling
  // through to the answer that means "no theme was recognised".
  const visualElement: string = imageService.mapThemeToVisualElement(theme);
  assert(
    visualElement !== 'mysterious elements',
    `${theme} should have a visual element of its own`
  );
}

// Each theme asks the image model for a different picture: the fallback is not
// the only way this table can stop distinguishing two themes.
const visualElements = CLASSIC_STORY_THEMES.map(theme => imageService.mapThemeToVisualElement(theme) as string);
assert(
  new Set(visualElements).size === visualElements.length,
  'no two themes should ask the image model for the same picture'
);

// ==================== A value that is not a classic theme ====================

assert(!isClassicStoryTheme('court_intrigue'), 'a Story Lab seed id is not a classic theme');
assert(!isClassicStoryTheme(undefined), 'an absent theme is not one');

// The Story Lab's own seed ids are the vocabulary its picker sends, and the
// engine still substitutes the default for a batch that names none of the
// eighteen — that behaviour is unchanged by reading the shared table.
const seedOnlyInput = toClassicGenerationInput(blueprintExcept('court_intrigue') as any);
assert(
  seedOnlyInput.themes.length === 1 && seedOnlyInput.themes[0] === 'forbidden_love',
  'a blueprint naming no classic theme should still fall back to the default theme'
);

// Both pickers' vocabularies are kept in the log; caller prose is not.
const loggedProse = toLoggableThemes(['Dana is in treatment at Rosewood']);
assert(
  loggedProse.themes.length === 0 && loggedProse.unrecognizedThemeCount === 1,
  'caller prose in the themes field is still kept out of the log'
);

console.log('theme-vocabulary tests passed');
