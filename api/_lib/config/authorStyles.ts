// Created: 2025-10-12 00:00 UTC
// Ported from PR #67 into the Vercel-oriented api/_lib tree.

import { randomInt } from 'node:crypto';
import type { CreatureType } from '../types/contracts';
import {
  AUTHOR_STYLE_BANKS,
  PRIMARY_AUTHOR_COUNT,
  SECONDARY_AUTHOR_COUNT,
  getSecondaryAuthorVoices,
  type AuthorVoice
} from '../../../shared/authorStyleBanks';

/**
 * The shape the shared voice table already has, kept under this module's own
 * name so `StoryService` and `tests/story-lab-real-engine.test.ts` keep reading
 * `AuthorStyle`.
 *
 * An alias rather than a second declaration, for the same reason the banks
 * themselves are no longer written out here: two structurally identical
 * interfaces stay identical only until one of them is edited.
 */
export type AuthorStyle = AuthorVoice;

/**
 * The voice bank each creature's prompt is built from.
 *
 * The ten banks used to be declared in this file, and again in
 * `GenerationLogicService` in the Angular tree, which previews which voices a
 * run would draw. `shared/authorStyleBanks.ts` holds the one declaration both
 * now read; the note there records what the two copies had already cost, and
 * what had drifted between them by the time they were merged.
 *
 * `siren` and `djinn` once pointed at the fae bank. Every creature has had its
 * own since the Story Lab blueprint named ten of them, so a reader who chose a
 * siren or a djinn — two of the ten choices the form offers — had the one
 * setting that most decides how the prose sounds replaced by the fae court
 * bank: Holly Black and Sarah J. Maas directing a story about neither. The gap
 * survived the style-bank test because the fae bank ends on a Bargainer entry
 * that happens to say "siren", "bargain", and "debts", so the creature-specific
 * language assertion passed on borrowed words, and the "must not reuse another
 * creature's bank" loop beside it named only the five creatures added last.
 */
export function getAuthorStylesForCreature(creature: CreatureType): AuthorStyle[] {
  return AUTHOR_STYLE_BANKS[creature];
}

export function selectRandomAuthorStyles(creature: CreatureType): AuthorStyle[] {
  const fisherYatesShuffle = <T>(array: readonly T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const primaryStyles = getAuthorStylesForCreature(creature);
  const otherStyles = getSecondaryAuthorVoices(creature);

  return [
    ...fisherYatesShuffle(primaryStyles).slice(0, PRIMARY_AUTHOR_COUNT),
    ...fisherYatesShuffle(otherStyles).slice(0, SECONDARY_AUTHOR_COUNT)
  ];
}
