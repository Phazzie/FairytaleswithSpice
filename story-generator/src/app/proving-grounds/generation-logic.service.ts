// Created: 2025-10-31 07:06
import { Injectable } from '@angular/core';
import { CreatureArchetype } from '../contracts';
import {
  STORY_BEAT_STRUCTURES,
  STORY_CHEKHOV_ELEMENTS,
  STORY_CHEKHOV_ELEMENTS_PER_STORY,
  type StoryBeatStructure
} from '../../../../shared/storyPromptTables';
import {
  AUTHOR_STYLE_BANKS,
  PRIMARY_AUTHOR_COUNT,
  SECONDARY_AUTHOR_COUNT,
  getSecondaryAuthorVoices,
  type AuthorVoice
} from '../../../../shared/authorStyleBanks';

/**
 * The shape the shared voice table already has, re-exported under this panel's
 * own name so the template and the callers below keep reading `AuthorStyle`.
 *
 * An alias rather than a second declaration, for the same reason `BeatStructure`
 * below is one: two structurally identical interfaces stay identical only until
 * one of them is edited.
 */
export type AuthorStyle = AuthorVoice;

/**
 * The shape the API's beat table already has, re-exported under this panel's
 * own name so the template and the callers below keep reading `BeatStructure`.
 *
 * It is an alias rather than a second declaration for the same reason the table
 * itself is no longer copied here: two structurally identical interfaces stay
 * identical only until one of them is edited.
 */
export type BeatStructure = StoryBeatStructure;

export interface ChekovElement {
  description: string;
}

export interface GenerationLogic {
  selectedAuthors: AuthorStyle[];
  selectedBeatStructure: BeatStructure;
  chekovElements: ChekovElement[];
}

@Injectable({
  providedIn: 'root'
})
export class GenerationLogicService {
  private fallbackRandomState = (Date.now() ^ Math.floor((globalThis.performance?.now() ?? 0) * 1000)) >>> 0;

  /**
   * The author bank a creature's prompt is built from.
   *
   * The point of this panel is to show which authors the API will be asked to
   * write like, so the answer has to be the API's answer — and the way to be
   * the API's answer is to read what the API reads. The ten banks were written
   * out here as well, and the copies had drifted twice: `siren` and `djinn`
   * fell through to the fae bank while the API had grown its own, so for two of
   * the ten creatures this screen reported twelve fae authors for a story the
   * server generated from four sea or wish voices; and three of the twelve
   * vampire samples kept their em dashes here while the API's copy had them
   * flattened to hyphens. `shared/authorStyleBanks.ts` holds the one
   * declaration both sides now read.
   *
   * The lookup answers `[]` for a creature that reaches here from outside
   * `CreatureArchetype`, which is what the `default` of the switch this
   * replaces did and is unreachable from the type for the same reason.
   */
  getAllAuthorStyles(creature: CreatureArchetype): AuthorStyle[] {
    return AUTHOR_STYLE_BANKS[creature] ?? [];
  }

  /**
   * The second bank a creature's prompt draws its blend voice from.
   *
   * The pairings are the API's, not a reconstruction, and now literally so:
   * `getSecondaryAuthorVoices` is what `selectRandomAuthorStyles` in
   * `api/_lib/config/authorStyles.ts` calls to build the same pool. See
   * `selectRandomAuthors` below for what leaving this out was doing to the
   * panel.
   */
  getSecondaryAuthorStyles(creature: CreatureArchetype): AuthorStyle[] {
    return getSecondaryAuthorVoices(creature);
  }

  /**
   * The beat structures the API would draw from.
   *
   * Read from `shared/storyPromptTables` rather than from a copy held here.
   * The copy was character-for-character identical to
   * `StoryService.getRandomBeatStructure`'s table, which is the only reason
   * this panel was telling the truth — and identical-until-edited is exactly
   * how the author banks above came to disagree with the run.
   *
   * Copied on the way out, as the author banks are not, because a caller that
   * sorts or splices what it is handed would otherwise be editing the table the
   * prompt itself is built from.
   */
  getAllBeatStructures(): BeatStructure[] {
    return [...STORY_BEAT_STRUCTURES];
  }

