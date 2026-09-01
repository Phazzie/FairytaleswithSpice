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
  StoryLabUserProfile
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
   * Read a Story Lab job's latest snapshot from the `statusPath` its creation
   * response returned. Used to keep watching a job that hasn't reached a
   * terminal status yet.
   *
   * The route answers with the same envelope shape `createStoryLabJob` does
   * (`{ job, paths, durability }`, from `StoryLabJobStore.getJob`) rather
   * than a bare job — the response type here has to match that, not the
   * `StoryLabJob` the caller ultimately wants.
   *
   * No `logInfo` here, unlike this service's other methods: this is called
   * on every poll tick (as often as every few seconds for up to several
   * minutes), and `ErrorLoggingService` keeps a single shared, capped
   * buffer — a per-poll info entry would flood it and evict genuine errors
   * from the Error Display panel. Failures still go through `handleHttpError`.
   */
  getStoryLabJobStatus<TResult = StoryIterationPayload>(
    statusPath: string
  ): Observable<ApiResponse<StoryLabJobCreationResponse<TResult>>> {
    return this.http
      .get<ApiResponse<StoryLabJobCreationResponse<TResult>>>(statusPath)
      .pipe(catchError(error => this.handleHttpError(error, 'getStoryLabJobStatus')));
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
