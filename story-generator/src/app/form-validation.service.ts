import { Injectable } from '@angular/core';
import { VALIDATION_RULES, CreatureType, ThemeType, SpicyLevel, WordCount } from './contracts';

export interface ValidationResult {
  isValid: boolean;
  errors: { [field: string]: string };
}

export interface StoryFormData {
  selectedCreature: string;
  selectedThemes: string[];
  userInput: string;
  spicyLevel: number;
  wordCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {

  validateForm(formData: StoryFormData): ValidationResult {
    const errors: { [field: string]: string } = {};

    // Validate creature selection
    if (!formData.selectedCreature) {
      errors['selectedCreature'] = 'Please select a creature';
    }

    // Validate themes
    if (formData.selectedThemes.length === 0) {
      errors['selectedThemes'] = 'Please select at least one theme';
    } else if (formData.selectedThemes.length > VALIDATION_RULES.themes.maxCount) {
      errors['selectedThemes'] = `Please select no more than ${VALIDATION_RULES.themes.maxCount} themes`;
    }

    // Validate theme values
    const invalidThemes = formData.selectedThemes.filter(theme => 
      !VALIDATION_RULES.themes.allowedValues.includes(theme as ThemeType)
    );
    if (invalidThemes.length > 0) {
      errors['selectedThemes'] = `Invalid themes: ${invalidThemes.join(', ')}`;
    }

    // Validate user input
    if (formData.userInput.length > VALIDATION_RULES.userInput.maxLength) {
      errors['userInput'] = `User input must be ${VALIDATION_RULES.userInput.maxLength} characters or less`;
    }

    // Validate spicy level
    if (formData.spicyLevel < VALIDATION_RULES.spicyLevel.min || 
        formData.spicyLevel > VALIDATION_RULES.spicyLevel.max) {
      errors['spicyLevel'] = `Spicy level must be between ${VALIDATION_RULES.spicyLevel.min} and ${VALIDATION_RULES.spicyLevel.max}`;
    }

    // Validate word count
    if (!VALIDATION_RULES.wordCount.allowedValues.includes(formData.wordCount as WordCount)) {
      errors['wordCount'] = `Word count must be one of: ${VALIDATION_RULES.wordCount.allowedValues.join(', ')}`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  validateField(fieldName: keyof StoryFormData, value: any, allFormData?: StoryFormData): string | null {
    const tempFormData: StoryFormData = allFormData || {
      selectedCreature: '',
      selectedThemes: [],
      userInput: '',
      spicyLevel: 3,
      wordCount: 900
    };

    // Update the specific field safely
    const updatedFormData = { ...tempFormData };
    (updatedFormData as any)[fieldName] = value;

    const result = this.validateForm(updatedFormData);
    return result.errors[fieldName] || null;
  }

  getFieldRequirements(fieldName: keyof StoryFormData): string {
    switch (fieldName) {
      case 'selectedCreature':
        return 'Required: Select a creature type';
      case 'selectedThemes':
        return `Required: Select 1-${VALIDATION_RULES.themes.maxCount} themes`;
      case 'userInput':
        return `Optional: Up to ${VALIDATION_RULES.userInput.maxLength} characters`;
      case 'spicyLevel':
        return `Required: Level ${VALIDATION_RULES.spicyLevel.min}-${VALIDATION_RULES.spicyLevel.max}`;
      case 'wordCount':
        return `Required: Choose from ${VALIDATION_RULES.wordCount.allowedValues.join(', ')} words`;
      default:
        return '';
    }
  }
}