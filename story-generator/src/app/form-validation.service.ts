import { Injectable, computed, signal } from '@angular/core';
import { VALIDATION_RULES, CreatureType, ThemeType, SpicyLevel, WordCount } from './contracts';

export interface FormValidationErrors {
  creature?: string;
  themes?: string;
  userInput?: string;
  spicyLevel?: string;
  wordCount?: string;
}

export interface FormData {
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
  private formData = signal<FormData>({
    selectedCreature: 'vampire',
    selectedThemes: [],
    userInput: '',
    spicyLevel: 3,
    wordCount: 900
  });

  private validationErrors = signal<FormValidationErrors>({});

  // Public readonly signals
  readonly formData$ = this.formData.asReadonly();
  readonly validationErrors$ = this.validationErrors.asReadonly();
  
  // Computed signal for form validity
  readonly isFormValid$ = computed(() => {
    const errors = this.validationErrors();
    return Object.keys(errors).length === 0;
  });

  constructor() {}

  updateFormData(updates: Partial<FormData>): void {
    this.formData.update(current => ({ ...current, ...updates }));
    this.validateForm();
  }

  validateForm(): void {
    const data = this.formData();
    const errors: FormValidationErrors = {};

    // Validate creature selection
    if (!data.selectedCreature) {
      errors.creature = 'Please select a creature';
    } else if (!['vampire', 'werewolf', 'fairy'].includes(data.selectedCreature)) {
      errors.creature = 'Please select a valid creature';
    }

    // Validate themes
    if (data.selectedThemes.length === 0) {
      errors.themes = 'Please select at least one theme';
    } else if (data.selectedThemes.length > VALIDATION_RULES.themes.maxCount) {
      errors.themes = `Please select no more than ${VALIDATION_RULES.themes.maxCount} themes`;
    } else {
      const invalidThemes = data.selectedThemes.filter(theme => 
        !VALIDATION_RULES.themes.allowedValues.includes(theme as any)
      );
      if (invalidThemes.length > 0) {
        errors.themes = 'Please select valid themes only';
      }
    }

    // Validate user input
    if (data.userInput.length > VALIDATION_RULES.userInput.maxLength) {
      errors.userInput = `Description must be ${VALIDATION_RULES.userInput.maxLength} characters or less`;
    }

    // Validate spicy level
    if (data.spicyLevel < VALIDATION_RULES.spicyLevel.min || data.spicyLevel > VALIDATION_RULES.spicyLevel.max) {
      errors.spicyLevel = `Spicy level must be between ${VALIDATION_RULES.spicyLevel.min} and ${VALIDATION_RULES.spicyLevel.max}`;
    }

    // Validate word count
    if (!VALIDATION_RULES.wordCount.allowedValues.includes(data.wordCount as any)) {
      errors.wordCount = 'Please select a valid word count';
    }

    this.validationErrors.set(errors);
  }

  // Get specific field error
  getFieldError(field: keyof FormValidationErrors): string | undefined {
    return this.validationErrors()[field];
  }

  // Check if specific field is valid
  isFieldValid(field: keyof FormValidationErrors): boolean {
    return !this.validationErrors()[field];
  }

  // Reset validation
  resetValidation(): void {
    this.validationErrors.set({});
  }

  // Get current form data for submission
  getFormData(): FormData {
    return this.formData();
  }
}