import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoryService } from './story.service';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('story-generator');

  // Inject the service
  constructor(private storyService: StoryService) {}

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
        }
      },
      error: (error) => {
        console.error('Story generation failed:', error);
        this.isGenerating = false;
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
        }
      },
      error: (error) => {
        console.error('Chapter generation failed:', error);
        this.isGeneratingNext = false;
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
      format: 'mp3',
      multiVoice: true, // Enable multi-voice generation
      creatureType: this.selectedCreature as any
    };

    this.storyService.convertToAudio(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.isConvertingAudio = false;
          this.audioSuccess = true;
          console.log('Multi-voice audio conversion completed:', response.data);
          setTimeout(() => this.audioSuccess = false, 3000);
        }
      },
      error: (error) => {
        console.error('Audio conversion failed:', error);
        this.isConvertingAudio = false;
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
          setTimeout(() => this.saveSuccess = false, 3000);
        }
      },
      error: (error) => {
        console.error('Save failed:', error);
        this.isSaving = false;
      }
    });
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }
}
