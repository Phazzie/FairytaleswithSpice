import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  AudioConversionSeam,
  SaveExportSeam,
  ApiResponse
} from './contracts';
import { ErrorLoggingService } from './error-logging';

/**
 * A Seam-Driven Angular service for interacting with the Fairytales with Spice backend.
 * Each public method in this service corresponds to a specific "seam" defined in the
 * contracts.ts file. It handles making HTTP requests and provides centralized error handling.
 */
@Injectable({
  providedIn: 'root'
})
export class StoryService {
  // The base URL for the backend API.
  // This points to the Vercel serverless functions.
  private apiUrl = '/api';

  constructor(
    private http: HttpClient,
    private errorLogging: ErrorLoggingService
  ) {}

  /**
   * SEAM 1: Generates a new story by calling the backend's story generation endpoint.
   * @param input The data for generating the story, conforming to the StoryGenerationSeam input contract.
   * @returns An Observable of the ApiResponse containing the generated story.
   */
  generateStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryGenerationSeam['output']>> {
    this.errorLogging.logInfo('Starting story generation', 'StoryService.generateStory', { input });
    
    return this.http.post<ApiResponse<StoryGenerationSeam['output']>>(
      `${this.apiUrl}/generate-story`,
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
   * SEAM 3: Converts a story's text content to audio.
   * @param input The data for audio conversion, conforming to the AudioConversionSeam input contract.
   * @returns An Observable of the ApiResponse containing the audio conversion result.
   */
  convertToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    this.errorLogging.logInfo('Starting audio conversion', 'StoryService.convertToAudio', { storyId: input.storyId });
    
    return this.http.post<ApiResponse<AudioConversionSeam['output']>>(
      `${this.apiUrl}/convert-audio`,
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

  /**
   * SEAM 4: Saves or exports a story in a specified format.
   * @param input The data for saving/exporting, conforming to the SaveExportSeam input contract.
   * @returns An Observable of the ApiResponse containing the export result.
   */
  saveStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    this.errorLogging.logInfo('Starting story save/export', 'StoryService.saveStory', { storyId: input.storyId, format: input.format });
    
    return this.http.post<ApiResponse<SaveExportSeam['output']>>(
      `${this.apiUrl}/save-story`,
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

  /**
   * SEAM 2: Generates the next chapter for an existing story.
   * @param input The data for chapter continuation, conforming to the ChapterContinuationSeam input contract.
   * @returns An Observable of the ApiResponse containing the new chapter.
   */
  generateNextChapter(input: ChapterContinuationSeam['input']): Observable<ApiResponse<ChapterContinuationSeam['output']>> {
    this.errorLogging.logInfo('Starting chapter continuation', 'StoryService.generateNextChapter', { storyId: input.storyId });
    
    return this.http.post<ApiResponse<ChapterContinuationSeam['output']>>(
      `${this.apiUrl}/continue-story`,
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

  /**
   * Centralized error handler for all HTTP requests made by this service.
   * It normalizes different types of errors (client-side, backend, HTTP) into a
   * consistent ApiResponse format.
   * @param error The HttpErrorResponse object from the failed request.
   * @param context A string identifying the method where the error occurred.
   * @returns An Observable that throws a normalized ApiResponse error.
   */
  private handleError = (error: HttpErrorResponse, context: string = 'StoryService'): Observable<never> => {
    let errorResponse: ApiResponse<any>;

    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred.
      errorResponse = {
        success: false,
        error: { code: 'CLIENT_ERROR', message: error.error.message }
      };
      this.errorLogging.logError(error, `${context} - Client Error`, 'error', { type: 'client_side', url: error.url });
    } else if (error.error && typeof error.error === 'object' && 'error' in error.error) {
      // The backend returned a structured error response that matches our ApiResponse contract.
      errorResponse = error.error;
      this.errorLogging.logError(error, `${context} - Backend Error`, 'error', { type: 'backend_response', status: error.status, url: error.url, errorCode: error.error.error?.code });
    } else {
      // A generic HTTP error occurred (e.g., 404, 500 without a structured body).
      errorResponse = {
        success: false,
        error: { code: 'HTTP_ERROR', message: `HTTP ${error.status}: ${error.statusText}` }
      };
      this.errorLogging.logError(error, `${context} - HTTP Error`, 'error', { type: 'http_error', status: error.status, statusText: error.statusText, url: error.url });
    }

    // Return a new observable that immediately throws the normalized error.
    return throwError(() => errorResponse);
  };
}