import { Injectable } from '@angular/core';
import {
  ChapterBatchSize,
  CreatureArchetype,
  NarrativeTone,
  SpicyLevel,
  StoryGenerationSeam,
  WordBudget
} from './contracts';

export type BlueprintValidationField =
  | 'creature'
  | 'themes'
  | 'logline'
  | 'spicyLevel'
  | 'tone'
  | 'desiredWordBudget'
  | 'chapterBatchSize'
  | 'worldDetails'
  | 'narrativeDirectives';

export type BlueprintValidationErrors = Partial<Record<BlueprintValidationField, string>>;

const VALID_CREATURES: readonly CreatureArchetype[] = ['vampire', 'werewolf', 'fairy', 'siren', 'djinn'];
const VALID_TONES: readonly NarrativeTone[] = ['romance', 'dark_romance', 'mystery', 'adventure', 'comedy', 'tragedy'];
const VALID_SPICY_LEVELS: readonly SpicyLevel[] = [1, 2, 3, 4, 5];
const VALID_WORD_BUDGETS: readonly WordBudget[] = [600, 900, 1200, 1500];
const VALID_BATCH_SIZES: readonly ChapterBatchSize[] = [1, 2, 3];

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  readonly maxThemes = 3;
  readonly maxLoglineLength = 420;
  readonly maxWorldDetailsLength = 600;
  readonly maxNarrativeDirectivesLength = 1200;

  validateBlueprint(input: StoryGenerationSeam['input']): BlueprintValidationErrors {
    const errors: BlueprintValidationErrors = {};
    const spicyLevel = Number(input.spicyLevel);
    const desiredWordBudget = Number(input.desiredWordBudget);
    const chapterBatchSize = Number(input.chapterBatchSize);
    const themes = Array.isArray(input.themes) ? input.themes : [];

    if (!VALID_CREATURES.includes(input.creature)) {
      errors.creature = 'Choose a supported creature archetype.';
    }

    if (!VALID_TONES.includes(input.tone)) {
      errors.tone = 'Choose a supported narrative tone.';
    }

    if (!themes.length) {
      errors.themes = 'Choose at least one thematic seed.';
    } else if (themes.length > this.maxThemes) {
      errors.themes = `Choose no more than ${this.maxThemes} thematic seeds.`;
    }

    if (!input.logline?.trim()) {
      errors.logline = 'Add a logline so the story has a clear hook.';
    } else if (input.logline.length > this.maxLoglineLength) {
      errors.logline = `Keep the logline under ${this.maxLoglineLength} characters.`;
    }

    if (!VALID_SPICY_LEVELS.includes(spicyLevel as SpicyLevel)) {
      errors.spicyLevel = 'Spicy level must be between 1 and 5.';
    }

    if (!VALID_WORD_BUDGETS.includes(desiredWordBudget as WordBudget)) {
      errors.desiredWordBudget = 'Choose a supported word budget.';
    }

    if (!VALID_BATCH_SIZES.includes(chapterBatchSize as ChapterBatchSize)) {
      errors.chapterBatchSize = 'Choose 1, 2, or 3 chapters per batch.';
    }

    if ((input.worldDetails?.length ?? 0) > this.maxWorldDetailsLength) {
      errors.worldDetails = `Keep world details under ${this.maxWorldDetailsLength} characters.`;
    }

    if ((input.narrativeDirectives?.length ?? 0) > this.maxNarrativeDirectivesLength) {
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
