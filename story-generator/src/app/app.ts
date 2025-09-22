import { Component, signal, OnInit, OnDestroy, ViewChild, Inject, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { ErrorDisplayComponent } from './error-display/error-display';
import { StoryGenerationSeam, ChapterContinuationSeam, AudioConversionSeam, SaveExportSeam } from './contracts';
import { DebugPanel } from './debug-panel/debug-panel';

/**
 * Fairytales with Spice - Main Application Component
 *
 * This is the core component that orchestrates the entire spicy fairy tale generation experience.
 * It implements a seam-driven architecture where each data boundary (UI->API, API->Services)
 * is explicitly defined through TypeScript contracts.
 *
 * Key Features:
 * - Multi-creature story generation (vampires, werewolves, fairies)
 * - Real-time generation progress with realistic status updates
 * - Multi-voice audio narration with character-specific voices
 * - Multiple export formats (PDF, EPUB, DOCX, etc.)
 * - Comprehensive error logging and debugging tools
 * - Responsive two-column layout for configuration and story display
 *
 * Architecture: Follows Seam-Driven Development methodology
 * - Each API interaction goes through defined seam contracts
 * - Mock services available for development without external APIs
 * - Error boundaries prevent integration failures
 *
 * @author Fairytales with Spice Development Team
 * @version 2.1.0
 * @since 2025-09-21
 */
@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule, ErrorDisplayComponent, DebugPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  /** Application title signal for reactive updates */
  protected readonly title = signal('story-generator');

  /** Browser detection for platform-specific features (SSR compatibility) */
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Reference to debug panel for programmatic control */
  @ViewChild(DebugPanel) debugPanel!: DebugPanel;

  // ==================== DEPENDENCY INJECTION ====================

  /**
   * Constructor injects core services using Angular's DI system
   * @param storyService - Handles all API communication for story operations
   * @param errorLogging - Centralized error tracking and logging service
   */
  constructor(
    private storyService: StoryService,
    private errorLogging: ErrorLoggingService
  ) {}

  // ==================== FORM STATE MANAGEMENT ====================

  /** Selected creature type for story generation */
  selectedCreature: string = 'vampire';

  /** Set of selected themes (max 5 allowed) */
  selectedThemes: Set<string> = new Set();

  /** Optional user input for story customization */
  userInput: string = '';

  /** Spicy level (1-5) determining content intensity */
  spicyLevel: number = 3;

  /** Target word count for story generation */
  wordCount: number = 900;

  // ==================== UI STATE MANAGEMENT ====================

  /** Loading states for different operations */
  isGenerating: boolean = false;
  isConvertingAudio: boolean = false;
  isSaving: boolean = false;
  isGeneratingNext: boolean = false;
  isContinuing: boolean = false;
  isExporting: boolean = false;

  /** Error states for user feedback */
  generationError: string = '';
  audioError: string = '';
  exportError: string = '';

  // ==================== STORY DATA MANAGEMENT ====================

  /** Generated story content (HTML formatted for display) */
  currentStory: string = '';

  /** Raw story content with speaker tags for multi-voice audio processing */
  currentStoryRaw: string = '';

  /** Unique identifier for the current story */
  currentStoryId: string = '';

  /** Generated story title */
  currentStoryTitle: string = '';

  /** Number of chapters in current story */
  currentChapterCount: number = 0;

  /** Themes used in current story generation */
  currentStoryThemes: string[] = [];

  /** Spicy level of current story */
  currentStorySpicyLevel: number = 3;

  // ==================== AUDIO DATA MANAGEMENT ====================

  /** URL of generated audio file for playback */
  currentAudioUrl: string = '';

  /** Duration of audio file in seconds */
  currentAudioDuration: number = 0;

  /** Success flags for user feedback */
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
    this.generationError = ''; // Clear previous errors
    this.currentStory = '';
    this.saveSuccess = false;
    this.audioSuccess = false;

    // Clear audio data when generating new story
    this.currentAudioUrl = '';
    this.currentAudioDuration = 0;

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
          this.currentStoryRaw = response.data.rawContent || response.data.content; // Fallback to regular content
          this.currentStoryId = response.data.storyId;
          this.currentStoryTitle = response.data.title;
          this.currentChapterCount = 1;
          this.currentStoryThemes = response.data.themes;
          this.currentStorySpicyLevel = response.data.spicyLevel;

          this.isGenerating = false;
          this.generationError = ''; // Clear any previous errors
          this.errorLogging.logInfo('Story generation completed successfully', 'App.generateStory', {
            storyId: response.data.storyId,
            wordCount: response.data.actualWordCount
          });
        } else {
          // Handle successful response but no data
          this.isGenerating = false;
          this.generationError = response.error?.message || 'Story generation failed. Please try again.';
          this.errorLogging.logError(
            new Error('Empty response data'),
            'App.generateStory',
            'error',
            { response }
          );
        }
      },
      error: (error) => {
        console.error('Story generation error:', error);

        this.errorLogging.logError(error, 'App.generateStory', 'error', {
          request,
          userAction: 'story_generation'
        });

        this.isGenerating = false;

        // Provide user-friendly error messages
        if (error.error?.code === 'GENERATION_FAILED') {
          this.generationError = 'Our AI storyteller is having trouble. Please try again in a moment.';
        } else if (error.error?.code === 'INVALID_INPUT') {
          this.generationError = 'Please check your story settings and try again.';
        } else if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
          this.generationError = 'Story generation is taking longer than expected. Please try again.';
        } else if (error.status === 0) {
          this.generationError = 'Unable to connect to our story service. Please check your internet connection.';
        } else {
          this.generationError = 'Something went wrong. Please try again or contact support if this continues.';
        }

        // Auto-clear error after 10 seconds
        setTimeout(() => {
          this.generationError = '';
        }, 10000);
      }
    });
  }

  generateNextChapter() {
    this.isContinuing = true;

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
    this.audioError = ''; // Clear previous errors
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

          // Store audio data
          this.currentAudioUrl = response.data.audioUrl;
          this.currentAudioDuration = response.data.duration;

          this.errorLogging.logInfo('Audio conversion completed successfully', 'App.convertToAudio', {
            audioId: response.data.audioId,
            duration: response.data.duration,
            fileSize: response.data.fileSize
          });
          setTimeout(() => this.audioSuccess = false, 3000);
        }
      },
      error: (error) => {
        console.error('Audio conversion error:', error);

        this.errorLogging.logError(error, 'App.convertToAudio', 'error', {
          request,
          userAction: 'audio_conversion'
        });

        this.isConvertingAudio = false;

        // User-friendly audio error messages
        if (error.error?.code === 'AUDIO_GENERATION_FAILED') {
          this.audioError = 'Audio conversion failed. Please try again.';
        } else if (error.error?.code === 'STORY_TOO_LONG') {
          this.audioError = 'Your story is too long for audio conversion. Try a shorter story.';
        } else if (error.status === 0) {
          this.audioError = 'Unable to connect to audio service. Please check your connection.';
        } else {
          this.audioError = 'Audio conversion failed. Please try again later.';
        }

        // Auto-clear error after 8 seconds
        setTimeout(() => {
          this.audioError = '';
        }, 8000);
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

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
