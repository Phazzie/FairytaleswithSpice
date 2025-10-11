import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse,
  StreamingProgressChunk
} from './contracts';
import { ErrorLoggingService } from './error-logging';

// Seam-Driven Service Implementation
// Now connected to real backend APIs following exact seam contracts

@Injectable({
  providedIn: 'root'
})
export class StoryService {
  private apiUrl = '/api'; // Serverless API endpoints

  constructor(
    private http: HttpClient,
    private errorLogging: ErrorLoggingService
  ) {}

  // ==================== STORY GENERATION ====================
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    this.errorLogging.logInfo('Starting story generation', 'StoryService.generateStory', { input });

    return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
      `${this.apiUrl}/story/generate`,
      input
    ).pipe(
      tap(response => {
        if (response.success) {
          this.errorLogging.logInfo('Story generation successful', 'StoryService.generateStory', { storyId: response.data?.storyId });
        }
      }),
      catchError(error => this.handleError(error, 'generateStory'))
    );
  }

  /**
   * Generate story with real-time streaming progress updates
   * Uses Server-Sent Events (SSE) to provide chunk-by-chunk progress
   * 
   * @param input - Story generation parameters (creature, themes, spicyLevel, wordCount)
   * @param onProgress - Callback for real-time chunk updates
   * @returns Observable that completes with final story data
   */
  generateStoryStreaming(
    input: StoryGenerationSeam['input'],
    onProgress?: (chunk: StreamingProgressChunk) => void
  ): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    return new Observable(observer => {
      // Build URL with query params for EventSource (GET only)
      const params = new URLSearchParams({
        creature: input.creature,
        themes: input.themes.join(','),
        spicyLevel: input.spicyLevel.toString(),
        wordCount: input.wordCount.toString(),
        userInput: input.userInput || ''
      });
      const url = `${this.apiUrl}/story/stream?${params.toString()}`;
      
      this.errorLogging.logInfo('Starting streaming story generation', 'StoryService.generateStoryStreaming', { input });
      
      // Create EventSource connection
      const eventSource = new EventSource(url);
      
      let accumulatedContent = '';
      let streamId = '';
      let finalStoryId = '';
      
      // Handle SSE events
      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              streamId = data.streamId;
              this.errorLogging.logInfo('Stream connected', 'StoryService.generateStoryStreaming', { streamId });
              
              if (onProgress) {
                onProgress({
                  type: 'connected',
                  streamId: data.streamId,
                  metadata: data.metadata
                });
              }
              break;
              
            case 'chunk':
              // Accumulate content progressively
              accumulatedContent = data.content || accumulatedContent;
              
              // Notify caller of progress
              if (onProgress) {
                onProgress({
                  type: 'chunk',
                  content: data.content,
                  storyId: data.storyId,
                  streamId: data.streamId,
                  metadata: data.metadata
                });
              }
              break;
              
            case 'complete':
              // Final story received
              finalStoryId = data.storyId || `story_${streamId}`;
              const finalContent = data.content || accumulatedContent;
              
              const finalStory: ApiResponse<StoryGenerationSeam['output']> = {
                success: true,
                data: {
                  storyId: finalStoryId,
                  title: this.extractTitle(finalContent),
                  content: finalContent,
                  rawContent: finalContent,
                  creature: input.creature,
                  themes: input.themes,
                  spicyLevel: input.spicyLevel,
                  actualWordCount: data.metadata?.wordsGenerated || 0,
                  estimatedReadTime: Math.ceil((data.metadata?.wordsGenerated || 0) / 200),
                  hasCliffhanger: this.detectCliffhanger(finalContent),
                  generatedAt: new Date()
                }
              };
              
              this.errorLogging.logInfo('Stream completed successfully', 'StoryService.generateStoryStreaming', { 
                storyId: finalStoryId,
                wordCount: data.metadata?.wordsGenerated 
              });
              
              if (onProgress) {
                onProgress({
                  type: 'complete',
                  content: finalContent,
                  storyId: finalStoryId,
                  streamId: data.streamId,
                  metadata: data.metadata
                });
              }
              
              observer.next(finalStory);
              observer.complete();
              eventSource.close();
              break;
              
            case 'error':
              const errorMessage = data.error?.message || data.message || 'Streaming generation failed';
              this.errorLogging.logError(errorMessage, 'StoryService.generateStoryStreaming', 'error', { 
                streamId,
                errorCode: data.error?.code 
              });
              
              if (onProgress) {
                onProgress({
                  type: 'error',
                  streamId: data.streamId,
                  error: {
                    code: data.error?.code || 'STREAMING_ERROR',
                    message: errorMessage
                  }
                });
              }
              
              observer.error(new Error(errorMessage));
              eventSource.close();
              break;
          }
          
        } catch (error: any) {
          this.errorLogging.logError(error, 'StoryService.generateStoryStreaming - Stream parsing error', 'error');
          observer.error(error);
          eventSource.close();
        }
      });
      
      // Handle connection errors
      eventSource.onerror = (error) => {
        this.errorLogging.logError(new Error('SSE connection failed'), 'StoryService.generateStoryStreaming', 'error');
        observer.error(new Error('Stream connection failed'));
        eventSource.close();
      };
      
      // Cleanup on unsubscribe
      return () => {
        this.errorLogging.logInfo('Stream unsubscribed, closing connection', 'StoryService.generateStoryStreaming', { streamId });
        eventSource.close();
      };
    });
  }

  // ==================== AUDIO CONVERSION ====================
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    this.errorLogging.logInfo('Starting audio conversion', 'StoryService.convertToAudio', { storyId: input.storyId });

    return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
      `${this.apiUrl}/audio/convert`,
      input
    ).pipe(
      tap(response => {
        if (response.success) {
          this.errorLogging.logInfo('Audio conversion successful', 'StoryService.convertToAudio', { audioId: response.data?.audioId });
        }
      }),
      catchError(error => this.handleError(error, 'convertToAudio'))
    );
  }

  // ==================== SAVE/EXPORT ====================
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    this.errorLogging.logInfo('Starting story save/export', 'StoryService.saveStory', { storyId: input.storyId, format: input.format });

    return this.http.post<ApiResponse<SaveExportSeam['output']>>(
      `${this.apiUrl}/export/save`,
      input
    ).pipe(
      tap(response => {
        if (response.success) {
          this.errorLogging.logInfo('Story save/export successful', 'StoryService.saveStory', { exportId: response.data?.exportId });
        }
      }),
      catchError(error => this.handleError(error, 'saveStory'))
    );
  }

  // ==================== CHAPTER CONTINUATION ====================
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    this.errorLogging.logInfo('Starting chapter continuation', 'StoryService.generateNextChapter', { storyId: input.storyId });

    return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
      `${this.apiUrl}/story/continue`,
      input
    ).pipe(
      tap(response => {
        if (response.success) {
          this.errorLogging.logInfo('Chapter continuation successful', 'StoryService.generateNextChapter', { chapterId: response.data?.chapterId });
        }
      }),
      catchError(error => this.handleError(error, 'generateNextChapter'))
    );
  }

  // ==================== ERROR HANDLING ====================
  private handleError = (error: HttpErrorResponse, context: string = 'StoryService'): Observable<never> => {
    let errorResponse: ApiResponse<any> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    };

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorResponse.error = {
        code: 'CLIENT_ERROR',
        message: error.error.message
      };
      this.errorLogging.logError(error, `${context} - Client Error`, 'error', {
        type: 'client_side',
        url: error.url
      });
    } else if (error.error && typeof error.error === 'object' && error.error.error) {
      // Backend returned an error response matching our contract
      errorResponse = error.error;
      this.errorLogging.logError(error, `${context} - Backend Error`, 'error', {
        type: 'backend_response',
        status: error.status,
        url: error.url,
        errorCode: error.error.error?.code
      });
    } else {
      // HTTP / transport issues or unexpected payload shape
      if (error.status === 404) {
        errorResponse.error = {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'API endpoint not found (404). Check that Express server is running and API routes are configured correctly.'
        };
      } else if (error.status === 0) {
        errorResponse.error = {
          code: 'NETWORK_ERROR',
          message: 'Network unreachable or CORS blocked. Check connectivity and response headers.'
        };
      } else {
        errorResponse.error = {
          code: 'HTTP_ERROR',
          message: `HTTP ${error.status}: ${error.message}`
        };
      }
      this.errorLogging.logError(error, `${context} - HTTP/Transport Error`, 'error', {
        type: 'http_error',
        status: error.status,
        statusText: error.statusText,
        url: error.url
      });
    }

    return throwError(() => errorResponse);
  };

  // ==================== HELPER METHODS ====================
  /**
   * Extract title from HTML content
   * Looks for the first <h3> tag in the generated story
   */
  private extractTitle(htmlContent: string): string {
    if (!htmlContent) return 'Untitled Story';
    
    const titleMatch = htmlContent.match(/<h3[^>]*>(.*?)<\/h3>/);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Story';
  }

  /**
   * Detect if story ends with a cliffhanger
   * Checks for common cliffhanger patterns in the last paragraph
   */
  private detectCliffhanger(content: string): boolean {
    if (!content) return false;
    
    const lastParagraph = content.split('</p>').slice(-2)[0] || '';
    const cliffhangerPatterns = [
      /to be continued/i,
      /what happens next/i,
      /little did .* know/i,
      /but .*\?$/,
      /\.\.\.$/
    ];
    return cliffhangerPatterns.some(pattern => pattern.test(lastParagraph));
  }
}
