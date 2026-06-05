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

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  readonly maxThemes = 5;
  readonly maxLoglineLength = 420;
  readonly maxWorldDetailsLength = 600;
  readonly maxNarrativeDirectivesLength = 1200;
  readonly maxNoGoContentLength = 320;

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
    } else if (input.logline.length > this.maxLoglineLength) {
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
