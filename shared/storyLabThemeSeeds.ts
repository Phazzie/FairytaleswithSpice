// Created: 2026-08-26 07:10 UTC

/**
 * One thematic seed as the Story Lab picker offers it.
 *
 * Structurally the Angular `ThemeSeed` and the API's `GenerationThemeSeed`,
 * restated here because this module sits below both trees and can import
 * neither.
 */
export interface StoryLabThemeSeed {
  id: string;
  label: string;
  description: string;
}

/**
 * The thematic seeds the Story Lab picker offers, and therefore the theme ids
 * every request the app makes actually carries.
 *
 * They are not `ThemeType`. The classic eighteen — `betrayal`, `power_dynamics`,
 * and the rest — are a separate vocabulary that the seams still accept from a
 * caller that sends them, but no screen in this repository offers them: `app.ts`
 * builds its picker from these twelve and passes `theme.id` straight through to
 * `/api/story-lab/*`, `/api/image/generate`, and `/api/export/save`.
 *
 * The list lived in `app.ts` alone, and the server-side tables that have to
 * recognise these ids were each written against `ThemeType` instead. That has
 * now cost the same bug twice: `ImageService.mapThemeToVisualElement` described
 * seven of the twelve to the image model as `mysterious elements`, and
 * `toLoggableThemes` counts those same seven as unrecognised, so the request
 * line for an ordinary image generation reports no themes at all. Both were
 * written correctly against the wrong vocabulary, which is what a list with one
 * copy and several readers produces.
 *
 * Defining it here, where the API tree and the Angular tree can both read it,
 * is what makes a seed added to the picker reach the code that has to know
 * about it — rather than leaving the next reader to notice.
 */
export const STORY_LAB_THEME_SEEDS: readonly StoryLabThemeSeed[] = [
  { id: 'forbidden_love', label: 'Forbidden Love', description: 'Desire has consequences.' },
  { id: 'dark_secrets', label: 'Hidden Secrets', description: 'Someone is lying beautifully.' },
  { id: 'court_intrigue', label: 'Court Intrigue', description: 'Power games under candlelight.' },
  { id: 'blood_oaths', label: 'Blood Oaths', description: 'Promises that bite back.' },
  { id: 'slow_burn', label: 'Slow Burn', description: 'Tension before surrender.' },
  { id: 'enemies_to_lovers', label: 'Enemies to Lovers', description: 'Sparks from mutual danger.' },
  { id: 'revenge', label: 'Revenge', description: 'A debt comes due.' },
  { id: 'obsession', label: 'Obsession', description: 'Want sharp enough to wound.' },
  { id: 'temptation', label: 'Temptation', description: 'The wrong door keeps opening.' },
  { id: 'magical_bargain', label: 'Magical Bargain', description: 'Every wish has a price.' },
  { id: 'secret_identity', label: 'Secret Identity', description: 'The lover is not who they seem.' },
  { id: 'forced_proximity', label: 'Forced Proximity', description: 'No escape from chemistry.' }
];

/** Just the ids, for the allow-lists that only ever check membership. */
export const STORY_LAB_THEME_SEED_IDS: readonly string[] = STORY_LAB_THEME_SEEDS.map(seed => seed.id);
