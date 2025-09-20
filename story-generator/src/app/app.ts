import { Component, signal, OnInit, OnDestroy, ViewChild, Inject, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { ErrorDisplayComponent } from './error-display/error-display';
import { 
  StoryGenerationSeam, 
  ChapterContinuationSeam, 
  AudioConversionSeam, 
  SaveExportSeam,
  StoryArcSeam,
  AudiobookCompilationSeam,
  StoryArc,
  CliffhangerType
} from './contracts';
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
  currentStoryId: string = '';
  currentStoryTitle: string = '';
  currentChapterCount: number = 0;
  currentStoryThemes: string[] = [];
  currentStorySpicyLevel: number = 3;

  // Story Arc data
  currentStoryArc: StoryArc | null = null;
  isCompilingAudiobook: boolean = false;
  compiledAudiobooks: string[] = [];
  cliffhangerHistory: CliffhangerType[] = [];

  // Progress tracking
  audioProgress: number = 0;
  saveSuccess: boolean = false;
  audioSuccess: boolean = false;
  audiobookCompilationProgress: number = 0;
  audiobookCompilationSuccess: boolean = false;

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
    this.currentStory = '';
    this.saveSuccess = false;
    this.audioSuccess = false;

    this.errorLogging.logInfo('User initiated story generation', 'App.generateStory', {
      creature: this.selectedCreature,
      themes: this.selectedThemes,
      spicyLevel: this.spicyLevel,
      wordCount: this.wordCount
    });

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
          // Store complete story data
          this.currentStory = response.data.content;
          this.currentStoryId = response.data.storyId;
          this.currentStoryTitle = response.data.title;
          this.currentChapterCount = 1;
          this.currentStoryThemes = response.data.themes;
          this.currentStorySpicyLevel = response.data.spicyLevel;
          
          // Create story arc for multi-chapter management
          this.createStoryArc(response.data);
          
          this.isGenerating = false;
          this.errorLogging.logInfo('Story generation completed successfully', 'App.generateStory', {
            storyId: response.data.storyId,
            wordCount: response.data.actualWordCount
          });
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.generateStory', 'error', {
          request,
          userAction: 'story_generation'
        });
        this.isGenerating = false;
      }
    });
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

  // ==================== STORY ARC MANAGEMENT ====================

  createStoryArc(storyData: StoryGenerationSeam['output']) {
    const request: StoryArcSeam['input'] = {
      storyId: storyData.storyId,
      operation: 'create',
      arcData: {
        title: storyData.title,
        currentSpiceLevel: storyData.spicyLevel,
        totalWordCount: storyData.actualWordCount,
        totalAudioDuration: 0
      }
    };

    this.storyService.manageStoryArc(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentStoryArc = response.data.storyArc;
          this.errorLogging.logInfo('Story arc created', 'App.createStoryArc', {
            arcId: this.currentStoryArc.arcId
          });
        }
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.createStoryArc', 'warning');
      }
    });
  }

  compileAudiobook() {
    if (!this.currentStoryArc || this.currentStoryArc.chapters.length < 2) {
      this.errorLogging.logInfo('Not enough chapters for audiobook compilation', 'App.compileAudiobook');
      return;
    }

    this.isCompilingAudiobook = true;
    this.audiobookCompilationProgress = 0;

    const request: AudiobookCompilationSeam['input'] = {
      storyArcId: this.currentStoryArc.arcId,
      chapterIds: this.currentStoryArc.chapters.map(c => c.chapterId),
      compilationOptions: {
        includeChapterMarkers: true,
        addIntroOutro: false,
        normalizeVolume: true,
        format: 'mp3'
      }
    };

    this.storyService.compileAudiobook(request).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.audiobookCompilationProgress = 100;
          this.audiobookCompilationSuccess = true;
          this.compiledAudiobooks.push(response.data.downloadUrl);
          
          this.errorLogging.logInfo('Audiobook compilation completed', 'App.compileAudiobook', {
            audiobookId: response.data.audiobookId,
            totalDuration: response.data.totalDuration
          });
          
          setTimeout(() => {
            this.audiobookCompilationSuccess = false;
            this.audiobookCompilationProgress = 0;
          }, 3000);
        }
        this.isCompilingAudiobook = false;
      },
      error: (error) => {
        this.errorLogging.logError(error, 'App.compileAudiobook', 'error');
        this.isCompilingAudiobook = false;
        this.audiobookCompilationProgress = 0;
      }
    });
  }

  canCompileAudiobook(): boolean {
    return this.currentStoryArc !== null && 
           this.currentStoryArc.chapters.length >= 2 && 
           !this.isCompilingAudiobook;
  }

  getChapterCount(): number {
    return this.currentStoryArc?.chapters.length || this.currentChapterCount;
  }

  getStoryArcInfo(): string {
    if (!this.currentStoryArc) return '';
    
    const chapters = this.currentStoryArc.chapters.length;
    const words = this.currentStoryArc.totalWordCount;
    const duration = Math.round(this.currentStoryArc.totalAudioDuration / 60);
    
    return `${chapters} chapters • ${words} words • ${duration}min audio`;
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
