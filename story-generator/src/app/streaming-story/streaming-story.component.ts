/**
 * Streaming Story Component Example
 * Demonstrates how to use the streaming story API for real-time generation
 */

import { Component, OnDestroy, SecurityContext, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

import { StoryService } from '../story.service';
import {
  ApiEnvelope,
  GeneratedChapter,
  StoryGenerationSeam,
  StoryIterationPayload,
  StreamingProgressChunk,
  ThemeSeed,
  WordBudget
} from '../contracts';

@Component({
  selector: 'app-streaming-story',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="streaming-story-container">
      <div class="story-controls">
        <button 
          (click)="startStreaming()" 
          [disabled]="isStreaming"
          class="stream-button">
          {{ isStreaming ? 'Generating...' : 'Generate Story' }}
        </button>
        
        <button 
          (click)="stopStreaming()" 
          [disabled]="!isStreaming"
          class="stop-button">
          Stop Generation
        </button>
      </div>

      <!-- Progress indicator -->
      <div class="progress-container" *ngIf="isStreaming || progress.wordsGenerated > 0">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            [style.width.%]="progressPercentage">
          </div>
        </div>
        
        <div class="progress-stats">
          <span>{{ progress.wordsGenerated }} / {{ targetWords }} words</span>
          <span *ngIf="progress.generationSpeed > 0">
            {{ progress.generationSpeed | number:'1.1-1' }} words/sec
          </span>
          <span *ngIf="progress.estimatedWordsRemaining > 0">
            ~{{ estimatedTimeRemaining }}s remaining
          </span>
        </div>
      </div>

      <!-- Streaming story content -->
      <div class="story-content" *ngIf="streamedContent">
        <h2 class="story-title">{{ storyTitle }}</h2>
        <div 
          class="story-text"
          [innerHTML]="safeStreamedContent">
        </div>
        
        <!-- Typing indicator -->
        <span 
          class="typing-indicator" 
          *ngIf="isStreaming">
          ▋
        </span>
      </div>

      <!-- Error display -->
      <div class="error-message" *ngIf="errorMessage">
        <h3>⚠️ Generation Error</h3>
        <p>{{ errorMessage }}</p>
        <button (click)="clearError()">Try Again</button>
      </div>
    </div>
  `,
  styles: [`
    .streaming-story-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .story-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .stream-button, .stop-button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .stream-button {
      background: linear-gradient(135deg, #8B5CF6, #EC4899);
      color: white;
    }

    .stream-button:disabled {
      background: #6B7280;
      cursor: not-allowed;
    }

    .stop-button {
      background: #EF4444;
      color: white;
    }

    .progress-container {
      margin-bottom: 20px;
      padding: 15px;
      background: #F9FAFB;
      border-radius: 8px;
      border: 1px solid #E5E7EB;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #E5E7EB;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8B5CF6, #EC4899);
      transition: width 0.3s ease;
    }

    .progress-stats {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: #6B7280;
    }

    .story-content {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid #E5E7EB;
    }

    .story-title {
      color: #8B5CF6;
      margin-bottom: 20px;
      font-size: 24px;
      font-weight: bold;
    }

    .story-text {
      line-height: 1.8;
      font-size: 16px;
      color: #374151;
    }

    .typing-indicator {
      color: #8B5CF6;
      font-weight: bold;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    .error-message {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #DC2626;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }

    .error-message button {
      background: #DC2626;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
  `]
})
export class StreamingStoryComponent implements OnDestroy {
  private storyService = inject(StoryService);
  private readonly sanitizer = inject(DomSanitizer);
  private streamSubscription?: Subscription;

  // Created: 2025-10-29 08:27 UTC
  private readonly streamingBlueprint: StoryGenerationSeam['input'] = {
    creature: 'vampire',
    themes: [
      { id: 'forbidden_love', label: 'Forbidden Love', description: 'Star-crossed tension under moonlight.' },
      { id: 'ancient_curses', label: 'Ancient Curses', description: 'Legacy magic complicates every choice.' }
    ] as ThemeSeed[],
    logline: 'A vampire lord defies ancient vows for a mortal bond.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    narrativeDirectives: 'Keep the prose brooding with lush sensory details.'
  };

  // Streaming state
  isStreaming = false;
  streamedContent = '';
  safeStreamedContent: SafeHtml = this.sanitizer.bypassSecurityTrustHtml('');
  storyTitle = '';
  errorMessage = '';
  
  // Progress tracking
  progress = {
    wordsGenerated: 0,
    estimatedWordsRemaining: 0,
    generationSpeed: 0
  };
  
  targetWords = this.streamingBlueprint.desiredWordBudget;

  get progressPercentage(): number {
    const target = Number(this.targetWords);
    if (!target) {
      return 0;
    }
    return Math.min((this.progress.wordsGenerated / target) * 100, 100);
  }

  get estimatedTimeRemaining(): number {
    if (this.progress.generationSpeed === 0 || this.progress.estimatedWordsRemaining === 0) {
      return 0;
    }
    return Math.ceil(this.progress.estimatedWordsRemaining / this.progress.generationSpeed);
  }

  async startStreaming(): Promise<void> {
    if (this.isStreaming) return;

    // Clear previous content
    this.streamSubscription?.unsubscribe();
    this.streamedContent = '';
    this.updateSafeStreamContent('');
    this.errorMessage = '';
    this.storyTitle = 'Generating your story...';
    this.isStreaming = true;

    // Example story generation input
    const input: StoryGenerationSeam['input'] = {
      ...this.streamingBlueprint,
      desiredWordBudget: this.targetWords as WordBudget
    };

    try {
      // Use the StoryService streaming method
      this.streamSubscription = this.storyService.streamStoryGeneration(
        input,
        (progressUpdate) => {
          // Handle real-time progress updates
          this.handleStreamChunk(progressUpdate);
        }
      ).subscribe({
        next: (finalStory) => {
          // Story generation complete
          this.handleStreamComplete(finalStory);
        },
        error: (error) => {
          // Handle errors
          this.handleStreamError({
            code: 'GENERATION_FAILED',
            message: error.message || 'Failed to generate story'
          });
        }
      });

    } catch (error: any) {
      this.handleStreamError({
        code: 'STREAMING_START_FAILED',
        message: error.message
      });
    }
  }

  stopStreaming(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
    this.isStreaming = false;
  }

  clearError(): void {
    this.errorMessage = '';
    this.streamedContent = '';
    this.updateSafeStreamContent('');
    this.progress = {
      wordsGenerated: 0,
      estimatedWordsRemaining: 0,
      generationSpeed: 0
    };
  }

  private handleStreamChunk(chunk: StreamingProgressChunk): void {
    if (chunk.type === 'error' && chunk.error) {
      this.handleStreamError(chunk.error);
      return;
    }

    if (chunk.partialHtml) {
      this.streamedContent = chunk.partialHtml;
      this.updateSafeStreamContent(this.streamedContent);
    }

    if (typeof chunk.percentage === 'number') {
      this.progress.wordsGenerated = Math.round((chunk.percentage / 100) * this.targetWords);
      this.progress.estimatedWordsRemaining = Math.max(this.targetWords - this.progress.wordsGenerated, 0);
      this.progress.generationSpeed = Math.max(Math.floor(this.progress.wordsGenerated / 20), 1);
    }

    if (chunk.type === 'chapter_progress' && chunk.chapterNumber && this.storyTitle.startsWith('Generating')) {
      this.storyTitle = `Streaming Chapter ${chunk.chapterNumber}`;
    }
  }

  private handleStreamComplete(finalStory?: ApiEnvelope<StoryIterationPayload>): void {
    this.isStreaming = false;
    this.streamSubscription = undefined;

    console.log('✅ Story generation complete!');

    if (finalStory?.data?.summary) {
      this.storyTitle = finalStory.data.summary.title;
      const combined = finalStory.data.batch.chapters
        .map((chapter: GeneratedChapter) => `<h3>${chapter.title}</h3>${chapter.htmlContent}`)
        .join('');
      this.streamedContent = combined;
      this.updateSafeStreamContent(combined);
    }

    // Add a small celebration effect
    setTimeout(() => {
      this.storyTitle += ' ✨';
    }, 500);
  }

  private handleStreamError(error: any): void {
    this.isStreaming = false;
    this.errorMessage = error.message || 'An unexpected error occurred during generation';
    this.streamSubscription = undefined;
  }

  private updateSafeStreamContent(html: string): void {
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    this.safeStreamedContent = this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }

  ngOnDestroy(): void {
    this.streamSubscription?.unsubscribe();
    this.streamSubscription = undefined;
  }
}
