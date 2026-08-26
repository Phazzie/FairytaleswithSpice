// Created: 2025-10-31 06:28 UTC

import { Injectable } from '@angular/core';
import {
  ChapterBatchSize,
  CreatureArchetype,
  HeatIntimacyBoundary,
  HeatTensionMode,
  NarrativeTone,
  SpicyLevel,
  StoryGenerationSeam,
  WordBudget
} from './contracts';
import { STORY_BLUEPRINT_LIMITS } from '../../../shared/storyBlueprintLimits';

export type BlueprintValidationField =
  | 'creature'
  | 'themes'
  | 'logline'
  | 'spicyLevel'
  | 'heatContract'
  | 'heatContractNoGoContent'
  | 'tone'
  | 'desiredWordBudget'
  | 'chapterBatchSize'
  | 'protagonistName'
  | 'antagonistName'
  | 'worldDetails'
  | 'narrativeDirectives';

export type BlueprintValidationErrors = Partial<Record<BlueprintValidationField, string>>;

const VALID_CREATURES = new Set<CreatureArchetype>([
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
]);
const VALID_TONES = new Set<NarrativeTone>(['romance', 'dark_romance', 'mystery', 'adventure', 'comedy', 'tragedy']);
const VALID_SPICY_LEVELS = new Set<SpicyLevel>([1, 2, 3, 4, 5]);
const VALID_WORD_BUDGETS = new Set<WordBudget>([600, 900, 1200, 1500]);
const VALID_BATCH_SIZES = new Set<ChapterBatchSize>([1, 2, 3]);
const VALID_HEAT_TENSION_MODES = new Set<HeatTensionMode>(['slow_burn', 'dangerous_proximity', 'playful_banter', 'devotional_longing']);
const VALID_HEAT_BOUNDARIES = new Set<HeatIntimacyBoundary>(['fade_to_black', 'closed_door', 'literary_on_page']);

/**
 * The length the API will measure this free-text field at.
 *
 * `parseStoryLabBlueprint` reads `logline` through `.trim()` and `worldDetails`
 * and `narrativeDirectives` through `optionalString`, which trims too, and only
 * then compares against `STORY_BLUEPRINT_LIMITS`. This service read the raw
 * value, so surrounding whitespace counted here and not there: a logline pasted
 * with a trailing newline — the ordinary result of copying a paragraph out of a
 * document — was refused by the form at exactly the cap the route would have
 * accepted it under, with a message telling the reader to shorten prose that was
 * already short enough.
 *
 * That is the mirror of the failure `describeNarrativeDirectivesOverflow` in the
 * shared limits module was written to avoid, and it says so: measuring this any
 * other way "would refuse a request the route would have taken". Both readers of
 * the shared numbers now measure the field the same way the route does.
 *
 * `heatContract.noGoContent` is deliberately not routed through here. The parser
 * checks that field's length as sent, without trimming, so trimming it here
 * would accept a contract the route refuses — the drift running the other way,
 * which is the more expensive direction.
 */
