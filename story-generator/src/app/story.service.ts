import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  ApiResponse,
  AudioConversionSeam,
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
  StoryLabAuthConfig,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
  StoryLabUserProfile
} from './contracts';
import { ErrorLoggingService } from './error-logging';
import { classifyEventStreamError } from '../../../shared/eventStreamRetry';

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
   * Watch a Story Lab job's events over the backend's replay-and-close SSE
   * route at `eventsPath`, from its creation response's `paths.eventsPath`.
   * Used to keep watching a job that hasn't reached a terminal status yet.
   *
   * `handleStreamStoryLabJobEvents` replays every recorded event for the job
   * and closes the response immediately — by design, not a bug — so the
   * browser's native `EventSource` reconnecting every few seconds is what
   * keeps this observable open across each of those closes.
   * `classifyEventStreamError` is what tells that expected reconnect apart
   * from a real terminal failure; only the latter ends the observable, via
   * `subscriber.error` rather than `handleHttpError` — there is no HTTP
   * response here for that to format.
   *
   * `EventSource` cannot set custom headers, so a caller with a signed-in
   * session token passes it as `sessionToken`, appended to the URL — the
   * same query-parameter bridge `withEventStreamAuth` already reads on the
   * backend for `apiKey`. This method does not fetch that token itself: that
   * would make `StoryService` depend on `AuthService`, which already depends
   * on `StoryService` (`getStoryLabAuthConfig`), and a fresh token is what
   * `AuthService.getRequestToken()` returns anyway — the caller already has
   * it or can ask for it.
   *
   * No `logInfo` here, unlike this service's other methods: `ErrorLoggingService`
   * keeps a single shared, capped buffer, and a reconnect-shaped disconnect —
   * swallowed below, never reaching a subscriber — happens as often as every
   * few seconds for up to several minutes. Logging that on every occurrence
   * would flood the buffer and evict genuine errors from the Error Display
   * panel; only a message that fails to parse or a terminal stream error goes
   * through `errorLogging`.
   */
  streamStoryLabJobEvents<TResult = StoryIterationPayload>(
    eventsPath: string,
    sessionToken: string | null
  ): Observable<StoryLabJobEvent<TResult>> {
    const url = sessionToken
      ? `${eventsPath}${eventsPath.includes('?') ? '&' : '?'}sessionToken=${encodeURIComponent(sessionToken)}`
      : eventsPath;

    return new Observable<StoryLabJobEvent<TResult>>(subscriber => {
      const source = new EventSource(url, { withCredentials: true });

      source.onmessage = (message: MessageEvent<string>) => {
        try {
          subscriber.next(JSON.parse(message.data) as StoryLabJobEvent<TResult>);
        } catch (error) {
          this.errorLogging.logError(error, 'StoryService.streamStoryLabJobEvents');
        }
      };

      source.onerror = () => {
        if (classifyEventStreamError(source) === 'terminal') {
          subscriber.error(new Error('Story Lab job event stream closed.'));
        }
      };

      return () => source.close();
    });
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
   * Whether this deployment has cloud accounts configured, and what the
   * frontend needs to actually sign in — unauthenticated, so it can be
   * called before there is anything to authenticate with.
   */
  getStoryLabAuthConfig(): Observable<ApiResponse<StoryLabAuthConfig>> {
    return this.http
      .get<ApiResponse<StoryLabAuthConfig>>(`${this.apiUrl}/account/auth-config`)
      .pipe(catchError(error => this.handleHttpError(error, 'getStoryLabAuthConfig')));
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

  /**
   * Narrate a story chapter's speaker-tagged text into audio.
   */
  convertChapterToAudio(input: AudioConversionSeam['input']): Observable<ApiResponse<AudioConversionSeam['output']>> {
    this.errorLogging.logInfo('Requesting chapter narration', 'StoryService.convertChapterToAudio', {
      storyId: input.storyId
    });

    return this.http
      .post<ApiResponse<AudioConversionSeam['output']>>('/api/audio/convert', input)
      .pipe(catchError(error => this.handleHttpError(error, 'convertChapterToAudio')));
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
