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

const THEME_LABELS_BY_ID = new Map(STORY_LAB_THEME_SEEDS.map(seed => [seed.id, seed.label]));

/**
 * Name a theme the way the reader was offered it.
 *
 * The ids above are wire values, and one place puts them in front of a reader
 * rather than matching on them: `ExportService.generateMetadata` copies
 * `input.themes` into the "Story Information" block of every HTML and text
 * export, where `app.ts` has sent `theme.id` since the picker was built. So the
 * document a reader downloads and keeps — the product of the export button, not
 * a log line or a prompt — read `Themes: enemies_to_lovers, secret_identity`
 * for the two seeds its own picker calls "Enemies to Lovers" and "Secret
 * Identity". The creature beside it was the same: the bare `vampire` the
 * request carried.
 *
 * This is the third reader of these ids to have been written against a
 * vocabulary that is not the picker's, after `mapThemeToVisualElement` and
 * `toLoggableThemes`, and the reason the list moved here. The label is the
 * seed's own, so a seed renamed in the picker is renamed in the export.
 *
 * An id from outside the list still has to be answered: the seams accept the
 * classic `ThemeType` vocabulary from a caller that sends it, and the export
 * route takes whatever `themes` a caller puts in the body. Those are spelled
 * the same way — lowercase words joined by underscores — so they are titled
 * from their own text rather than replaced by a placeholder, which keeps
 * `power_dynamics` legible as "Power Dynamics" instead of asserting a name it
 * does not have.
 */
export function readStoryLabThemeLabel(themeId: string): string {
  return THEME_LABELS_BY_ID.get(themeId) ?? titleCaseIdentifier(themeId);
}

/**
 * Title-case a wire identifier for display: `power_dynamics` becomes "Power
 * Dynamics". A value that is not identifier-shaped is returned as it is rather
 * than mangled, since the point is to read it, not to normalize it.
 */
export function titleCaseIdentifier(value: string): string {
  const words = value.trim().split(/[_\s-]+/).filter(Boolean);
  if (!words.length) {
    return value.trim();
  }

  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
