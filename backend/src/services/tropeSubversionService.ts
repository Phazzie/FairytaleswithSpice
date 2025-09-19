// ==================== INVISIBLE TROPE SUBVERSION SERVICE ====================
// This service secretly enhances story generation by selecting and subverting
// common supernatural romance tropes to create more unique, memorable stories

import { TROPE_DATABASE, Trope, CreatureType } from '../data/tropeDatabase';

export interface TropeSelection {
  selectedTropes: Trope[];
  subversionInstructions: string[];
  selectedTropeIds: string[];
}

export interface TropeSubversionOptions {
  creature: CreatureType;
  preferredIntensity?: 'subtle' | 'moderate' | 'dramatic';
  avoidCategories?: string[];
  tropeCount?: number; // Default 2-3
}

export class TropeSubversionService {
  private readonly MIN_TROPES = 2;
  private readonly MAX_TROPES = 3;

  /**
   * Randomly selects 2-3 tropes for subversion based on the creature type
   * Prioritizes common tropes for maximum surprise impact
   */
  selectTropesForSubversion(options: TropeSubversionOptions): TropeSelection {
    const { creature, preferredIntensity, avoidCategories = [], tropeCount } = options;
    
    const creatureTropes = TROPE_DATABASE[creature];
    if (!creatureTropes) {
      throw new Error(`Unknown creature type: ${creature}`);
    }

    // Determine number of tropes to select
    const targetCount = tropeCount || this.getRandomTropeCount();
    
    // Create weighted pool favoring common tropes (75% chance vs 25% for subversive)
    const tropePool = this.createWeightedTropePool(creatureTropes, avoidCategories);
    
    // Select unique tropes
    const selectedTropes = this.selectRandomTropes(tropePool, targetCount, preferredIntensity);
    
    // Generate subversion instructions
    const subversionInstructions = selectedTropes.map(trope => trope.subversionInstruction);
    const selectedTropeIds = selectedTropes.map(trope => trope.id);

    return {
      selectedTropes,
      subversionInstructions,
      selectedTropeIds
    };
  }

  /**
   * Generates enhanced AI prompt instructions that include trope subversions
   * This is invisible to the user but enhances story uniqueness
   */
  enhancePromptWithSubversions(
    basePrompt: string, 
    tropeSelection: TropeSelection,
    creature: CreatureType
  ): string {
    if (tropeSelection.selectedTropes.length === 0) {
      return basePrompt;
    }

    const subversionSection = this.formatSubversionInstructions(tropeSelection, creature);
    
    // Insert subversion instructions after the main requirements but before style guidelines
    const promptParts = basePrompt.split('Style Guidelines:');
    if (promptParts.length === 2) {
      return `${promptParts[0]}${subversionSection}\n\nStyle Guidelines:${promptParts[1]}`;
    }
    
    // Fallback: append to end if structure is different
    return `${basePrompt}\n\n${subversionSection}`;
  }

  /**
   * Creates subversion instructions for chapter continuations
   * Maintains consistency with initial story subversions
   */
  enhanceContinuationPrompt(
    basePrompt: string,
    previousTropeIds: string[],
    creature: CreatureType
  ): string {
    if (previousTropeIds.length === 0) {
      return basePrompt;
    }

    const continuationInstructions = this.generateContinuationInstructions(previousTropeIds, creature);
    
    return `${basePrompt}\n\n${continuationInstructions}`;
  }

  /**
   * Stores trope selections for continuity across chapters
   * Returns identifiers that can be saved with story metadata
   */
  serializeTropeSelection(tropeSelection: TropeSelection): string {
    return JSON.stringify({
      tropeIds: tropeSelection.selectedTropeIds,
      timestamp: Date.now()
    });
  }

  /**
   * Restores trope selection from serialized data
   */
  deserializeTropeSelection(
    serializedData: string, 
    creature: CreatureType
  ): TropeSelection | null {
    try {
      const data = JSON.parse(serializedData);
      if (!data.tropeIds || !Array.isArray(data.tropeIds)) {
        return null;
      }

      const creatureTropes = TROPE_DATABASE[creature];
      const allTropes = [...creatureTropes.common, ...creatureTropes.subversive];
      
      const selectedTropes = data.tropeIds
        .map((id: string) => allTropes.find(trope => trope.id === id))
        .filter((trope: Trope | undefined): trope is Trope => trope !== undefined);

      if (selectedTropes.length === 0) {
        return null;
      }

      return {
        selectedTropes,
        subversionInstructions: selectedTropes.map((trope: Trope) => trope.subversionInstruction),
        selectedTropeIds: data.tropeIds
      };
    } catch (error) {
      console.warn('Failed to deserialize trope selection:', error);
      return null;
    }
  }

