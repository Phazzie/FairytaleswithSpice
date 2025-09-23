/**
 * Streaming Story Component Example
 * Demonstrates how to use the streaming story API for real-time generation
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoryService } from '../story.service';
import { StoryGenerationSeam, CreatureType, ThemeType, WordCount } from '../contracts';

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
          [innerHTML]="streamedContent">
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
export class StreamingStoryComponent {
  private storyService = inject(StoryService);
  
  // Streaming state
  isStreaming = false;
  streamedContent = '';
  storyTitle = '';
  errorMessage = '';
  
  // Progress tracking
  progress = {
    wordsGenerated: 0,
    estimatedWordsRemaining: 0,
    generationSpeed: 0
  };
  
  targetWords = 900; // Default word count
  private eventSource: EventSource | null = null;

  get progressPercentage(): number {
    if (this.targetWords === 0) return 0;
    return Math.min((this.progress.wordsGenerated / this.targetWords) * 100, 100);
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
    this.streamedContent = '';
    this.errorMessage = '';
    this.storyTitle = 'Generating your story...';
    this.isStreaming = true;

    // Example story generation input
    const input: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['forbidden_love', 'seduction'],
      userInput: 'A vampire lord meets a curious human in a moonlit garden',
      spicyLevel: 3,
      wordCount: this.targetWords as WordCount
    };

    try {
      // Connect to streaming endpoint
      this.eventSource = new EventSource(`/api/story/stream`, {
        // Note: POST data would need to be sent differently for SSE
        // This is a simplified example - in reality, you might:
        // 1. Use a WebSocket connection instead
        // 2. Send the input via a separate POST then connect to stream
        // 3. Use a unique session ID to track the generation
      });

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              console.log('🔗 Connected to story stream');
              break;
              
            case 'chunk':
              this.handleStreamChunk(data);
              break;
              
            case 'complete':
              this.handleStreamComplete();
              break;
              
            case 'error':
              this.handleStreamError(data.error);
              break;
          }
        } catch (error) {
          console.error('Error parsing stream data:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        this.handleStreamError({ 
          code: 'CONNECTION_ERROR', 
          message: 'Lost connection to story stream' 
        });
      };

    } catch (error: any) {
      this.handleStreamError({ 
        code: 'STREAMING_START_FAILED', 
        message: error.message 
      });
    }
  }

  stopStreaming(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isStreaming = false;
  }

  clearError(): void {
    this.errorMessage = '';
    this.streamedContent = '';
    this.progress = {
      wordsGenerated: 0,
      estimatedWordsRemaining: 0,
      generationSpeed: 0
    };
  }

  private handleStreamChunk(data: any): void {
    // Update content progressively
    this.streamedContent = this.formatStreamContent(data.content);
    
    // Update progress metrics
    this.progress = {
      wordsGenerated: data.metadata?.wordsGenerated || 0,
      estimatedWordsRemaining: data.metadata?.estimatedWordsRemaining || 0,
      generationSpeed: data.metadata?.generationSpeed || 0
    };

    // Extract title if it appears in the content
    if (!this.storyTitle.includes('Generating') && data.content.includes('<h3>')) {
      const titleMatch = data.content.match(/<h3>(.*?)<\/h3>/);
      if (titleMatch) {
        this.storyTitle = titleMatch[1];
      }
    }
  }

  private handleStreamComplete(): void {
    this.isStreaming = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    console.log('✅ Story generation complete!');
    
    // Add a small celebration effect
    setTimeout(() => {
      this.storyTitle += ' ✨';
    }, 500);
  }

  private handleStreamError(error: any): void {
    this.isStreaming = false;
    this.errorMessage = error.message || 'An unexpected error occurred during generation';
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private formatStreamContent(content: string): string {
    // Basic HTML formatting for story content
    // In production, you'd want more sophisticated formatting
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '');
  }
}