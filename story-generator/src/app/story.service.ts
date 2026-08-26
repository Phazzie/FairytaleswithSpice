import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  ApiResponse,
  CloudStoryProjectDeleteReceipt,
  CloudStoryProjectList,
  CloudStoryProjectLoadResult,
  CloudStoryProjectSaveReceipt,
  ImageGenerationSeam,
  SaveExportSeam,
  SavedStoryProject,
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryContinuationSeam,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
  StoryLabUserProfile,
  StreamingProgressChunk
} from './contracts';
import { ErrorLoggingService } from './error-logging';
import { readEventStreamErrorAction } from '../../../shared/eventStreamRetry';

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
   * Read the signed-in Story Lab profile through the account route.
   */
  getStoryLabProfile(): Observable<ApiResponse<StoryLabUserProfile>> {
    this.errorLogging.logInfo('Reading Story Lab profile', 'StoryService.getStoryLabProfile');

    return this.http
      .get<ApiResponse<StoryLabUserProfile>>(`${this.apiUrl}/account/profile`)
      .pipe(catchError(error => this.handleHttpError(error, 'getStoryLabProfile')));
  }

  /**
   * Update the signed-in Story Lab profile through the account route.
   */
  updateStoryLabProfile(profile: StoryLabUserProfile): Observable<ApiResponse<StoryLabUserProfile>> {
    this.errorLogging.logInfo('Updating Story Lab profile', 'StoryService.updateStoryLabProfile', {
      userId: profile.userId
    });

    return this.http
      .put<ApiResponse<StoryLabUserProfile>>(`${this.apiUrl}/account/profile`, { profile })
      .pipe(catchError(error => this.handleHttpError(error, 'updateStoryLabProfile')));
  }

  /**
   * List the signed-in user's cloud Story Lab projects.
   */
  listCloudStoryProjects(): Observable<ApiResponse<CloudStoryProjectList>> {
    this.errorLogging.logInfo('Listing Story Lab cloud projects', 'StoryService.listCloudStoryProjects');

    return this.http
      .get<ApiResponse<CloudStoryProjectList>>(`${this.apiUrl}/account/projects`)
      .pipe(catchError(error => this.handleHttpError(error, 'listCloudStoryProjects')));
  }

  /**
   * Save the current project to the signed-in user's cloud library.
   */
  saveCloudStoryProject(project: SavedStoryProject): Observable<ApiResponse<CloudStoryProjectSaveReceipt>> {
    this.errorLogging.logInfo('Saving Story Lab cloud project', 'StoryService.saveCloudStoryProject', {
      projectId: project.id,
      storyId: project.storyId
    });

    return this.http
      .post<ApiResponse<CloudStoryProjectSaveReceipt>>(`${this.apiUrl}/account/projects`, { project })
      .pipe(catchError(error => this.handleHttpError(error, 'saveCloudStoryProject')));
  }

  /**
   * Load a single signed-in cloud Story Lab project.
   */
  loadCloudStoryProject(projectId: string): Observable<ApiResponse<CloudStoryProjectLoadResult>> {
    this.errorLogging.logInfo('Loading Story Lab cloud project', 'StoryService.loadCloudStoryProject', {
      projectId
    });

    return this.http
      .get<ApiResponse<CloudStoryProjectLoadResult>>(
        `${this.apiUrl}/account/projects/${encodeURIComponent(projectId)}`
      )
      .pipe(catchError(error => this.handleHttpError(error, 'loadCloudStoryProject')));
  }

  /**
   * Delete a signed-in cloud Story Lab project.
   */
  deleteCloudStoryProject(projectId: string): Observable<ApiResponse<CloudStoryProjectDeleteReceipt>> {
    this.errorLogging.logInfo('Deleting Story Lab cloud project', 'StoryService.deleteCloudStoryProject', {
      projectId
    });

    return this.http
      .delete<ApiResponse<CloudStoryProjectDeleteReceipt>>(
        `${this.apiUrl}/account/projects/${encodeURIComponent(projectId)}`
      )
      .pipe(catchError(error => this.handleHttpError(error, 'deleteCloudStoryProject')));
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
        // The job event route answers with the events recorded so far and ends
        // the response, so a running job's stream closes — normally — after
        // every replay, and the browser fires `error` on its way to reopening
        // it. Ending the subscription there told the reader that generation
        // updates had stopped, and closed the `EventSource` that was about to
        // reconnect and deliver the rest, for a job the server was still
        // working on quite happily. Only an error the browser will not retry is
        // the end of this stream.
        if (readEventStreamErrorAction(eventSource.readyState) === 'retry') {
          this.errorLogging.logInfo(
            'Story Lab job event stream reconnecting',
            'StoryService.streamStoryLabJobEvents',
            { jobId }
          );
          return;
        }

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

            // An `error` chunk is the server's last word: the genesis route
            // writes it and ends the response. Treated as ordinary progress,
            // the stream was left open, and an `EventSource` reads a closed
            // response as a dropped connection and reconnects — which re-runs
            // the whole paid generation, again on every retry, with the
            // subscriber still waiting on an observable that never settles.
            // Ending the stream here reports the failure the server actually
            // described instead of the generic connection error that followed.
            if (chunk.type === 'error') {
              eventSource.close();
              observer.error(new Error(chunk.error?.message ?? 'Story streaming failed.'));
            }
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
        // Deliberately not the retry-aware reading the job event stream uses:
        // this route holds one connection open for the whole generation, so
        // letting the browser reopen it runs the paid generation again from the
        // beginning — the reason the `error` chunk above closes the stream by
        // hand rather than leaving the response to end on its own.
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

  /**
   * Generate a scene image for a story chapter.
   */
  generateImage(input: ImageGenerationSeam['input']): Observable<ApiResponse<ImageGenerationSeam['output']>> {
    this.errorLogging.logInfo('Requesting story image', 'StoryService.generateImage', {
      storyId: input.storyId,
      creature: input.creature,
      style: input.style
    });

    return this.http
      .post<ApiResponse<ImageGenerationSeam['output']>>('/api/image/generate', input)
      .pipe(catchError(error => this.handleHttpError(error, 'generateImage')));
  }

  exportStory(input: SaveExportSeam['input']): Observable<ApiResponse<SaveExportSeam['output']>> {
    this.errorLogging.logInfo('Requesting story export', 'StoryService.exportStory', {
      storyId: input.storyId,
      format: input.format
    });

    return this.http
      .post<ApiResponse<SaveExportSeam['output']>>('/api/export/save', input)
      .pipe(catchError(error => this.handleHttpError(error, 'exportStory')));
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