  getAllChekovElements(): string[] {
    return [...STORY_CHEKHOV_ELEMENTS];
  }

  /**
   * The author styles a generation would actually be prompted with.
   *
   * `selectRandomAuthorStyles` in `api/_lib/config/authorStyles.ts` takes two
   * voices from the creature's own bank and one from a *second* bank belonging
   * to other creatures — a werewolf story is written by two werewolf voices and
   * one vampire or fae one, and that third voice is the whole reason the API
   * keeps a `getSecondaryAuthorStyles` table at all. This panel drew two or
   * three, all from the primary bank, so it disagreed with the run twice over:
   * the blend voice never appeared in the preview for any creature, and a
   * three-author preview named three primary voices where the API had used two.
   *
   * The count is what makes the second half wrong rather than merely incomplete.
   * `2 + randomInt(2)` is a coin flip between two and three, so the panel that
   * happened to roll three showed a prompt with one more same-creature voice
   * than the generator ever builds. The API's shape is fixed — two plus one, in
   * that order — so there is nothing to randomise here beyond which voices are
   * drawn.
   *
   * `Math.min` still guards each slice, because a bank shorter than the slice it
   * is asked for should hand back what it has rather than a padded list; the
   * shipped banks are all at least four deep, so this is about the next one
   * added rather than about any creature today.
   */
  selectRandomAuthors(creature: CreatureArchetype): AuthorStyle[] {
    const primaryStyles = this.getAllAuthorStyles(creature);
    const secondaryStyles = this.getSecondaryAuthorStyles(creature);

    return [
      ...this.shuffle(primaryStyles).slice(0, Math.min(PRIMARY_AUTHOR_COUNT, primaryStyles.length)),
      ...this.shuffle(secondaryStyles).slice(0, Math.min(SECONDARY_AUTHOR_COUNT, secondaryStyles.length))
    ];
  }

  selectRandomBeatStructure(): BeatStructure {
    const index = this.randomInt(STORY_BEAT_STRUCTURES.length);
    return STORY_BEAT_STRUCTURES[index];
  }

  /**
   * The count is the API's, not this panel's: `generateChekovElements` plants
   * `STORY_CHEKHOV_ELEMENTS_PER_STORY` of them and names them `[Chekhov1]` and
   * `[Chekhov2]` in the prompt. A preview listing a different number would be
   * describing a run that never happened.
   */
  selectRandomChekovElements(): ChekovElement[] {
    const shuffled = this.shuffle(STORY_CHEKHOV_ELEMENTS);
    return shuffled
      .slice(0, STORY_CHEKHOV_ELEMENTS_PER_STORY)
      .map(description => ({ description }));
  }

  generateRandomLogic(creature: CreatureArchetype): GenerationLogic {
    return {
      selectedAuthors: this.selectRandomAuthors(creature),
      selectedBeatStructure: this.selectRandomBeatStructure(),
      chekovElements: this.selectRandomChekovElements()
    };
  }

  summarizeLogic(logic: GenerationLogic): string {
    const authorSummary = logic.selectedAuthors
      .map(author => `${author.author} (${author.trait})`)
      .join('; ') || 'none selected';
    const chekovSummary = logic.chekovElements
      .map(element => element.description)
      .join('; ');

    return [
      `Author styles: ${authorSummary}.`,
      `Beat structure: ${logic.selectedBeatStructure.name} - ${logic.selectedBeatStructure.beats}.`,
      `Chekov elements: ${chekovSummary}.`
    ].join('\n');
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private randomInt(maxExclusive: number): number {
    if (maxExclusive <= 1) {
      return 0;
    }

    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % maxExclusive;
    }

    this.fallbackRandomState = (1664525 * this.fallbackRandomState + 1013904223) >>> 0;
    return this.fallbackRandomState % maxExclusive;
  }
}
