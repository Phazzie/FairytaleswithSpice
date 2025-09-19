import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from './story.service';
import { NotificationService } from './notification.service';
import { NotificationsComponent } from './notifications.component';
import { FormValidator, FormValidationState } from './form-validator';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam, UIState } from './contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, NotificationsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('story-generator');

  // Inject services
  private notificationService = inject(NotificationService);
  
  constructor(private storyService: StoryService) {
    // Set up reactive validation
    this.formValidation = computed(() => {
      return FormValidator.validateForm(
        this.selectedCreature,
        this.selectedThemes,
        this.userInput,
        this.spicyLevel,
        this.wordCount
      );
    });
  }

  // Form data
  selectedCreature: string = 'vampire';
  selectedThemes: string[] = ['romance']; // Start with just one theme selected
  userInput: string = '';
  spicyLevel: number = 3;
  wordCount: number = 900;

  // UI state - enhanced with better error handling
  isGenerating: boolean = false;
  isConvertingAudio: boolean = false;
  isSaving: boolean = false;
  isGeneratingNext: boolean = false;
  lastError: string | null = null;

  // Form validation
  formValidation: any; // Will be properly typed in constructor
  showValidationErrors: boolean = false;

  // Story data
  currentStory: string = '';

  // Progress tracking
  audioProgress: number = 0;
  saveSuccess: boolean = false;
  audioSuccess: boolean = false;

  // Options data
  creatures = [
    { value: 'vampire', label: '🧛 Vampire' },
    { value: 'werewolf', label: '🐺 Werewolf' },
    { value: 'fairy', label: '🧚 Fairy' }
  ];

  themes = [
    { value: 'romance', label: '💕 Romance' },
    { value: 'adventure', label: '🗺️ Adventure' },
    { value: 'mystery', label: '🔍 Mystery' },
    { value: 'comedy', label: '😂 Comedy' },
    { value: 'dark', label: '🌑 Dark' }
  ];

  wordCountOptions = [
    { value: 700, label: '700 words' },
    { value: 900, label: '900 words' },
    { value: 1200, label: '1200 words' }
  ];

  spicyLevelLabels = ['Mild', 'Warm', 'Hot', 'Spicy', 'Fire 🔥'];

  // Methods with enhanced error handling and validation
  generateStory() {
    // Validate form before generation
    this.showValidationErrors = true;
    const validation = this.formValidation();
    
    if (!validation.overall.isValid) {
      this.notificationService.showError(
        'Please fix the form errors',
        validation.overall.errors.join('. ')
      );
      return;
    }

    this.isGenerating = true;
    this.currentStory = '';
    this.lastError = null;

    const request: StoryGenerationSeam['input'] = {
      creature: this.selectedCreature as any,
      themes: this.selectedThemes as any,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel as any,
      wordCount: this.wordCount as any
    };

    this.storyService.generateStory(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentStory = response.data.content;
          this.isGenerating = false;
          this.notificationService.showSuccess(
            'Story Generated!',
            'Your spicy tale is ready to read.'
          );
          this.showValidationErrors = false; // Hide validation errors on success
        }
      },
      error: (error) => {
        console.error('Story generation failed:', error);
        this.isGenerating = false;
        this.lastError = 'Failed to generate story. Please try again.';
        this.notificationService.showError(
          'Generation Failed',
          'There was an error creating your story. Please check your settings and try again.'
        );
      }
    });
  }

  generateNextChapter() {
    this.isGeneratingNext = true;
    this.lastError = null;

    const request: ChapterContinuationSeam['input'] = {
      storyId: 'current-story', // In a real app, this would be the actual story ID
      currentChapterCount: 1, // In a real app, this would be tracked
      existingContent: this.currentStory,
      userInput: '',
      maintainTone: true
    };

    this.storyService.generateNextChapter(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentStory = response.data.appendedToStory;
          this.isGeneratingNext = false;
          this.notificationService.showSuccess(
            'Chapter Added!',
            'Your story continues with a new exciting chapter.'
          );
        }
      },
      error: (error) => {
        console.error('Chapter generation failed:', error);
        this.isGeneratingNext = false;
        this.lastError = 'Failed to generate next chapter. Please try again.';
        this.notificationService.showError(
          'Chapter Generation Failed',
          'Unable to continue your story. Please try again.'
        );
      }
    });
  }

  convertToAudio() {
    this.isConvertingAudio = true;
    this.audioProgress = 0;
    this.lastError = null;

    const request: AudioConversionSeam['input'] = {
      storyId: 'current-story', // In a real app, this would be the actual story ID
      content: this.currentStory,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };

    this.storyService.convertToAudio(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.isConvertingAudio = false;
          this.notificationService.showSuccess(
            'Audio Ready!',
            'Your story has been converted to audio and is ready for download.'
          );
        }
      },
      error: (error) => {
        console.error('Audio conversion failed:', error);
        this.isConvertingAudio = false;
        this.lastError = 'Failed to convert to audio. Please try again.';
        this.notificationService.showError(
          'Audio Conversion Failed',
          'Unable to create audio version. Please try again later.'
        );
      }
    });
  }

  saveStory() {
    this.isSaving = true;
    this.lastError = null;

    const request: SaveExportSeam['input'] = {
      storyId: 'current-story', // In a real app, this would be the actual story ID
      content: this.currentStory,
      title: 'Spicy Story', // In a real app, this would be extracted from the story
      format: 'pdf',
      includeMetadata: true,
      includeChapters: true
    };

    this.storyService.saveStory(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.isSaving = false;
          this.notificationService.showSuccess(
            'Story Saved!',
            'Your story has been saved and is ready for download.'
          );
        }
      },
      error: (error) => {
        console.error('Save failed:', error);
        this.isSaving = false;
        this.lastError = 'Failed to save story. Please try again.';
        this.notificationService.showError(
          'Save Failed',
          'Unable to save your story. Please try again.'
        );
      }
    });
  }

  // Helper methods for validation
  getFieldValidation(field: keyof FormValidationState) {
    return this.formValidation()[field];
  }

  hasFieldError(field: keyof FormValidationState): boolean {
    if (!this.showValidationErrors) return false;
    const validation = this.getFieldValidation(field);
    return !validation.isValid && validation.errors.length > 0;
  }

  getFieldErrors(field: keyof FormValidationState): string[] {
    if (!this.showValidationErrors) return [];
    const validation = this.getFieldValidation(field);
    return validation.isValid ? [] : validation.errors;
  }

  isFormValid(): boolean {
    return this.formValidation().overall.isValid;
  }

  // TrackBy functions for performance
  trackByCreature(index: number, creature: any): string {
    return creature.value;
  }

  trackByTheme(index: number, theme: any): string {
    return theme.value;
  }

  // Theme selection handler
  onThemeChange(themeValue: string, event: any): void {
    if (event.target.checked) {
      if (!this.selectedThemes.includes(themeValue)) {
        this.selectedThemes.push(themeValue);
      }
    } else {
      this.selectedThemes = this.selectedThemes.filter(theme => theme !== themeValue);
    }
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }
}
