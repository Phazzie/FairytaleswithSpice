import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { ErrorDisplay } from './error-display/error-display';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, ErrorDisplay],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('story-generator');

  // Inject the services
  constructor(
    private storyService: StoryService,
    private errorLogging: ErrorLoggingService
  ) {}

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
    try {
      this.errorLogging.logError('Starting story generation', 'Story Generation', 'info');
      
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
          try {
            if (response.success && response.data) {
              this.currentStory = response.data.content;
              this.isGenerating = false;
              this.errorLogging.logError('Story generation completed successfully', 'Story Generation', 'info');
            } else {
              throw new Error(response.error?.message || 'Story generation failed without data');
            }
          } catch (error) {
            this.errorLogging.logError(error, 'Story Generation - Response Processing', 'error');
            this.isGenerating = false;
          }
        },
        error: (error) => {
          this.errorLogging.logError(error, 'Story Generation - HTTP Request', 'error');
          this.isGenerating = false;
        }
      });
    } catch (error) {
      this.errorLogging.logError(error, 'Story Generation - Method Setup', 'error');
      this.isGenerating = false;
    }
  }

  generateNextChapter() {
    try {
      this.errorLogging.logError('Starting chapter continuation', 'Chapter Generation', 'info');
      
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
          try {
            if (response.success && response.data) {
              this.currentStory = response.data.appendedToStory;
              this.isGeneratingNext = false;
              this.errorLogging.logError('Chapter generation completed successfully', 'Chapter Generation', 'info');
            } else {
              throw new Error(response.error?.message || 'Chapter generation failed without data');
            }
          } catch (error) {
            this.errorLogging.logError(error, 'Chapter Generation - Response Processing', 'error');
            this.isGeneratingNext = false;
          }
        },
        error: (error) => {
          this.errorLogging.logError(error, 'Chapter Generation - HTTP Request', 'error');
          this.isGeneratingNext = false;
        }
      });
    } catch (error) {
      this.errorLogging.logError(error, 'Chapter Generation - Method Setup', 'error');
      this.isGeneratingNext = false;
    }
  }

  convertToAudio() {
    try {
      this.errorLogging.logError('Starting audio conversion', 'Audio Conversion', 'info');
      
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
          try {
            if (response.success && response.data) {
              this.isConvertingAudio = false;
              this.audioSuccess = true;
              this.errorLogging.logError('Audio conversion completed successfully', 'Audio Conversion', 'info');
              setTimeout(() => this.audioSuccess = false, 3000);
            } else {
              throw new Error(response.error?.message || 'Audio conversion failed without data');
            }
          } catch (error) {
            this.errorLogging.logError(error, 'Audio Conversion - Response Processing', 'error');
            this.isConvertingAudio = false;
          }
        },
        error: (error) => {
          this.errorLogging.logError(error, 'Audio Conversion - HTTP Request', 'error');
          this.isConvertingAudio = false;
        }
      });
    } catch (error) {
      this.errorLogging.logError(error, 'Audio Conversion - Method Setup', 'error');
      this.isConvertingAudio = false;
    }
  }

  saveStory() {
    try {
      this.errorLogging.logError('Starting story save', 'Story Save', 'info');
      
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
          try {
            if (response.success && response.data) {
              this.isSaving = false;
              this.saveSuccess = true;
              this.errorLogging.logError('Story save completed successfully', 'Story Save', 'info');
              setTimeout(() => this.saveSuccess = false, 3000);
            } else {
              throw new Error(response.error?.message || 'Story save failed without data');
            }
          } catch (error) {
            this.errorLogging.logError(error, 'Story Save - Response Processing', 'error');
            this.isSaving = false;
          }
        },
        error: (error) => {
          this.errorLogging.logError(error, 'Story Save - HTTP Request', 'error');
          this.isSaving = false;
        }
      });
    } catch (error) {
      this.errorLogging.logError(error, 'Story Save - Method Setup', 'error');
      this.isSaving = false;
    }
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }
}
