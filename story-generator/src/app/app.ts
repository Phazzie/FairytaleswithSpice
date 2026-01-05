import { Component, signal, WritableSignal, OnInit, OnDestroy, ViewChild, Inject, PLATFORM_ID, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { ErrorDisplayComponent } from './error-display/error-display';
import {
  StoryGenerationSeam,
  ChapterBatchSeam,
  AudioConversionSeam,
  SaveExportSeam,
  Chapter,
  StoryStateSummary,
  BatchProgressState
} from './contracts';
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
   * @param cdr - Change detection reference for manual change detection triggers
   */
  constructor(
    private storyService: StoryService,
    private errorLogging: ErrorLoggingService,
    private cdr: ChangeDetectorRef
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
  isExporting: boolean = false;

  /** Error states for user feedback */
  generationError: string = '';
  audioError: string = '';
  exportError: string = '';

  // ==================== STORY DATA MANAGEMENT ====================

  /** Array of chapters for serialized navigation */
  chapters: Chapter[] = [];

  /** Currently selected chapter index for viewing */
  currentChapterIndex: number = 0;

  /** Generated story content (HTML formatted for display) - computed from current chapter */
  get currentStory(): string {
    return this.chapters.length > 0 ? this.chapters[this.currentChapterIndex].content : '';
  }

  /** Set current story (for backward compatibility) */
  set currentStory(value: string) {
    if (this.chapters.length > 0) {
      this.chapters[this.currentChapterIndex].content = value;
    }
  }

  /** Raw story content with speaker tags - computed from current chapter */
  get currentStoryRaw(): string {
    return this.chapters.length > 0 ? (this.chapters[this.currentChapterIndex].rawContent || '') : '';
  }

  /** Unique identifier for the current story */
  currentStoryId: string = '';

  /** Generated story title */
  currentStoryTitle: string = '';

  /** Number of chapters in current story */
  get currentChapterCount(): number {
    return this.chapters.length;
  }

  /** Themes used in current story generation */
  currentStoryThemes: string[] = [];

  /** Spicy level of current story */
  currentStorySpicyLevel: number = 3;

  /** Preferred number of chapters to request per batch */
  readonly chaptersPerBatch: WritableSignal<1 | 2 | 3> = signal<1 | 2 | 3>(1);

  /** Story continuity summary provided by backend */
  readonly storyContinuity: WritableSignal<StoryStateSummary> = signal(this.createEmptyStoryState());

  /** Queue of batch progress entries for visibility */
  readonly batchProgressQueue: WritableSignal<BatchProgressState[]> = signal([]);

  /** Collapsed state for chapter groups */
  private readonly collapsedGroupIds: WritableSignal<Set<number>> = signal(new Set<number>());

  /** Track active batch generation requests */
  isBatchGenerating: boolean = false;

  /** Error state specific to batch requests */
  batchGenerationError: string = '';

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

  batchSizeOptions: Array<{ value: 1 | 2 | 3; label: string; helper: string }> = [
    { value: 1, label: 'Solo Chapter', helper: 'Great for precise pacing or cliffhanger follow-ups.' },
    { value: 2, label: 'Double Feature', helper: 'Balances pacing and speed for most story arcs.' },
    { value: 3, label: 'Trilogy Burst', helper: 'Accelerates long-form runs—best after continuity review.' }
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

    // Manually trigger change detection to ensure UI updates
    this.cdr.detectChanges();
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

  // ==================== BATCH & CONTINUITY HELPERS ====================

  setChaptersPerBatch(size: 1 | 2 | 3): void {
    if (this.chaptersPerBatch() !== size) {
      this.chaptersPerBatch.set(size);
    }
  }

  get selectedBatchSize(): 1 | 2 | 3 {
    return this.chaptersPerBatch();
  }

  get activeBatchQueue(): BatchProgressState[] {
    return this.batchProgressQueue();
  }

  get continuitySummary(): StoryStateSummary {
    return this.storyContinuity();
  }

  get hasContinuityData(): boolean {
    const state = this.storyContinuity();
    return !!state.synopsis || state.characters.length > 0 || state.plotDevices.length > 0 || state.cliffhangers.length > 0;
  }

  private createEmptyStoryState(): StoryStateSummary {
    const timestamp = new Date().toISOString();
    return {
      synopsis: '',
      lastGeneratedChapter: 0,
      characters: [],
      plotDevices: [],
      cliffhangers: [],
      unresolvedThreads: [],
      nextBatchFocus: [],
      updatedAt: timestamp
    };
  }

  private resetBatchState(): void {
    this.batchProgressQueue.set([]);
    this.collapsedGroupIds.set(new Set<number>());
    this.batchGenerationError = '';
    this.isBatchGenerating = false;
  }

  private updateStoryContinuity(state?: StoryStateSummary | null): void {
    if (!state) {
      this.storyContinuity.set(this.createEmptyStoryState());
      return;
    }

    this.storyContinuity.set({
      synopsis: state.synopsis || '',
      lastGeneratedChapter: state.lastGeneratedChapter ?? this.chapters.length,
      characters: state.characters || [],
      plotDevices: state.plotDevices || [],
      cliffhangers: state.cliffhangers || [],
      unresolvedThreads: state.unresolvedThreads || [],
      nextBatchFocus: state.nextBatchFocus || [],
      updatedAt: state.updatedAt || new Date().toISOString()
    });
  }

  private updateBatchQueue(queue?: BatchProgressState[] | null): void {
    if (!queue) {
      this.batchProgressQueue.set([]);
      return;
    }

    const normalized = queue.map((entry) => ({
      ...entry,
      chaptersGenerated: entry.chaptersGenerated ?? 0,
      totalChapters: entry.totalChapters ?? entry.batchSize,
      status: entry.status,
      errorMessage: entry.errorMessage
    }));

    this.batchProgressQueue.set(normalized);
  }

  private patchBatchQueueEntry(update: BatchProgressState): void {
    const current = [...this.batchProgressQueue()];
    const index = current.findIndex((entry) => entry.id === update.id);
    if (index >= 0) {
      current[index] = { ...current[index], ...update };
    } else {
      current.push(update);
    }
    this.batchProgressQueue.set(current);
  }

  get chapterGroups(): Array<{ label: string; startIndex: number; chapters: Chapter[] }> {
    if (!this.chapters.length) {
      return [];
    }

    const groupSize = this.getChapterGroupSize();
    const groups: Array<{ label: string; startIndex: number; chapters: Chapter[] }> = [];

    for (let index = 0; index < this.chapters.length; index += groupSize) {
      const chunk = this.chapters.slice(index, index + groupSize);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const label = chunk.length === 1
        ? `Chapter ${first.chapterNumber}`
        : `Chapters ${first.chapterNumber}–${last.chapterNumber}`;

      groups.push({
        label,
        startIndex: index,
        chapters: chunk
      });
    }

    return groups;
  }

  private getChapterGroupSize(): number {
    if (this.chapters.length >= 50) {
      return 10;
    }
    if (this.chapters.length >= 20) {
      return 5;
    }
    return 3;
  }

  toggleChapterGroup(groupIndex: number): void {
    const updated = new Set(this.collapsedGroupIds());
    if (updated.has(groupIndex)) {
      updated.delete(groupIndex);
    } else {
      updated.add(groupIndex);
    }
    this.collapsedGroupIds.set(updated);
  }

  isChapterGroupCollapsed(groupIndex: number): boolean {
    return this.collapsedGroupIds().has(groupIndex);
  }

  get hasLongChapterList(): boolean {
    return this.chapters.length >= 12;
  }

  isChapterInOpenCliffhanger(chapterNumber: number): boolean {
    return this.storyContinuity().cliffhangers.some(
      (cliffhanger) => cliffhanger.chapterNumber === chapterNumber && cliffhanger.status !== 'resolved'
    );
  }

  private buildBatchRequest(batchSize: 1 | 2 | 3): ChapterBatchSeam['input'] {
    return {
      storyId: this.currentStoryId,
      currentChapterCount: this.chapters.length,
      batchSize,
      existingChapterSummaries: this.chapters.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        cliffhangerSummary: this.storyContinuity()
          .cliffhangers.find((item) => item.chapterNumber === chapter.chapterNumber)?.description
      })),
      continuity: {
        synopsis: this.storyContinuity().synopsis,
        lastGeneratedChapter: this.storyContinuity().lastGeneratedChapter,
        characters: this.storyContinuity().characters,
        plotDevices: this.storyContinuity().plotDevices,
        cliffhangers: this.storyContinuity().cliffhangers,
        unresolvedThreads: this.storyContinuity().unresolvedThreads,
        nextBatchFocus: this.storyContinuity().nextBatchFocus,
        updatedAt: this.storyContinuity().updatedAt
      }
    };
  }

  clearCompletedBatches(): void {
    const filtered = this.activeBatchQueue.filter((entry) => entry.status !== 'completed' && entry.status !== 'failed');
    this.batchProgressQueue.set(filtered);
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
    this.resetBatchState();

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
          // Create first chapter from generated story
          const firstChapter: Chapter = {
            chapterId: `chapter_1_${Date.now()}`,
            chapterNumber: 1,
            title: response.data.title,
            content: response.data.content,
            rawContent: response.data.rawContent || response.data.content,
            wordCount: response.data.actualWordCount,
            generatedAt: new Date(),
            hasAudio: false
          };

          // Initialize chapters array with first chapter
          this.chapters = [firstChapter];
          this.currentChapterIndex = 0;

          // Store story metadata
          this.currentStoryId = response.data.storyId;
          this.currentStoryTitle = response.data.title;
          this.currentStoryThemes = response.data.themes;
          this.currentStorySpicyLevel = response.data.spicyLevel;
          this.updateStoryContinuity(response.metadata?.storyState || (response as any).data?.storyState);
          this.updateBatchQueue(response.metadata?.batchQueue || []);

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

  /**
   * Quick test method to verify API connectivity with a minimal 150-word story
   * This bypasses the form and generates a simple vampire romance story
   */
  quickTest() {
    this.isGenerating = true;
    this.generationError = '';
    this.currentStory = '';
    this.saveSuccess = false;
    this.audioSuccess = false;
    this.currentAudioUrl = '';
    this.currentAudioDuration = 0;
    this.resetBatchState();

    this.errorLogging.logInfo('Quick test initiated', 'App.quickTest');

    // Minimal test request: vampire, romance, spicy level 2, 150 words (using 700 as closest)
    const testRequest: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['forbidden_love'],
      userInput: 'A brief encounter in a moonlit garden. Keep it under 200 words.',
      spicyLevel: 2,
      wordCount: 700 // API will be instructed to keep it short via userInput
    };

    this.storyService.generateStory(testRequest).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Create quick test chapter
          const testChapter: Chapter = {
            chapterId: `chapter_test_${Date.now()}`,
            chapterNumber: 1,
            title: response.data.title,
            content: response.data.content,
            rawContent: response.data.rawContent || response.data.content,
            wordCount: response.data.actualWordCount,
            generatedAt: new Date(),
            hasAudio: false
          };

          // Initialize with test chapter
          this.chapters = [testChapter];
          this.currentChapterIndex = 0;
          this.currentStoryId = response.data.storyId;
          this.currentStoryTitle = response.data.title;
          this.currentStoryThemes = response.data.themes;
          this.currentStorySpicyLevel = response.data.spicyLevel;
          this.updateStoryContinuity(response.metadata?.storyState || (response as any).data?.storyState);
          this.updateBatchQueue(response.metadata?.batchQueue || []);

          this.isGenerating = false;
          this.generationError = '';
          this.errorLogging.logInfo('Quick test completed successfully', 'App.quickTest', {
            storyId: response.data.storyId,
            wordCount: response.data.actualWordCount
          });
        } else {
          this.isGenerating = false;
          this.generationError = `Test failed: ${response.error?.message || 'Unknown error'}`;
          this.errorLogging.logError(
            new Error('Quick test failed'),
            'App.quickTest',
            'error',
            { response }
          );
        }
      },
      error: (error) => {
        console.error('Quick test error:', error);
        this.errorLogging.logError(error, 'App.quickTest', 'error');
        this.isGenerating = false;
        this.generationError = `API Test Failed: ${error.error?.message || error.message || 'Check API keys in Digital Ocean settings'}`;

        // Auto-clear error after 15 seconds
        setTimeout(() => {
          this.generationError = '';
        }, 15000);
      }
    });
  }

  generateChapterBatch(batchSize?: 1 | 2 | 3) {
    if (!this.currentStoryId) {
      this.batchGenerationError = 'Generate a base story before requesting additional chapters.';
      return;
    }

    const normalizedSize = (batchSize ?? this.selectedBatchSize) as 1 | 2 | 3;
    const batchId = `batch_${Date.now()}`;
    const submittedAt = new Date().toISOString();

    const queuedEntry: BatchProgressState = {
      id: batchId,
      batchSize: normalizedSize,
      status: 'queued',
      chaptersGenerated: 0,
      totalChapters: normalizedSize,
      submittedAt
    };

    this.patchBatchQueueEntry(queuedEntry);
    this.patchBatchQueueEntry({ ...queuedEntry, status: 'in_progress' });
    this.isBatchGenerating = true;
    this.isGeneratingNext = true;
    this.batchGenerationError = '';

    const request = this.buildBatchRequest(normalizedSize);

    this.errorLogging.logInfo('User queued batch chapter generation', 'App.generateChapterBatch', {
      storyId: request.storyId,
      batchSize: normalizedSize,
      currentChapterCount: request.currentChapterCount
    });

    this.storyService.generateChapterBatch(request).subscribe({
      next: (response) => {
        this.isBatchGenerating = false;
        this.isGeneratingNext = false;
        if (response.success && response.data) {
          const newChapters = (response.data.chapters || []).map((chapter, index) => ({
            ...chapter,
            chapterNumber: chapter.chapterNumber || this.chapters.length + index + 1,
            generatedAt: chapter.generatedAt ? new Date(chapter.generatedAt) : new Date(),
            hasAudio: chapter.hasAudio ?? false
          }));

          if (newChapters.length) {
            this.chapters = [...this.chapters, ...newChapters];
            this.navigateToChapter(this.chapters.length - newChapters.length);
          }

          this.updateStoryContinuity(response.data.storyState || response.metadata?.storyState);
          this.updateBatchQueue(response.data.queue || response.metadata?.batchQueue || this.activeBatchQueue);
          this.batchGenerationError = '';

          this.patchBatchQueueEntry({
            ...queuedEntry,
            status: 'completed',
            chaptersGenerated: newChapters.length,
            completedAt: new Date().toISOString()
          });

          this.errorLogging.logInfo('Batch generation completed successfully', 'App.generateChapterBatch', {
            storyId: request.storyId,
            batchSize: normalizedSize,
            generatedChapters: newChapters.length
          });
        } else {
          this.batchGenerationError = response.error?.message || 'Batch generation failed. Please try again.';
          this.patchBatchQueueEntry({ ...queuedEntry, status: 'failed', errorMessage: this.batchGenerationError });
        }
      },
      error: (error) => {
        this.isBatchGenerating = false;
        this.isGeneratingNext = false;
        const message = error.error?.message || error.message || 'Unable to generate chapter batch.';
        this.batchGenerationError = message;

        this.patchBatchQueueEntry({ ...queuedEntry, status: 'failed', errorMessage: message });
        this.errorLogging.logError(error, 'App.generateChapterBatch', 'error', {
          request,
          userAction: 'batch_generation'
        });

        // Auto-clear error after 10 seconds for repeated attempts
        setTimeout(() => {
          if (this.batchGenerationError === message) {
            this.batchGenerationError = '';
          }
        }, 10000);
      }
    });
  }

  generateNextChapter() {
    this.generateChapterBatch(1);
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

  // ==================== CHAPTER NAVIGATION METHODS ====================

  navigateToChapter(index: number): void {
    if (index >= 0 && index < this.chapters.length) {
      this.currentChapterIndex = index;
      this.errorLogging.logInfo('User navigated to chapter', 'App.navigateToChapter', {
        chapterIndex: index,
        chapterNumber: this.chapters[index].chapterNumber
      });
    }
  }

  previousChapter(): void {
    if (this.currentChapterIndex > 0) {
      this.navigateToChapter(this.currentChapterIndex - 1);
    }
  }

  nextChapter(): void {
    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.navigateToChapter(this.currentChapterIndex + 1);
    }
  }

  isFirstChapter(): boolean {
    return this.currentChapterIndex === 0;
  }

  isLastChapter(): boolean {
    return this.currentChapterIndex === this.chapters.length - 1;
  }

  getCurrentChapter(): Chapter | null {
    return this.chapters.length > 0 ? this.chapters[this.currentChapterIndex] : null;
  }

  getTotalWordCount(): number {
    return this.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  }

  // ==================== ENHANCED AUDIO CONTROLS ====================

  onAudioLoaded(event: Event): void {
    const audio = event.target as HTMLAudioElement;
    this.currentAudioDuration = audio.duration;
    this.errorLogging.logInfo('Audio loaded successfully', 'App.onAudioLoaded', {
      duration: audio.duration,
      src: audio.src
    });
  }

  onAudioProgress(event: Event): void {
    // Enhanced audio progress tracking - ready for future features
    const audio = event.target as HTMLAudioElement;
    const progress = (audio.currentTime / audio.duration) * 100;
    // Could be extended with progress bar in future versions
  }

  onAudioEnded(): void {
    this.errorLogging.logInfo('Audio playback completed', 'App.onAudioEnded');
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
