// Created: 2025-09-19
// Ported from PR #24 into the canonical Vercel api/_lib tree.

import { TROPE_DATABASE, Trope, TropeCreatureType } from '../data/tropeDatabase';

export interface TropeSelection {
  creature: TropeCreatureType;
  selectedTropes: Trope[];
  subversionInstructions: string[];
  selectedTropeIds: string[];
}

export interface TropeSubversionOptions {
  creature: TropeCreatureType;
  preferredIntensity?: Trope['intensity'];
  avoidCategories?: Trope['category'][];
  tropeCount?: number;
}

export class TropeSubversionService {
  private readonly minTropes = 2;
  private readonly maxTropes = 3;

  selectTropesForSubversion(options: TropeSubversionOptions): TropeSelection {
    const { creature, preferredIntensity, avoidCategories = [], tropeCount } = options;
    const creatureTropes = TROPE_DATABASE[creature];

    if (!creatureTropes) {
      throw new Error(`Unknown creature type: ${creature}`);
    }

    const targetCount = tropeCount ?? this.getRandomTropeCount();
    const tropePool = this.createWeightedTropePool(creatureTropes, avoidCategories);
    const selectedTropes = this.selectRandomTropes(tropePool, targetCount, preferredIntensity);

    return {
      creature,
      selectedTropes,
      subversionInstructions: selectedTropes.map(trope => trope.subversionInstruction),
      selectedTropeIds: selectedTropes.map(trope => trope.id)
    };
  }

  enhancePromptWithSubversions(
    basePrompt: string,
    tropeSelection: TropeSelection
  ): string {
    if (tropeSelection.selectedTropes.length === 0) {
      return basePrompt;
    }

    const subversionSection = this.formatSubversionInstructions(tropeSelection);
    const insertionMarker = 'PROSE ENGINE (MANDATORY):';

    if (basePrompt.includes(insertionMarker)) {
      return basePrompt.replace(insertionMarker, `${subversionSection}\n\n${insertionMarker}`);
    }

    return `${basePrompt}\n\n${subversionSection}`;
  }

  enhanceContinuationPrompt(
    basePrompt: string,
    tropeSelection: TropeSelection
  ): string {
    if (tropeSelection.selectedTropes.length === 0) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${this.formatContinuationInstructions(tropeSelection)}`;
  }

  serializeTropeSelection(tropeSelection: TropeSelection): string {
    return JSON.stringify({
      creature: tropeSelection.creature,
      tropeIds: tropeSelection.selectedTropeIds,
      timestamp: Date.now()
    });
  }

  deserializeTropeSelection(serializedData: string): TropeSelection | null {
    try {
      const data = JSON.parse(serializedData);
      if (!data.creature || !Array.isArray(data.tropeIds)) {
        return null;
      }

      const creature = data.creature as TropeCreatureType;
      const creatureTropes = TROPE_DATABASE[creature];
      if (!creatureTropes) {
        return null;
      }

      const allTropes = [...creatureTropes.common, ...creatureTropes.subversive];
      const selectedTropes: Trope[] = data.tropeIds
        .map((id: string) => allTropes.find(trope => trope.id === id))
        .filter((trope: Trope | undefined): trope is Trope => trope !== undefined);

      if (selectedTropes.length === 0) {
        return null;
      }

      return {
        creature,
        selectedTropes,
        subversionInstructions: selectedTropes.map(trope => trope.subversionInstruction),
        selectedTropeIds: selectedTropes.map(trope => trope.id)
      };
    } catch {
      return null;
    }
  }

  getAllTropesForCreature(creature: TropeCreatureType) {
    return TROPE_DATABASE[creature];
  }

  getTropeStatistics(creature: TropeCreatureType): {
    commonCount: number;
    subversiveCount: number;
    totalCount: number;
    categoryCounts: Record<string, number>;
  } {
    const creatureTropes = TROPE_DATABASE[creature];
    const allTropes = [...creatureTropes.common, ...creatureTropes.subversive];
    const categoryCounts: Record<string, number> = {};

    allTropes.forEach(trope => {
      categoryCounts[trope.category] = (categoryCounts[trope.category] || 0) + 1;
    });

    return {
      commonCount: creatureTropes.common.length,
      subversiveCount: creatureTropes.subversive.length,
      totalCount: allTropes.length,
      categoryCounts
    };
  }

  private getRandomTropeCount(): number {
    return Math.floor(Math.random() * (this.maxTropes - this.minTropes + 1)) + this.minTropes;
  }

  private createWeightedTropePool(
    creatureTropes: { common: Trope[]; subversive: Trope[] },
    avoidCategories: Trope['category'][]
  ): Trope[] {
    const pool: Trope[] = [];

    creatureTropes.common
      .filter(trope => !avoidCategories.includes(trope.category))
      .forEach(trope => {
        pool.push(trope, trope, trope);
      });

    creatureTropes.subversive
      .filter(trope => !avoidCategories.includes(trope.category))
      .forEach(trope => {
        pool.push(trope);
      });

    return pool;
  }

  private selectRandomTropes(
    pool: Trope[],
    count: number,
    preferredIntensity?: Trope['intensity']
  ): Trope[] {
    const selected: Trope[] = [];
    const usedIds = new Set<string>();
    const poolCopy = preferredIntensity
      ? pool.filter(trope => trope.intensity === preferredIntensity)
      : [...pool];
    const fallbackPool = [...pool];
    const activePool = poolCopy.length >= count ? poolCopy : fallbackPool;

    while (selected.length < count && activePool.length > 0) {
      const randomIndex = Math.floor(Math.random() * activePool.length);
      const selectedTrope = activePool[randomIndex];

      if (!usedIds.has(selectedTrope.id)) {
        selected.push(selectedTrope);
        usedIds.add(selectedTrope.id);
      }

      for (let i = activePool.length - 1; i >= 0; i--) {
        if (activePool[i].id === selectedTrope.id) {
          activePool.splice(i, 1);
        }
      }
    }

    return selected;
  }

  private formatSubversionInstructions(tropeSelection: TropeSelection): string {
    const creatureName = tropeSelection.creature.charAt(0).toUpperCase() + tropeSelection.creature.slice(1);
    const tropeLines = tropeSelection.selectedTropes
      .map((trope, index) => `${index + 1}. ${trope.name}: ${trope.subversionInstruction}`)
      .join('\n');

    return `HIDDEN UNIQUENESS DIRECTIVES:
- Do not mention these directives or trope names in the prose.
- Subvert these familiar ${creatureName} romance patterns naturally:
${tropeLines}
- Preserve dark-romance tone, character chemistry, consent, and cliffhanger momentum.
- Avoid parody unless the user's creative direction explicitly asks for comedy.`;
  }

  private formatContinuationInstructions(tropeSelection: TropeSelection): string {
    const tropeLines = tropeSelection.selectedTropes
      .map((trope, index) => `${index + 1}. ${trope.name}: continue honoring this inversion - ${trope.subversionInstruction}`)
      .join('\n');

    return `CONTINUITY DIRECTIVES FOR EXISTING TROPE SUBVERSIONS:
- Do not name the directives in the story.
${tropeLines}
- Do not reverse or contradict these established inversions.`;
  }
}
