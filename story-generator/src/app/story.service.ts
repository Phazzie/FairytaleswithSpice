import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, map, retry, retryWhen, mergeMap, take } from 'rxjs/operators';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse
} from './contracts';

// Seam-Driven Service Implementation
// Now connected to real backend APIs following exact seam contracts

@Injectable({
  providedIn: 'root'
})
export class StoryService {
  private apiUrl = '/api'; // Serverless API endpoint
  private maxRetries = 3; // Maximum number of retry attempts
  private retryDelay = 1000; // Base delay between retries (ms)

  constructor(private http: HttpClient) {}

  // ==================== STORY GENERATION ====================
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    const requestId = this.generateRequestId();
    console.log(`[${requestId}] Story generation request:`, input);
    
    return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
      `${this.apiUrl}/story/generate`,
      input
    ).pipe(
      retryWhen(errors => this.retryWithBackoff(errors, requestId)),
      map(response => {
        console.log(`[${requestId}] Story generation response:`, response);
        return response;
      }),
      catchError(error => this.handleError(error, requestId, 'generateStory'))
    );
  }

  // ==================== AUDIO CONVERSION ====================
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    const requestId = this.generateRequestId();
    console.log(`[${requestId}] Audio conversion request:`, input);
    
    return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
      `${this.apiUrl}/audio/convert`,
      input
    ).pipe(
      retryWhen(errors => this.retryWithBackoff(errors, requestId)),
      map(response => {
        console.log(`[${requestId}] Audio conversion response:`, response);
        return response;
      }),
      catchError(error => this.handleError(error, requestId, 'convertToAudio'))
    );
  }

  // ==================== SAVE/EXPORT ====================
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    const requestId = this.generateRequestId();
    console.log(`[${requestId}] Save story request:`, input);
    
    return this.http.post<ApiResponse<SaveExportSeam['output']>>(
      `${this.apiUrl}/export/save`,
      input
    ).pipe(
      retryWhen(errors => this.retryWithBackoff(errors, requestId)),
      map(response => {
        console.log(`[${requestId}] Save story response:`, response);
        return response;
      }),
      catchError(error => this.handleError(error, requestId, 'saveStory'))
    );
  }

  // ==================== CHAPTER CONTINUATION ====================
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    const requestId = this.generateRequestId();
    console.log(`[${requestId}] Chapter continuation request:`, input);
    
    return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
      `${this.apiUrl}/story/continue`,
      input
    ).pipe(
      retryWhen(errors => this.retryWithBackoff(errors, requestId)),
      map(response => {
        console.log(`[${requestId}] Chapter continuation response:`, response);
        return response;
      }),
      catchError(error => this.handleError(error, requestId, 'generateNextChapter'))
    );
  }

  // ==================== ERROR HANDLING ====================
  private handleError(error: HttpErrorResponse, requestId?: string, operation?: string): Observable<never> {
    const logPrefix = requestId ? `[${requestId}]` : '';
    console.error(`${logPrefix} API Error in ${operation}:`, error);
    
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
    } else if (error.error && typeof error.error === 'object' && error.error.error) {
      // Backend returned an error response matching our contract
      errorResponse = error.error;
    } else {
      // HTTP error
      errorResponse.error = {
        code: 'HTTP_ERROR',
        message: `HTTP ${error.status}: ${error.message || 'Unknown error'}`
      };
    }

    // Add metadata for debugging
    if (requestId) {
      errorResponse.metadata = {
        requestId,
        processingTime: 0 // Error occurred, so no meaningful processing time
      };
    }

    return throwError(() => errorResponse);
  }

  // ==================== RETRY LOGIC ====================
  private retryWithBackoff(errors: Observable<any>, requestId: string): Observable<any> {
    return errors.pipe(
      mergeMap((error, index) => {
        const shouldRetry = this.shouldRetryError(error) && index < this.maxRetries;
        
        if (shouldRetry) {
          const delay = this.retryDelay * Math.pow(2, index); // Exponential backoff
          console.log(`[${requestId}] Retrying request in ${delay}ms (attempt ${index + 1}/${this.maxRetries})`);
          return timer(delay);
        } else {
          console.error(`[${requestId}] Max retries exceeded or non-retryable error:`, error);
          return throwError(() => error);
        }
      }),
      take(this.maxRetries)
    );
  }

  private shouldRetryError(error: HttpErrorResponse): boolean {
    // Retry on network errors and specific HTTP status codes
    if (error.error instanceof ErrorEvent) {
      return true; // Network error
    }
    
    const retryableStatuses = [0, 408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status);
  }

  // ==================== UTILITY METHODS ====================
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}