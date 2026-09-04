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
import { readSseFrameData, splitSseFrames } from '../../../shared/sseFrameReader';

/**
 * How long `streamStoryLabJobEvents` waits after the events route's response
 * ends before reconnecting — the response ends by design on every read (see
 * that method's own comment), so this is the interval between replays, not a
 * timeout on anything. Sized to match `RATE_LIMITS.STORY_LAB_JOB_EVENTS`
 * (`api/_lib/constants.ts`), which is itself sized for a reconnect roughly
 * this often, and a native `EventSource`'s own default retry delay.
 */
const STORY_LAB_JOB_EVENTS_RECONNECT_DELAY_MS = 3000;

/**
 * Whether a non-OK status from the events route means the stream itself is
 * unreachable going forward (auth lost, the job id no longer resolves)
 * rather than a blip worth retrying — the same distinction the retired poll
 * loop's `isDefinitiveJobPollError` drew for status polling.
 */
function isDefinitiveStoryLabJobEventsStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

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
   * and closes the response immediately — by design, not a bug — so this
   * reconnects on its own every `STORY_LAB_JOB_EVENTS_RECONNECT_DELAY_MS`
   * after each clean close, the same way a browser's native `EventSource`
   * would reconnect automatically.
   *
   * `fetch`, not `EventSource`, is what reads it. A native `EventSource`
   * cannot set custom headers, which an earlier version of this method
   * worked around by putting a signed-in caller's session token in the URL
   * as a query parameter — a real finding from this PR's own review: Vercel,
   * reverse-proxy, and browser-history logs can retain a URL query string
   * even though this app's own structured logger redacts auth headers, so
   * that put a bearer credential (a Clerk JWT, not a narrowly-scoped
   * short-lived ticket) somewhere it did not need to be. `fetch` sends the
   * real `X-Story-Lab-Session` header instead — matching every other
   * authenticated job-route request `authInterceptor` makes — and
   * `getSessionToken` is called fresh before every attempt, not just the
   * first: the retired poll loop's interceptor deliberately re-fetched a
   * token per request for the same reason (`AuthService.getRequestToken()`'s
   * own doc comment), and a `sessionToken` fixed at the first connect would
   * go on being reused, unrefreshed, by every later reconnect of a job that
   * outlives the JWT's remaining lifetime.
   *
   * `getSessionToken` is a callback rather than a token value so this method
   * does not depend on `AuthService`, which already depends on `StoryService`
   * (`getStoryLabAuthConfig`) — the caller (`App`, which already injects
   * `AuthService`) passes `() => this.authService.getRequestToken()`.
   *
   * Every reconnect replays the job's *entire* recorded history, not just
   * what changed since the last read — `appliedEventIds` is what keeps a
   * reconnect from re-delivering snapshots already applied and visibly
   * moving the reader's progress bar backward before it catches back up.
   *
   * No `logInfo` here, unlike this service's other methods:
   * `ErrorLoggingService` keeps a single shared, capped buffer, and a
   * reconnect happens as often as every few seconds for up to several
   * minutes. Logging that on every occurrence would flood the buffer and
   * evict genuine errors from the Error Display panel; only a frame that
   * fails to parse or a terminal stream error goes through `errorLogging`,
   * and never with the parse error's own message — see the inline comment
   * on that below.
   */
  streamStoryLabJobEvents<TResult = StoryIterationPayload>(
    eventsPath: string,
    getSessionToken: () => Promise<string | null>
  ): Observable<StoryLabJobEvent<TResult>> {
    return new Observable<StoryLabJobEvent<TResult>>(subscriber => {
      let stopped = false;
      let abortController: AbortController | null = null;
      let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const appliedEventIds = new Set<string>();

      const readOneConnection = async (): Promise<'reconnect' | 'stop'> => {
        const sessionToken = await getSessionToken();
        if (stopped) {
          return 'stop';
        }

        abortController = new AbortController();
        let response: Response;
        try {
          response = await fetch(eventsPath, {
            headers: sessionToken ? { 'X-Story-Lab-Session': sessionToken } : undefined,
            signal: abortController.signal
          });
        } catch (error) {
          // A network-level failure (offline, DNS, a dropped connection) —
          // no different from a browser's own `EventSource` retrying past a
          // blip. `stopped` is what tells a deliberate `unsubscribe()`'s
          // abort apart from a real one.
          return stopped ? 'stop' : 'reconnect';
        }

        if (!response.ok) {
          if (isDefinitiveStoryLabJobEventsStatus(response.status)) {
            subscriber.error(new Error(`Story Lab job event stream failed with status ${response.status}.`));
            return 'stop';
          }
          return 'reconnect';
        }

        const reader = response.body?.getReader();
        if (!reader) {
          subscriber.error(new Error('Story Lab job event stream response had no body.'));
          return 'stop';
        }

        const decoder = new TextDecoder();
        let buffer = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const { frames, remainder } = splitSseFrames(buffer);
            buffer = remainder;

            for (const frame of frames) {
              const data = readSseFrameData(frame);
              if (data === null) {
                continue;
              }

              let event: StoryLabJobEvent<TResult>;
              try {
                event = JSON.parse(data) as StoryLabJobEvent<TResult>;
              } catch {
                // Never the parse error's own message: V8's `JSON.parse` can
                // echo a snippet of the invalid input in it, and a malformed
                // frame here could begin with private story content — this
                // app's logger redacts known sensitive *keys*, not arbitrary
                // prose folded into an unrelated error message.
                this.errorLogging.logError(
                  new Error('Story Lab job event frame failed to parse.'),
                  'StoryService.streamStoryLabJobEvents'
                );
                continue;
              }

              if (appliedEventIds.has(event.eventId)) {
                continue;
              }
              appliedEventIds.add(event.eventId);
              subscriber.next(event);
            }
          }
        } catch (error) {
          // `abortController.abort()` (deliberate unsubscribe) rejects a
          // `read()` already in flight the same way it rejects an in-flight
          // `fetch()` above — handled the same way, so it never becomes an
          // unhandled rejection out of this async function.
          return stopped ? 'stop' : 'reconnect';
        }

        // A clean end of the response body — the route replayed everything
        // it had and closed, by design. Reconnect for whatever comes next.
        return 'reconnect';
      };

      (async () => {
        while (!stopped) {
          const outcome = await readOneConnection();
          if (outcome === 'stop' || stopped) {
            return;
          }
          await new Promise<void>(resolve => {
            reconnectTimeoutId = setTimeout(() => {
              reconnectTimeoutId = null;
              resolve();
            }, STORY_LAB_JOB_EVENTS_RECONNECT_DELAY_MS);
          });
        }
      })();

      return () => {
        stopped = true;
        abortController?.abort();
        if (reconnectTimeoutId !== null) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }
      };
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
