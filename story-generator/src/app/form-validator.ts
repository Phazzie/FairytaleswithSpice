export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FormValidationState {
  creature: ValidationResult;
  themes: ValidationResult;
  userInput: ValidationResult;
  spicyLevel: ValidationResult;
  wordCount: ValidationResult;
  overall: ValidationResult;
}

export class FormValidator {
  static validateCreature(creature: string): ValidationResult {
    const validCreatures = ['vampire', 'werewolf', 'fairy'];
    
    if (!creature || !creature.trim()) {
      return {
        isValid: false,
        errors: ['Please select a creature for your story']
      };
    }
    
    if (!validCreatures.includes(creature)) {
      return {
        isValid: false,
        errors: ['Please select a valid creature']
      };
    }
    
    return { isValid: true, errors: [] };
  }

  static validateThemes(themes: string[]): ValidationResult {
    const validThemes = ['romance', 'adventure', 'mystery', 'comedy', 'dark'];
    
    if (!themes || themes.length === 0) {
      return {
        isValid: false,
        errors: ['Please select at least one theme for your story']
      };
    }
    
    if (themes.length > 5) {
      return {
        isValid: false,
        errors: ['Please select no more than 5 themes to maintain story focus']
      };
    }
    
    const invalidThemes = themes.filter(theme => !validThemes.includes(theme));
    if (invalidThemes.length > 0) {
      return {
        isValid: false,
        errors: [`Invalid themes selected: ${invalidThemes.join(', ')}`]
      };
    }
    
    return { isValid: true, errors: [] };
  }

  static validateUserInput(userInput: string): ValidationResult {
    // User input is optional, so empty is valid
    if (!userInput || !userInput.trim()) {
      return { isValid: true, errors: [] };
    }
    
    const trimmed = userInput.trim();
    
    if (trimmed.length > 500) {
      return {
        isValid: false,
        errors: ['Your ideas should be no more than 500 characters']
      };
    }
    
    if (trimmed.length < 10 && trimmed.length > 0) {
      return {
        isValid: false,
        errors: ['If providing ideas, please write at least 10 characters']
      };
    }
    
    return { isValid: true, errors: [] };
  }

  static validateSpicyLevel(spicyLevel: number): ValidationResult {
    if (!spicyLevel || spicyLevel < 1 || spicyLevel > 5) {
      return {
        isValid: false,
        errors: ['Please select a spicy level between 1 and 5']
      };
    }
    
    return { isValid: true, errors: [] };
  }

  static validateWordCount(wordCount: number): ValidationResult {
    const validCounts = [700, 900, 1200];
    
    if (!wordCount || !validCounts.includes(wordCount)) {
      return {
        isValid: false,
        errors: ['Please select a valid word count']
      };
    }
    
    return { isValid: true, errors: [] };
  }

  static validateForm(
    creature: string,
    themes: string[],
    userInput: string,
    spicyLevel: number,
    wordCount: number
  ): FormValidationState {
    const creatureValidation = this.validateCreature(creature);
    const themesValidation = this.validateThemes(themes);
    const userInputValidation = this.validateUserInput(userInput);
    const spicyLevelValidation = this.validateSpicyLevel(spicyLevel);
    const wordCountValidation = this.validateWordCount(wordCount);
    
    const allErrors = [
      ...creatureValidation.errors,
      ...themesValidation.errors,
      ...userInputValidation.errors,
      ...spicyLevelValidation.errors,
      ...wordCountValidation.errors
    ];
    
    return {
      creature: creatureValidation,
      themes: themesValidation,
      userInput: userInputValidation,
      spicyLevel: spicyLevelValidation,
      wordCount: wordCountValidation,
      overall: {
        isValid: allErrors.length === 0,
        errors: allErrors
      }
    };
  }
}