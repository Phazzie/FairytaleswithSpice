import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  ApiEnvelope,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryContinuationSeam,
  StreamingProgressChunk
} from './contracts';
import { ErrorLoggingService } from './error-logging';

/**
 * StoryService orchestrates all interactions with the backend story API.
 *
 * The redesigned platform treats story generation as an iterative workflow
 * where each batch returns multiple chapters alongside a continuity snapshot.
 * This service mirrors that architecture with explicit seam-driven methods.
 */
@Injectable({ providedIn: 'root' })
export class StoryService {
  private readonly http = inject(HttpClient);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly apiUrl = '/api/story-lab';

  /**
   * Begin a new story using the provided blueprint.
   */
  beginStory(input: StoryGenerationSeam['input']): Observable<ApiEnvelope<StoryIterationPayload>> {
    this.errorLogging.logInfo('Starting multi-chapter genesis request', 'StoryService.beginStory', { input });

    return this.http
      .post<ApiEnvelope<StoryIterationPayload>>(`${this.apiUrl}/stories`, input)
      .pipe(
        tap(response => {
          if (response.success) {
            this.errorLogging.logInfo('Genesis batch completed', 'StoryService.beginStory', {
              storyId: response.data?.summary.storyId,
              chapters: response.data?.batch.chapters.map(ch => ch.chapterNumber)
            });
          }
        }),
        catchError(error => this.handleHttpError(error, 'beginStory'))
      );
  }

  /**
   * Request a continuation batch for an existing story.
   */
  continueStory(input: StoryContinuationSeam['input']): Observable<ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }>> {
    this.errorLogging.logInfo('Requesting continuation batch', 'StoryService.continueStory', {
      storyId: input.storyId,
      batchSize: input.chapterBatchSize,
      revision: input.storyState.revision
    });

    return this.http
      .post<ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }>>(
        `${this.apiUrl}/stories/${input.storyId}/continue`,
        input
      )
      .pipe(catchError(error => this.handleHttpError(error, 'continueStory')));
  }

  /**
   * Connect to the streaming endpoint for real-time progress updates.
   */
  streamStoryGeneration(
    input: StoryGenerationSeam['input'],
    onProgress: (chunk: StreamingProgressChunk) => void
  ): Observable<ApiEnvelope<StoryIterationPayload>> {
    return new Observable<ApiEnvelope<StoryIterationPayload>>(observer => {
      const params = new URLSearchParams({
        creature: input.creature,
        spicyLevel: String(input.spicyLevel),
        tone: input.tone,
        chapterBatchSize: String(input.chapterBatchSize),
        wordBudget: String(input.desiredWordBudget),
        logline: input.logline
      });

      if (input.narrativeDirectives) {
        params.set('narrativeDirectives', input.narrativeDirectives);
      }

      const streamUrl = `${this.apiUrl}/stream/genesis?${params.toString()}`;
      const eventSource = new EventSource(streamUrl);
      this.errorLogging.logInfo('Opened streaming connection', 'StoryService.streamStoryGeneration', { streamUrl });

      eventSource.onmessage = event => {
        try {
          const chunk = JSON.parse(event.data) as StreamingProgressChunk | ApiEnvelope<StoryIterationPayload>;
          if ('type' in chunk) {
            onProgress(chunk);
            return;
          }

          observer.next(chunk);
          observer.complete();
          eventSource.close();
        } catch (error) {
          this.errorLogging.logError(error, 'StoryService.streamStoryGeneration.parse', 'error');
          observer.error(error);
          eventSource.close();
        }
      };

      eventSource.onerror = error => {
        this.errorLogging.logError(error, 'StoryService.streamStoryGeneration.connection', 'critical');
        observer.error(error);
        eventSource.close();
      };

      return () => {
        this.errorLogging.logInfo('Closing streaming connection', 'StoryService.streamStoryGeneration');
        eventSource.close();
      };
    });
  }

  private handleHttpError(error: HttpErrorResponse, context: string) {
    this.errorLogging.logError(error, `StoryService.${context}`, 'error', {
      status: error.status,
      url: error.url,
      payload: error.error
    });

    return throwError(() => error);
  }
}
