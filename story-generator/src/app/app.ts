import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from './story.service';
import { NotificationService } from './notification.service';
import { NotificationComponent } from './notification.component';
import { FormValidationService, ValidationResult, StoryFormData } from './form-validation.service';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('story-generator');

  // Inject services
  constructor(
    private storyService: StoryService,
    private notificationService: NotificationService,
    private formValidationService: FormValidationService
  ) {}

  // Form data
  selectedCreature: string = 'vampire';
  selectedThemes: string[] = ['romance', 'adventure', 'comedy'];
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

  // Form validation
  formValidation: ValidationResult = { isValid: false, errors: {} };
  fieldErrors: { [key: string]: string } = {};

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
  ngOnInit() {
    this.validateForm();
  }

  validateForm() {
    const formData = {
      selectedCreature: this.selectedCreature,
      selectedThemes: this.selectedThemes,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount
    };
    this.formValidation = this.formValidationService.validateForm(formData);
  }

  validateField(fieldName: string) {
    const formData = {
      selectedCreature: this.selectedCreature,
      selectedThemes: this.selectedThemes,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount
    };
    
    let fieldValue: any;
    switch (fieldName) {
      case 'selectedCreature':
        fieldValue = this.selectedCreature;
        break;
      case 'selectedThemes':
        fieldValue = this.selectedThemes;
        break;
      case 'userInput':
        fieldValue = this.userInput;
        break;
      case 'spicyLevel':
        fieldValue = this.spicyLevel;
        break;
      case 'wordCount':
        fieldValue = this.wordCount;
        break;
      default:
        return;
    }
    
    const error = this.formValidationService.validateField(fieldName as keyof StoryFormData, fieldValue, formData);
    if (error) {
      this.fieldErrors[fieldName] = error;
    } else {
      delete this.fieldErrors[fieldName];
    }
    this.validateForm();
  }

  onCreatureChange() {
    this.validateField('selectedCreature');
  }

  onThemeToggle(themeValue: string, event: any) {
    if (event.target.checked) {
      if (!this.selectedThemes.includes(themeValue)) {
        this.selectedThemes.push(themeValue);
      }
    } else {
      const index = this.selectedThemes.indexOf(themeValue);
      if (index > -1) {
        this.selectedThemes.splice(index, 1);
      }
    }
    this.onThemesChange();
  }

  onThemesChange() {
    this.validateField('selectedThemes');
  }

  onUserInputChange() {
    this.validateField('userInput');
  }

  onSpicyLevelChange() {
    this.validateField('spicyLevel');
  }

  onWordCountChange() {
    this.validateField('wordCount');
  }

  isFormValid(): boolean {
    return this.formValidation.isValid;
  }
  generateStory() {
    if (!this.isFormValid()) {
      this.notificationService.showError('Please fix the form errors before generating a story');
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
          this.notificationService.showSuccess('🎉 Your spicy story has been crafted!');
        }
      },
      error: (error) => {
        console.error('Story generation failed:', error);
        this.isGenerating = false;
        this.notificationService.showError(
          error.error?.message || 'Failed to generate story. Please try again.'
        );
      }
    });
  }

  generateNextChapter() {
    this.isGeneratingNext = true;

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
          this.notificationService.showSuccess('📖 Next chapter added to your story!');
        }
      },
      error: (error) => {
        console.error('Chapter generation failed:', error);
        this.isGeneratingNext = false;
        this.notificationService.showError(
          error.error?.message || 'Failed to generate next chapter. Please try again.'
        );
      }
    });
  }

  convertToAudio() {
    this.isConvertingAudio = true;
    this.audioProgress = 0;
    this.audioSuccess = false;

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
          this.notificationService.showSuccess('🎵 Audio conversion completed! Download ready.');
          setTimeout(() => this.audioSuccess = false, 3000);
        }
      },
      error: (error) => {
        console.error('Audio conversion failed:', error);
        this.isConvertingAudio = false;
        this.notificationService.showError(
          error.error?.message || 'Audio conversion failed. Please try again.'
        );
      }
    });
  }

  saveStory() {
    this.isSaving = true;

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
          this.notificationService.showSuccess('💾 Story saved successfully!');
          setTimeout(() => this.saveSuccess = false, 3000);
        }
      },
      error: (error) => {
        console.error('Save failed:', error);
        this.isSaving = false;
        this.notificationService.showError(
          error.error?.message || 'Failed to save story. Please try again.'
        );
      }
    });
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }
}
