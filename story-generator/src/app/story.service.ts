import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
  private apiUrl = 'http://localhost:3001/api'; // Backend URL

  constructor(
    private http: HttpClient,
    private errorLogging: ErrorLoggingService
  ) {}

  // ==================== STORY GENERATION ====================
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    try {
      return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
        `${this.apiUrl}/generate-story`,
        input
      ).pipe(
        catchError((error) => this.handleError(error, 'Story Generation'))
      );
    } catch (error) {
      this.errorLogging.logError(error, 'Story Generation - Request Setup', 'error');
      return throwError(() => this.createErrorResponse(error));
    }
  }

  // ==================== AUDIO CONVERSION ====================
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    try {
      return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
        `${this.apiUrl}/convert-audio`,
        input
      ).pipe(
        catchError((error) => this.handleError(error, 'Audio Conversion'))
      );
    } catch (error) {
      this.errorLogging.logError(error, 'Audio Conversion - Request Setup', 'error');
      return throwError(() => this.createErrorResponse(error));
    }
  }

  // ==================== SAVE/EXPORT ====================
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    try {
      return this.http.post<ApiResponse<SaveExportSeam['output']>>(
        `${this.apiUrl}/save-story`,
        input
      ).pipe(
        catchError((error) => this.handleError(error, 'Story Save/Export'))
      );
    } catch (error) {
      this.errorLogging.logError(error, 'Story Save/Export - Request Setup', 'error');
      return throwError(() => this.createErrorResponse(error));
    }
  }

  // ==================== CHAPTER CONTINUATION ====================
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    try {
      return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
        `${this.apiUrl}/continue-story`,
        input
      ).pipe(
        catchError((error) => this.handleError(error, 'Chapter Continuation'))
      );
    } catch (error) {
      this.errorLogging.logError(error, 'Chapter Continuation - Request Setup', 'error');
      return throwError(() => this.createErrorResponse(error));
    }
  }

  // ==================== ERROR HANDLING ====================
  private handleError(error: HttpErrorResponse, context: string): Observable<never> {
    let errorResponse: ApiResponse<any> = this.createErrorResponse(error);

    // Log the error with context
    const severity = this.determineSeverity(error);
    this.errorLogging.logError(error, context, severity);

    return throwError(() => errorResponse);
  }

  private createErrorResponse(error: any): ApiResponse<any> {
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
    } else if (error instanceof HttpErrorResponse) {
      // HTTP error
      errorResponse.error = {
        code: 'HTTP_ERROR',
        message: `HTTP ${error.status}: ${error.message}`
      };
    } else if (error?.message) {
      // Generic error with message
      errorResponse.error = {
        code: 'GENERIC_ERROR',
        message: error.message
      };
    }

    return errorResponse;
  }

  private determineSeverity(error: any): 'info' | 'warning' | 'error' | 'critical' {
    if (error instanceof HttpErrorResponse) {
      if (error.status >= 500) {
        return 'critical';
      } else if (error.status >= 400) {
        return 'error';
      } else if (error.status >= 300) {
        return 'warning';
      }
    }
    
    // For client-side or unknown errors
    if (error?.error instanceof ErrorEvent) {
      return 'critical';
    }

    return 'error';
  }
}