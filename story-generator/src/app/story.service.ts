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

// Seam-Driven Service Implementation
// Now connected to real backend APIs following exact seam contracts

@Injectable({
  providedIn: 'root'
})
export class StoryService {
  private apiUrl = '/api'; // Serverless API endpoints

  constructor(private http: HttpClient) {}

  // ==================== STORY GENERATION ====================
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
      `${this.apiUrl}/generate-story`,
      input
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== AUDIO CONVERSION ====================
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
      `${this.apiUrl}/convert-audio`,
      input
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== SAVE/EXPORT ====================
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    return this.http.post<ApiResponse<SaveExportSeam['output']>>(
      `${this.apiUrl}/save-story`,
      input
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== CHAPTER CONTINUATION ====================
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
      `${this.apiUrl}/continue-story`,
      input
    ).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== ERROR HANDLING ====================
  private handleError(error: HttpErrorResponse): Observable<never> {
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
        message: `HTTP ${error.status}: ${error.message}`
      };
    }

    return throwError(() => errorResponse);
  }
}