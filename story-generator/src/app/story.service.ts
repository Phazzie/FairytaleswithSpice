import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  ApiResponse,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryContinuationSeam,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
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
  beginStory(input: StoryGenerationSeam['input']): Observable<ApiResponse<StoryIterationPayload>> {
    const { creature, tone, spicyLevel, desiredWordBudget, chapterBatchSize, themes } = input;
    this.errorLogging.logInfo('Starting multi-chapter genesis request', 'StoryService.beginStory', {
      creature,
      tone,
      spicyLevel,
      desiredWordBudget,
      chapterBatchSize,
      themeCount: themes?.length ?? 0
    });

    return this.http
      .post<ApiResponse<StoryIterationPayload>>(`${this.apiUrl}/stories`, input)
      .pipe(
        tap(response => {
          if (response.success) {
            this.errorLogging.logInfo('Genesis batch completed', 'StoryService.beginStory', {
              storyId: response.data.summary.storyId,
              chapters: response.data.batch.chapters.map(ch => ch.chapterNumber)
            });
          }
        }),
        catchError(error => this.handleHttpError(error, 'beginStory'))
      );
  }

  /**
   * Request a continuation batch for an existing story.
   */
  continueStory(input: StoryContinuationSeam['input']): Observable<ApiResponse<StoryIterationPayload & { appendedChapterNumbers: number[] }>> {
    this.errorLogging.logInfo('Requesting continuation batch', 'StoryService.continueStory', {
      storyId: input.storyId,
      batchSize: input.chapterBatchSize,
      revision: input.storyState.revision,
      previousChapters: input.previouslyGeneratedChapters?.length ?? 0
    });

    return this.http
      .post<ApiResponse<StoryIterationPayload & { appendedChapterNumbers: number[] }>>(
        `${this.apiUrl}/stories/${input.storyId}/continue`,
        input
      )
      .pipe(catchError(error => this.handleHttpError(error, 'continueStory')));
  }

  /**
   * Create a Story Lab background job scaffold.
   */
  createStoryLabJob<TResult = StoryIterationPayload>(
    request: StoryLabJobCreationRequest
  ): Observable<ApiResponse<StoryLabJobCreationResponse<TResult>>> {
    this.errorLogging.logInfo('Creating Story Lab job', 'StoryService.createStoryLabJob', {
      kind: request.kind
    });

    return this.http
      .post<ApiResponse<StoryLabJobCreationResponse<TResult>>>(`${this.apiUrl}/jobs`, request)
      .pipe(catchError(error => this.handleHttpError(error, 'createStoryLabJob')));
  }

  /**
   * Read a Story Lab job snapshot by opaque job id.
   */
  getStoryLabJob<TResult = unknown>(
    jobId: string
  ): Observable<ApiResponse<StoryLabJobCreationResponse<TResult>>> {
    this.errorLogging.logInfo('Reading Story Lab job', 'StoryService.getStoryLabJob', {
      jobId
    });

    return this.http
      .get<ApiResponse<StoryLabJobCreationResponse<TResult>>>(`${this.apiUrl}/jobs/${encodeURIComponent(jobId)}`)
      .pipe(catchError(error => this.handleHttpError(error, 'getStoryLabJob')));
  }

  /**
   * Subscribe to Story Lab job snapshot events.
   */
  streamStoryLabJobEvents<TResult = unknown>(
    jobId: string,
    onEvent: (event: StoryLabJobEvent<TResult>) => void
  ): Observable<StoryLabJobEvent<TResult>> {
    return new Observable<StoryLabJobEvent<TResult>>(observer => {
      const streamUrl = `${this.apiUrl}/jobs/${encodeURIComponent(jobId)}/events`;
      const eventSource = new EventSource(streamUrl);
      this.errorLogging.logInfo('Opened Story Lab job event stream', 'StoryService.streamStoryLabJobEvents', {
        jobId
      });

      eventSource.onmessage = event => {
        try {
          const jobEvent = JSON.parse(event.data) as StoryLabJobEvent<TResult>;
          onEvent(jobEvent);
          observer.next(jobEvent);

          if (['completed', 'failed', 'cancelled'].includes(jobEvent.job.status)) {
            observer.complete();
            eventSource.close();
          }
        } catch (error) {
          this.errorLogging.logError(error, 'StoryService.streamStoryLabJobEvents.parse', 'error');
          observer.error(error);
          eventSource.close();
        }
      };

      eventSource.onerror = error => {
        this.errorLogging.logError(error, 'StoryService.streamStoryLabJobEvents.connection', 'error', {
          jobId
        });
        observer.error(error);
        eventSource.close();
      };

      return () => {
        this.errorLogging.logInfo('Closing Story Lab job event stream', 'StoryService.streamStoryLabJobEvents', {
          jobId
        });
        eventSource.close();
      };
    });
  }

  /**
   * Connect to the streaming endpoint for real-time progress updates.
   */
  streamStoryGeneration(
    input: StoryGenerationSeam['input'],
    onProgress: (chunk: StreamingProgressChunk) => void
  ): Observable<ApiResponse<StoryIterationPayload>> {
    return new Observable<ApiResponse<StoryIterationPayload>>(observer => {
      const params = new URLSearchParams({
        creature: input.creature,
        spicyLevel: String(input.spicyLevel),
        tone: input.tone,
        chapterBatchSize: String(input.chapterBatchSize),
        desiredWordBudget: String(input.desiredWordBudget),
        logline: input.logline,
        themes: JSON.stringify(input.themes ?? [])
      });

      if (input.narrativeDirectives) {
        params.set('narrativeDirectives', input.narrativeDirectives);
      }
      if (input.heatContract) {
        params.set('heatContract', JSON.stringify(input.heatContract));
      }
      if (input.protagonistName) {
        params.set('protagonistName', input.protagonistName);
      }
      if (input.antagonistName) {
        params.set('antagonistName', input.antagonistName);
      }
      if (input.worldDetails) {
        params.set('worldDetails', input.worldDetails);
      }

      const streamUrl = `${this.apiUrl}/stream/genesis?${params.toString()}`;
      const eventSource = new EventSource(streamUrl);
      this.errorLogging.logInfo('Opened streaming connection', 'StoryService.streamStoryGeneration', {
        creature: input.creature,
        tone: input.tone,
        chapterBatchSize: input.chapterBatchSize,
        themeCount: input.themes?.length ?? 0
      });

      eventSource.onmessage = event => {
        try {
          const chunk = JSON.parse(event.data) as StreamingProgressChunk | ApiResponse<StoryIterationPayload>;
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