  private getRandomTropeCount(): number {
    return Math.floor(Math.random() * (this.MAX_TROPES - this.MIN_TROPES + 1)) + this.MIN_TROPES;
  }

  private createWeightedTropePool(
    creatureTropes: { common: Trope[]; subversive: Trope[] },
    avoidCategories: string[]
  ): Trope[] {
    const pool: Trope[] = [];
    
    // Add common tropes 3 times each (75% weight)
    creatureTropes.common
      .filter(trope => !avoidCategories.includes(trope.category))
      .forEach(trope => {
        pool.push(trope, trope, trope);
      });
    
    // Add subversive tropes once each (25% weight)
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
    preferredIntensity?: string
  ): Trope[] {
    const selected: Trope[] = [];
    const usedIds = new Set<string>();
    const poolCopy = [...pool];

    // Filter by intensity if specified
    if (preferredIntensity) {
      const filteredPool = poolCopy.filter(trope => trope.intensity === preferredIntensity);
      if (filteredPool.length >= count) {
        poolCopy.splice(0, poolCopy.length, ...filteredPool);
      }
    }

    while (selected.length < count && poolCopy.length > 0) {
      const randomIndex = Math.floor(Math.random() * poolCopy.length);
      const selectedTrope = poolCopy[randomIndex];
      
      if (!usedIds.has(selectedTrope.id)) {
        selected.push(selectedTrope);
        usedIds.add(selectedTrope.id);
      }
      
      // Remove all instances of this trope from pool
      for (let i = poolCopy.length - 1; i >= 0; i--) {
        if (poolCopy[i].id === selectedTrope.id) {
          poolCopy.splice(i, 1);
        }
      }
    }

    return selected;
  }

  private formatSubversionInstructions(
    tropeSelection: TropeSelection, 
    creature: CreatureType
  ): string {
    const creatureName = creature.charAt(0).toUpperCase() + creature.slice(1);
    
    let instructions = `\nTrope Subversion Instructions (for story uniqueness):\n`;
    instructions += `- Subvert these common ${creatureName} romance tropes in unexpected ways:\n`;
    
    tropeSelection.selectedTropes.forEach((trope, index) => {
      instructions += `  ${index + 1}. ${trope.name}: ${trope.subversionInstruction}\n`;
    });
    
    instructions += `- Integrate these subversions naturally into the story flow\n`;
    instructions += `- Maintain character consistency despite the subversions\n`;
    instructions += `- Keep the romantic tension and spicy elements intact\n`;
    
    return instructions;
  }

  private generateContinuationInstructions(
    tropeIds: string[], 
    creature: CreatureType
  ): string {
    const creatureTropes = TROPE_DATABASE[creature];
    const allTropes = [...creatureTropes.common, ...creatureTropes.subversive];
    
    const previousTropes = tropeIds
      .map(id => allTropes.find(trope => trope.id === id))
      .filter((trope): trope is Trope => trope !== undefined);

    if (previousTropes.length === 0) {
      return '';
    }

    let instructions = `\nContinue Trope Subversions:\n`;
    instructions += `- Maintain consistency with these established character traits:\n`;
    
    previousTropes.forEach((trope, index) => {
      instructions += `  ${index + 1}. ${trope.name}: Continue the ${trope.subversionInstruction.toLowerCase()}\n`;
    });
    
    instructions += `- Keep these subversions consistent throughout the chapter\n`;
    instructions += `- Don't reverse or contradict the established subversions\n`;
    
    return instructions;
  }

  /**
   * Debug method to get all available tropes for a creature (development only)
   */
  getAllTropesForCreature(creature: CreatureType): { common: Trope[]; subversive: Trope[] } {
    return TROPE_DATABASE[creature];
  }

  /**
   * Get trope statistics for monitoring subversion effectiveness
   */
  getTropeStatistics(creature: CreatureType): {
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
}