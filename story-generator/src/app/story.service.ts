import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, map, retry, retryWhen, take, delayWhen, tap } from 'rxjs/operators';
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
  private apiUrl = '/api'; // Backend URL - works for both local dev and production
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // Base delay in milliseconds

  constructor(private http: HttpClient) {}

  // ==================== STORY GENERATION ====================
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    console.log('🚀 Story generation request:', input);
    const startTime = Date.now();

    return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
      `${this.apiUrl}/story/generate`,
      input
    ).pipe(
      tap(response => {
        const processingTime = Date.now() - startTime;
        console.log(`✅ Story generation success (${processingTime}ms):`, response);
      }),
      retryWhen(errors => this.createRetryStrategy(errors, 'Story generation')),
      catchError(error => this.handleError(error, 'Story generation'))
    );
  }

  // ==================== AUDIO CONVERSION ====================
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    console.log('🎵 Audio conversion request:', input);
    const startTime = Date.now();

    return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
      `${this.apiUrl}/audio/convert`,
      input
    ).pipe(
      tap(response => {
        const processingTime = Date.now() - startTime;
        console.log(`✅ Audio conversion success (${processingTime}ms):`, response);
      }),
      retryWhen(errors => this.createRetryStrategy(errors, 'Audio conversion')),
      catchError(error => this.handleError(error, 'Audio conversion'))
    );
  }

  // ==================== SAVE/EXPORT ====================
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    console.log('💾 Save story request:', input);
    const startTime = Date.now();

    return this.http.post<ApiResponse<SaveExportSeam['output']>>(
      `${this.apiUrl}/export/save`,
      input
    ).pipe(
      tap(response => {
        const processingTime = Date.now() - startTime;
        console.log(`✅ Save story success (${processingTime}ms):`, response);
      }),
      retryWhen(errors => this.createRetryStrategy(errors, 'Save story')),
      catchError(error => this.handleError(error, 'Save story'))
    );
  }

  // ==================== CHAPTER CONTINUATION ====================
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    console.log('📖 Chapter continuation request:', input);
    const startTime = Date.now();

    return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
      `${this.apiUrl}/story/continue`,
      input
    ).pipe(
      tap(response => {
        const processingTime = Date.now() - startTime;
        console.log(`✅ Chapter continuation success (${processingTime}ms):`, response);
      }),
      retryWhen(errors => this.createRetryStrategy(errors, 'Chapter continuation')),
      catchError(error => this.handleError(error, 'Chapter continuation'))
    );
  }

  // ==================== RETRY STRATEGY ====================
  private createRetryStrategy(errors: Observable<any>, operationName: string): Observable<any> {
    return errors.pipe(
      take(this.maxRetries),
      delayWhen((error, index) => {
        const delay = this.retryDelay * Math.pow(2, index); // Exponential backoff
        console.warn(`⚠️ ${operationName} failed (attempt ${index + 1}/${this.maxRetries}), retrying in ${delay}ms:`, error);
        return timer(delay);
      })
    );
  }

  // ==================== ERROR HANDLING ====================
  private handleError(error: HttpErrorResponse, operationName: string): Observable<never> {
    console.error(`❌ ${operationName} error:`, error);
    
    let errorResponse: ApiResponse<any> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    };

    if (error.error instanceof ErrorEvent) {
      // Client-side/network error
      console.error('🔗 Network error detected:', error.error.message);
      errorResponse.error = {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your internet connection and try again.'
      };
    } else if (error.status === 0) {
      // No response received (server unreachable)
      console.error('🚫 Server unreachable');
      errorResponse.error = {
        code: 'SERVER_UNREACHABLE', 
        message: 'Unable to reach the server. Please try again in a moment.'
      };
    } else if (error.error && typeof error.error === 'object' && error.error.error) {
      // Backend returned an error response matching our contract
      console.error('🔄 Backend error response:', error.error);
      errorResponse = error.error;
    } else {
      // HTTP error
      console.error(`📡 HTTP ${error.status} error:`, error.message);
      errorResponse.error = {
        code: 'HTTP_ERROR',
        message: this.getHttpErrorMessage(error.status)
      };
    }

    return throwError(() => errorResponse);
  }

  private getHttpErrorMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Bad request. Please check your input and try again.';
      case 401:
        return 'Authentication failed. Please refresh the page.';
      case 403:
        return 'Access denied. You may not have permission for this action.';
      case 404:
        return 'Service not found. Please try again later.';
      case 429:
        return 'Too many requests. Please wait a moment before trying again.';
      case 500:
        return 'Server error. Please try again in a few moments.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return `Unexpected error (${status}). Please try again.`;
    }
  }
}