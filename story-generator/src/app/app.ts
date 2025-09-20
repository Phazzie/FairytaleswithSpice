import { Component, signal, OnInit, OnDestroy, ViewChild, Inject, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { ErrorDisplayComponent } from './error-display/error-display';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';
import { DebugPanel } from './debug-panel/debug-panel';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, ErrorDisplayComponent, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('story-generator');
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild(DebugPanel) debugPanel!: DebugPanel;

  // Inject the services
  constructor(
    private storyService: StoryService,
    private errorLogging: ErrorLoggingService
  ) {}

  // Form data
  selectedCreature: string = 'vampire';
  selectedThemes: Set<string> = new Set();
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
  currentStoryRaw: string = ''; // Raw content with speaker tags for audio processing
  currentStoryId: string = '';
  currentStoryTitle: string = '';
  currentChapterCount: number = 0;
  currentStoryThemes: string[] = [];
  currentStorySpicyLevel: number = 3;

  // Progress tracking
  generationProgress: number = 0;
  generationStatus: string = '';
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
    { value: 'betrayal', label: '🗡️ Betrayal' },
    { value: 'obsession', label: '🖤 Obsession' },
    { value: 'power_dynamics', label: '⚡ Power Dynamics' },
    { value: 'forbidden_love', label: '🚫 Forbidden Love' },
    { value: 'revenge', label: '💀 Revenge' },
    { value: 'manipulation', label: '🕷️ Manipulation' },
    { value: 'seduction', label: '💋 Seduction' },
    { value: 'dark_secrets', label: '🔐 Dark Secrets' },
    { value: 'corruption', label: '🌑 Corruption' },
    { value: 'dominance', label: '👑 Dominance' },
    { value: 'submission', label: '⛓️ Submission' },
    { value: 'jealousy', label: '💚 Jealousy' },
    { value: 'temptation', label: '🍎 Temptation' },
    { value: 'sin', label: '😈 Sin' },
    { value: 'desire', label: '🔥 Desire' },
    { value: 'passion', label: '❤️‍🔥 Passion' },
    { value: 'lust', label: '💦 Lust' },
    { value: 'deceit', label: '🎭 Deceit' }
  ];

  wordCountOptions = [
    { value: 700, label: '700 words' },
    { value: 900, label: '900 words' },
    { value: 1200, label: '1200 words' }
  ];

  spicyLevelLabels = ['Mild', 'Warm', 'Hot', 'Spicy', 'Fire 🔥'];

  // Theme selection methods
  toggleTheme(theme: string) {
    console.log('toggleTheme called with:', theme);
    if (this.selectedThemes.has(theme)) {
      this.selectedThemes.delete(theme);
      console.log('Removed theme:', theme);
    } else if (this.selectedThemes.size < 5) {
      this.selectedThemes.add(theme);
      console.log('Added theme:', theme);
    }
    console.log('Current themes:', Array.from(this.selectedThemes));

    // Force update by reassigning to trigger change detection
    this.selectedThemes = new Set(this.selectedThemes);
  }

  isThemeSelected(theme: string): boolean {
    return this.selectedThemes.has(theme);
  }

  getSelectedThemesCount(): number {
    return this.selectedThemes.size;
  }

  canSelectMoreThemes(): boolean {
    return this.selectedThemes.size < 5;
  }

  canGenerateStory(): boolean {
    return this.selectedThemes.size > 0;
  }

  // TrackBy functions to prevent duplicate rendering
  trackByCreature(index: number, creature: any): string {
    return creature.value;
  }

  trackByTheme(index: number, theme: any): string {
    return theme.value;
  }

  // Methods
  generateStory() {
    if (!this.canGenerateStory()) {
      return; // Prevent generation with no themes
    }

    this.isGenerating = true;
    this.generationProgress = 0;
    this.generationStatus = 'Preparing your story...';
    this.currentStory = '';
    this.saveSuccess = false;
    this.audioSuccess = false;

    this.errorLogging.logInfo('User initiated story generation', 'App.generateStory', {
      creature: this.selectedCreature,
      themes: this.selectedThemes,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount
    });

    // Start progress simulation
    this.simulateGenerationProgress();

    const request: StoryGenerationSeam['input'] = {
      creature: this.selectedCreature as any,
      themes: Array.from(this.selectedThemes) as any,
      userInput: this.userInput,
      spicyLevel: this.spicyLevel as any,
      wordCount: this.wordCount as any
    };

    this.storyService.generateStory(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Complete progress
          this.generationProgress = 100;
          this.generationStatus = 'Story generated successfully!';

          // Store complete story data
          this.currentStory = response.data.content;
          this.currentStoryRaw = response.data.rawContent || response.data.content; // Fallback to regular content
          this.currentStoryId = response.data.storyId;
          this.currentStoryTitle = response.data.title;
          this.currentChapterCount = 1;
          this.currentStoryThemes = response.data.themes;
          this.currentStorySpicyLevel = response.data.spicyLevel;

          this.isGenerating = false;
          this.errorLogging.logInfo('Story generation completed successfully', 'App.generateStory', {
            storyId: response.data.storyId,
            wordCount: response.data.actualWordCount
          });

          // Reset progress after a short delay
          setTimeout(() => {
            this.generationProgress = 0;
            this.generationStatus = '';
          }, 2000);
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.generateStory', 'error', {
          request,
          userAction: 'story_generation'
        });
        this.isGenerating = false;
        this.generationProgress = 0;
        this.generationStatus = 'Story generation failed';

        // Reset error status after delay
        setTimeout(() => {
          this.generationStatus = '';
        }, 3000);
      }
    });
  }

  private simulateGenerationProgress() {
    // Simulate realistic story generation progress
    const steps = [
      { progress: 10, status: 'Analyzing your preferences...', delay: 300 },
      { progress: 25, status: 'Creating character profiles...', delay: 800 },
      { progress: 40, status: 'Building the world...', delay: 1200 },
      { progress: 60, status: 'Crafting the plot...', delay: 1500 },
      { progress: 80, status: 'Adding spicy details...', delay: 1000 },
      { progress: 90, status: 'Polishing the narrative...', delay: 500 }
    ];

    let currentStep = 0;
    const executeNextStep = () => {
      if (currentStep < steps.length && this.isGenerating) {
        const step = steps[currentStep];
        this.generationProgress = step.progress;
        this.generationStatus = step.status;
        currentStep++;

        setTimeout(executeNextStep, step.delay);
      }
    };

    setTimeout(executeNextStep, 500);
  }

  generateNextChapter() {
    this.isGeneratingNext = true;

    this.errorLogging.logInfo('User initiated chapter continuation', 'App.generateNextChapter');

    const request: ChapterContinuationSeam['input'] = {
      storyId: this.currentStoryId,
      currentChapterCount: this.currentChapterCount,
      existingContent: this.currentStory,
      userInput: '',
      maintainTone: true
    };

    this.storyService.generateNextChapter(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentStory = response.data.appendedToStory;
          this.currentChapterCount = response.data.chapterNumber;
          this.isGeneratingNext = false;
          this.errorLogging.logInfo('Chapter continuation completed successfully', 'App.generateNextChapter', {
            chapterId: response.data.chapterId,
            chapterNumber: response.data.chapterNumber
          });
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.generateNextChapter', 'error', {
          request,
          userAction: 'chapter_continuation'
        });
        this.isGeneratingNext = false;
      }
    });
  }

  convertToAudio() {
    this.isConvertingAudio = true;
    this.audioProgress = 0;
    this.audioSuccess = false;

    this.errorLogging.logInfo('User initiated audio conversion', 'App.convertToAudio', {
      contentLength: this.currentStory.length
    });

    const request: AudioConversionSeam['input'] = {
      storyId: this.currentStoryId,
      content: this.currentStory,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };

    // Add rawContent if available for enhanced audio processing
    if (this.currentStoryRaw && this.currentStoryRaw !== this.currentStory) {
      (request as any).rawContent = this.currentStoryRaw;
    }

    this.storyService.convertToAudio(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.isConvertingAudio = false;
          this.audioSuccess = true;
          this.errorLogging.logInfo('Audio conversion completed successfully', 'App.convertToAudio', {
            audioId: response.data.audioId,
            duration: response.data.duration,
            fileSize: response.data.fileSize
          });
          setTimeout(() => this.audioSuccess = false, 3000);
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.convertToAudio', 'error', {
          request,
          userAction: 'audio_conversion'
        });
        this.isConvertingAudio = false;
      }
    });
  }

  saveStory() {
    this.isSaving = true;

    this.errorLogging.logInfo('User initiated story save/export', 'App.saveStory', {
      contentLength: this.currentStory.length
    });

    const request: SaveExportSeam['input'] = {
      storyId: this.currentStoryId,
      content: this.currentStory,
      title: this.currentStoryTitle,
      format: 'pdf',
      includeMetadata: true,
      includeChapters: true
    };

    this.storyService.saveStory(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.isSaving = false;
          this.saveSuccess = true;
          this.errorLogging.logInfo('Story save/export completed successfully', 'App.saveStory', {
            exportId: response.data.exportId,
            format: response.data.format,
            fileSize: response.data.fileSize
          });
          setTimeout(() => this.saveSuccess = false, 3000);
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.saveStory', 'error', {
          request,
          userAction: 'story_export'
        });
        this.isSaving = false;
      }
    });
  }

  getCreatureName(): string {
    const creature = this.creatures.find(c => c.value === this.selectedCreature);
    return creature ? creature.label.split(' ')[1] : 'Creature';
  }

  // ==================== DEBUG PANEL LIFECYCLE ====================

  ngOnInit() {
    if (this.isBrowser) {
      this.setupKeyboardShortcuts();
    }
  }

  ngOnDestroy() {
    if (this.isBrowser) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    // Ctrl+Shift+D to toggle debug panel
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      if (this.debugPanel) {
        this.debugPanel.toggleVisibility();
      }
    }
  }

  // ==================== DEBUG METHODS FOR ERROR LOGGING DEMO ====================

  testErrorLogging() {
    // Simulate different types of errors for demonstration
    this.errorLogging.logInfo('Demo info message', 'App.testErrorLogging', { action: 'demo_test' });
    this.errorLogging.logWarning('Demo warning message', 'App.testErrorLogging', { action: 'demo_test' });
    this.errorLogging.logError(new Error('Demo error message'), 'App.testErrorLogging', 'error', { action: 'demo_test' });
    this.errorLogging.logCritical(new Error('Demo critical error'), 'App.testErrorLogging', { action: 'demo_test' });
  }

  simulateHttpError() {
    // Simulate an HTTP error to test error logging integration
    this.errorLogging.logError({
      status: 404,
      statusText: 'Not Found',
      message: 'Simulated HTTP 404 error',
      url: '/api/fake-endpoint'
    }, 'App.simulateHttpError', 'error', {
      type: 'simulated_http_error',
      endpoint: '/api/fake-endpoint'
    });
  }
}