function measuredLength(value: string | undefined): number {
  return value?.trim().length ?? 0;
}

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  // Read from the shared limits rather than restated here: the API enforces the
  // same numbers on the blueprint it is sent, and a form that accepts more than
  // the route will take turns a caught mistake into a rejected generation.
  readonly maxThemes = STORY_BLUEPRINT_LIMITS.maxThemes;
  readonly maxLoglineLength = STORY_BLUEPRINT_LIMITS.maxLoglineLength;
  readonly maxWorldDetailsLength = STORY_BLUEPRINT_LIMITS.maxWorldDetailsLength;
  readonly maxNarrativeDirectivesLength = STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength;
  readonly maxNoGoContentLength = STORY_BLUEPRINT_LIMITS.maxNoGoContentLength;
  /**
   * The two blueprint fields the route measures and this form did not.
   *
   * `maxCharacterNameLength` was added to the shared limits when
   * `parseStoryLabBlueprint` started refusing an oversized `protagonistName` or
   * `antagonistName` — both are interpolated into the continuity model call and
   * stored in the story state, which is why the route caps them. This service
   * reads every other number in that object and skipped these two, so the form
   * accepted what the API refuses: the "Main character" and "Love interest or
   * troublemaker" inputs are plain free text with no cap and no error slot, and
   * a name pasted past 80 characters came back as `400 INVALID_BLUEPRINT` only
   * after the reader pressed generate.
   *
   * That is precisely the drift the note above says this class exists to
   * prevent, and the expensive direction of it: the refusal arrives after the
   * request, naming a field by its wire name, on a form that never said there
   * was a limit.
   *
   * The theme seeds' own caps — `maxThemeLabelLength` and
   * `maxThemeDescriptionLength`, added in the same change — are deliberately
   * not checked here. A reader picks seeds from a fixed list of twelve rather
   * than typing them, so no value this form can produce reaches those caps, and
   * a check against them would be a rule with no reachable input.
   */
  readonly maxCharacterNameLength = STORY_BLUEPRINT_LIMITS.maxCharacterNameLength;

  validateBlueprint(input: StoryGenerationSeam['input']): BlueprintValidationErrors {
    const errors: BlueprintValidationErrors = {};
    const spicyLevel = Number(input.spicyLevel);
    const desiredWordBudget = Number(input.desiredWordBudget);
    const chapterBatchSize = Number(input.chapterBatchSize);
    const themes = Array.isArray(input.themes) ? input.themes : [];

    if (!VALID_CREATURES.has(input.creature)) {
      errors.creature = 'Choose a supported creature archetype.';
    }

    if (!VALID_TONES.has(input.tone)) {
      errors.tone = 'Choose a supported narrative tone.';
    }

    if (!themes.length) {
      errors.themes = 'Choose at least one thematic seed.';
    } else if (themes.length > this.maxThemes) {
      errors.themes = `Choose no more than ${this.maxThemes} thematic seeds.`;
    }

    if (!input.logline?.trim()) {
      errors.logline = 'Add a logline so the story has a clear hook.';
    } else if (measuredLength(input.logline) > this.maxLoglineLength) {
      errors.logline = `Keep the logline under ${this.maxLoglineLength} characters.`;
    }

    if (!VALID_SPICY_LEVELS.has(spicyLevel as SpicyLevel)) {
      errors.spicyLevel = 'Spicy level must be between 1 and 5.';
    }

    const heatContract = input.heatContract;
    if (heatContract?.adultOnlyConfirmed !== true) {
      errors.heatContract = 'Confirm this story is for adult readers and consensual fantasy only.';
    } else if (!VALID_HEAT_TENSION_MODES.has(heatContract.tensionMode) || !VALID_HEAT_BOUNDARIES.has(heatContract.intimacyBoundary)) {
      errors.heatContract = 'Choose supported Heat Contract settings.';
    }

    if ((heatContract?.noGoContent?.length ?? 0) > this.maxNoGoContentLength) {
      errors.heatContractNoGoContent = `Keep no-go content under ${this.maxNoGoContentLength} characters.`;
    }

    if (!VALID_WORD_BUDGETS.has(desiredWordBudget as WordBudget)) {
      errors.desiredWordBudget = 'Choose a supported word budget.';
    }

    if (!VALID_BATCH_SIZES.has(chapterBatchSize as ChapterBatchSize)) {
      errors.chapterBatchSize = 'Choose 1, 2, or 3 chapters per batch.';
    }

    if (measuredLength(input.protagonistName) > this.maxCharacterNameLength) {
      errors.protagonistName = `Keep the main character's name under ${this.maxCharacterNameLength} characters.`;
    }

    if (measuredLength(input.antagonistName) > this.maxCharacterNameLength) {
      errors.antagonistName = `Keep the love interest's name under ${this.maxCharacterNameLength} characters.`;
    }

    if (measuredLength(input.worldDetails) > this.maxWorldDetailsLength) {
      errors.worldDetails = `Keep world details under ${this.maxWorldDetailsLength} characters.`;
    }

    if (measuredLength(input.narrativeDirectives) > this.maxNarrativeDirectivesLength) {
      errors.narrativeDirectives = `Keep narrative directives under ${this.maxNarrativeDirectivesLength} characters.`;
    }

    return errors;
  }

  isValid(errors: BlueprintValidationErrors): boolean {
    return Object.keys(errors).length === 0;
  }

  getFirstError(errors: BlueprintValidationErrors): string | null {
    return Object.values(errors)[0] ?? null;
  }
}
