import { Component, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from './story.service';
import { NotificationService } from './notification.service';
import { FormValidationService } from './form-validation.service';
import { NotificationsComponent } from './notifications.component';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, NotificationsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('story-generator');

  // Validation and error states - define after constructor
  readonly isFormValid;
  readonly validationErrors;
  
  // Error states for better UX
  lastError = signal<string | null>(null);
  hasError = computed(() => this.lastError() !== null);

  // Inject the services
  constructor(
    private storyService: StoryService,
    private notificationService: NotificationService,
    private formValidationService: FormValidationService
  ) {
    // Initialize computed values after services are injected
    this.isFormValid = this.formValidationService.isFormValid$;
    this.validationErrors = this.formValidationService.validationErrors$;
    
    // Set up reactive form validation
    effect(() => {
      this.formValidationService.updateFormData({
        selectedCreature: this.selectedCreature,
        selectedThemes: this.selectedThemes,
        userInput: this.userInput,
        spicyLevel: this.spicyLevel,
        wordCount: this.wordCount
      });
    });
  }

  // Form data
  selectedCreature: string = 'vampire';
  selectedThemes: string[] = [];
  userInput: string = '';
  spicyLevel: number = 3;
  wordCount: number = 900;

  // UI state
  isGenerating: boolean = false;
  isConvertingAudio: boolean = false;
  isSaving: boolean = false;
  isGeneratingNext: boolean = false;

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

  // Methods
  generateStory() {
    // Reset previous errors
    this.lastError.set(null);
    
    // Validate form before proceeding
    if (!this.isFormValid()) {
      this.notificationService.error(
        'Form Validation Error',
        'Please fix the form errors before generating your story.'
      );
      return;
    }

    this.isGenerating = true;
    this.currentStory = '';
    this.saveSuccess = false;
    this.audioSuccess = false;

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
          this.notificationService.success(
            'Story Generated!',
            'Your spicy tale has been crafted successfully!'
          );
        } else {
          this.handleGenerationError(response.error?.message || 'Unknown error occurred');
        }
      },
      error: (error) => {
        this.handleGenerationError(error.error?.message || 'Story generation failed');
      }
    });
  }

  private handleGenerationError(message: string) {
    this.isGenerating = false;
    this.lastError.set(message);
    this.notificationService.error(
      'Generation Failed',
      message,
      { autoHide: false } // Keep error visible until manually dismissed
    );
  }

  generateNextChapter() {
    this.isGeneratingNext = true;
    this.lastError.set(null);

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
          this.notificationService.success(
            'Chapter Added!',
            'Your story continues with an exciting new chapter!'
          );
        } else {
          this.handleChapterError(response.error?.message || 'Unknown error occurred');
        }
      },
      error: (error) => {
        this.handleChapterError(error.error?.message || 'Chapter generation failed');
      }
    });
  }

  private handleChapterError(message: string) {
    this.isGeneratingNext = false;
    this.lastError.set(message);
    this.notificationService.error(
      'Chapter Generation Failed',
      message
    );
  }

  convertToAudio() {
    this.isConvertingAudio = true;
    this.audioProgress = 0;
    this.audioSuccess = false;
    this.lastError.set(null);

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
          this.audioSuccess = true;
          this.notificationService.success(
            'Audio Ready!',
            'Your story has been converted to audio successfully!'
          );
          setTimeout(() => this.audioSuccess = false, 3000);
        } else {
          this.handleAudioError(response.error?.message || 'Unknown error occurred');
        }
      },
      error: (error) => {
        this.handleAudioError(error.error?.message || 'Audio conversion failed');
      }
    });
  }

  private handleAudioError(message: string) {
    this.isConvertingAudio = false;
    this.audioProgress = 0;
    this.lastError.set(message);
    this.notificationService.error(
      'Audio Conversion Failed',
      message
    );
  }

  saveStory() {
    this.isSaving = true;
    this.lastError.set(null);

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
          this.saveSuccess = true;
          this.notificationService.success(
            'Story Saved!',
            'Your story has been saved successfully and is ready for download!'
          );
          setTimeout(() => this.saveSuccess = false, 3000);
        } else {
          this.handleSaveError(response.error?.message || 'Unknown error occurred');
        }
      },
      error: (error) => {
        this.handleSaveError(error.error?.message || 'Save failed');
      }
    });
  }

  private handleSaveError(message: string) {
    this.isSaving = false;
    this.lastError.set(message);
    this.notificationService.error(
      'Save Failed',
      message
    );
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }

  // Validation utility methods
  getFieldError(field: string): string | undefined {
    const errors = this.validationErrors();
    return errors[field as keyof typeof errors];
  }

  isFieldValid(field: string): boolean {
    return !this.getFieldError(field);
  }

  // Retry methods for failed operations
  retryGeneration() {
    this.lastError.set(null);
    this.generateStory();
  }

  retryAudioConversion() {
    this.lastError.set(null);
    this.convertToAudio();
  }

  retrySave() {
    this.lastError.set(null);
    this.saveStory();
  }

  retryChapter() {
    this.lastError.set(null);
    this.generateNextChapter();
  }

  // Handle theme checkbox changes
  onThemeChange(themeValue: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      if (!this.selectedThemes.includes(themeValue)) {
        this.selectedThemes = [...this.selectedThemes, themeValue];
      }
    } else {
      this.selectedThemes = this.selectedThemes.filter(theme => theme !== themeValue);
    }
    
    // Manually trigger validation after themes change
    this.formValidationService.updateFormData({
      selectedCreature: this.selectedCreature,
      selectedThemes: this.selectedThemes,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount
    });
  }
}
