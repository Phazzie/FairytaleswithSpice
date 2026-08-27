// Created: 2026-08-27 UTC

import { titleCaseIdentifier } from './storyLabThemeSeeds';

/**
 * The ten creatures a story can be about, and therefore the only `creature`
 * values any request in this repository carries.
 *
 * The list was written out by hand seven times. Two of them were type unions —
 * `CreatureType` in the API's own contract and `CreatureArchetype` in the
 * Angular one — and a third was `CREATURE_ARCHETYPES`, the runtime table beside
 * the second, which the API tree already reached across for through
 * `api/_lib/story-lab/contracts`. The other four were readers that each kept
 * their own copy rather than ask any of the three:
 *
 * - `StoryService.validateStoryInput`, whose `supportedCreatures` decides which
 *   requests `/api/story/generate` refuses;
 * - `ALLOWED_CREATURES` in `loggableRequestParameters`, which decides whether
 *   the `creature` a caller sent is written to the log or replaced with
 *   `[UNRECOGNIZED]`;
 * - `getCreatureDisplayName` in `storyContentAnalysis`, which names the creature
 *   to the model as `PROTAGONIST: …`;
 * - `PromptTemplatesService.getCreatureDisplayName`, which fills the same slot
 *   in the Proving Grounds' preview of that prompt.
 *
 * Seven copies of ten names is seven places an eleventh creature has to be
 * added, and the failure of each is silent and different: the union accepts it,
 * the validator refuses the request, the log reports the app's own picker value
 * as unrecognised, and both prompt builders name the protagonist something
 * other than what the reader chose. That is the arrangement `EXPORT_FORMATS`
 * was written to end after the export picker restated the formats by hand and
 * lost `html`.
 *
 * Kept in `shared/` beside `storyLabThemeSeeds` and `storyPromptTables`, for
 * the reason those give: this module sits below both trees and can import
 * neither, which is what lets the API's contract derive its union from the same
 * table the Angular picker renders.
 */
export const CREATURE_ARCHETYPES = [
  'vampire',
  'werewolf',
  'fairy',
  'siren',
  'djinn',
  'witch',
  'dragon',
  'demon',
  'angel',
  'mermaid'
] as const;

/**
 * The union, read from the table rather than restated beside it.
 *
 * Derived rather than declared-and-`satisfies`-checked for the reason
 * `IMAGE_STYLES` gives: a `satisfies` clause catches a *wrong* entry, and every
 * copy of this list could only ever go wrong by being short one.
 */
export type CreatureArchetype = typeof CREATURE_ARCHETYPES[number];

/** Membership, for the two callers that check a value they were handed. */
const CREATURE_ARCHETYPE_SET: ReadonlySet<string> = new Set<string>(CREATURE_ARCHETYPES);

export function isCreatureArchetype(value: unknown): value is CreatureArchetype {
  return typeof value === 'string' && CREATURE_ARCHETYPE_SET.has(value);
}

/**
 * What a creature is called in a prompt when it is not one of the ten.
 *
 * `validateStoryInput` refuses such a request before any prompt is built, so
 * this is unreachable on the generation path; it is kept because it is the
 * behaviour the API's `getCreatureDisplayName` has always had, and because the
 * alternative the Angular copy had — returning the caller's own text, or
 * `undefined`, into `PROTAGONIST: …` — is the one thing a prompt slot must not
 * do.
 */
export const UNKNOWN_CREATURE_DISPLAY_NAME = 'Creature';

/**
 * Name a creature the way a prompt names it: `vampire` becomes `Vampire`.
 *
 * The two copies this replaces were ten-entry `Record`s of exactly the
 * title-cased id, so the table above is the whole of the vocabulary and the
 * casing is derived from it — the same arrangement `readStoryLabThemeLabel`
 * has, and the reason `titleCaseIdentifier` is imported from beside it rather
 * than written again here.
 *
 * The two copies had also already drifted on the one case they disagreed
 * about: the API's returned `'Creature'` for a value outside the list, and the
 * Angular one indexed a `Record<CreatureArchetype, string>` and returned
 * `undefined` for anything its type had promised could not arrive — which the
 * Proving Grounds would have written into the prompt as the string
 * `"undefined"`.
 */
export function readCreatureDisplayName(creature: string): string {
  return isCreatureArchetype(creature)
    ? titleCaseIdentifier(creature)
    : UNKNOWN_CREATURE_DISPLAY_NAME;
}
