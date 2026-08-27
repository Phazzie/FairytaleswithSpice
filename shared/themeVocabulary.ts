// Created: 2026-08-27 UTC

/**
 * The eighteen classic themes a story can be woven from, and therefore the only
 * `themes` values `/api/story/generate` and `/api/story/continue` are
 * documented to carry.
 *
 * The eighteen were written out by hand four times, in the order below every
 * time, and only that shared order is why the four ever agreed:
 *
 * - `ThemeType` in the API's contract, the union every signature in the API
 *   tree spells;
 * - `VALIDATION_RULES.themes.allowedValues` two hundred lines under it, which
 *   is what `loggableRequestParameters` uses to decide whether the `themes` a
 *   caller sent are written to the log or replaced with `[UNRECOGNIZED]`;
 * - `CLASSIC_THEME_TYPES` in `storyLabEngine`, which decides which Story Lab
 *   seed ids survive translation into a classic generation request;
 * - the classic half of `ImageService.mapThemeToVisualElement`'s table, which
 *   decides what the image model is told to draw.
 *
 * Four copies of eighteen names is four places a nineteenth theme has to be
 * added, and each failure is silent and different: the union accepts it, the
 * log reports the app's own value as unrecognised, the Story Lab drops it on
 * the way to the generator and substitutes `forbidden_love`, and the image
 * prompt asks for `mysterious elements` instead of the thing the reader chose.
 * `extractThemesFromContent` is the one reader that was already safe, because
 * its keyword table is keyed `Record<ThemeType, …>` and a missing theme is a
 * compile error there rather than a blind spot; this module is what lets the
 * other three be held to the same standard.
 *
 * That is the arrangement `CREATURE_ARCHETYPES` was written to end for the ten
 * creatures, and `EXPORT_FORMATS` before it for the five export formats.
 *
 * Kept in `shared/` beside `creatureVocabulary` and `storyLabThemeSeeds`, for
 * the reason those give: this module sits below both trees and can import
 * neither, which is what lets the API's contract derive its union from the same
 * table its validators and prompt builders read.
 *
 * These are not the Story Lab theme *seeds*. `STORY_LAB_THEME_SEEDS` in
 * `storyLabThemeSeeds` is the twelve-entry vocabulary the Angular picker
 * renders and the Story Lab sends; five of those spell a classic theme and
 * seven do not. Both vocabularies reach `/api/image/generate`, which is why
 * that route answers both and why the seam types `themes` as `string[]` rather
 * than as this closed set.
 */
export const CLASSIC_STORY_THEMES = [
  'betrayal',
  'obsession',
  'power_dynamics',
  'forbidden_love',
  'revenge',
  'manipulation',
  'seduction',
  'dark_secrets',
  'corruption',
  'dominance',
  'submission',
  'jealousy',
  'temptation',
  'sin',
  'desire',
  'passion',
  'lust',
  'deceit'
] as const;

/**
 * The union, read from the table rather than restated beside it.
 *
 * Derived rather than declared-and-`satisfies`-checked for the reason
 * `CREATURE_ARCHETYPES` gives: a `satisfies` clause catches a *wrong* entry,
 * and every copy of this list could only ever go wrong by being short one.
 */
export type ClassicStoryTheme = typeof CLASSIC_STORY_THEMES[number];

/** Membership, for the callers that check a value they were handed. */
const CLASSIC_STORY_THEME_SET: ReadonlySet<string> = new Set<string>(CLASSIC_STORY_THEMES);

export function isClassicStoryTheme(value: unknown): value is ClassicStoryTheme {
  return typeof value === 'string' && CLASSIC_STORY_THEME_SET.has(value);
}
