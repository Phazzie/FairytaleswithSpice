import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse
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
          message: 'API endpoint not found (404). Possible deployment routing issue: ensure /api functions are deployed and vercel.json rewrites are correct.'
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
}