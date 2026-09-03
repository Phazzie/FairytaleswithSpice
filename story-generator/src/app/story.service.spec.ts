import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import {
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryContinuationSeam,
  StoryLabJobCreationRequest,
  StoryLabJobCreationResponse,
  StoryLabUserProfile,
  CloudStoryProjectList,
  CloudStoryProjectSaveReceipt,
  SavedStoryProject,
  StorySummary,
  StoryStateSnapshot
} from './contracts';

function createGenesisInput(): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Star-crossed tension.' }],
    logline: 'A vampire noble must choose between love and allegiance.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 2,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
    narrativeDirectives: 'Lean into gothic atmosphere.'
  };
}

function createSummary(): StorySummary {
  const now = new Date().toISOString();
  return {
    storyId: 'story-123',
    title: 'Crimson Covenant',
    synopsis: 'A pact of blood entwines lovers and rivals.',
    tone: 'dark_romance',
    spicyLevel: 3,
    createdAt: now,
    updatedAt: now
  };
}

function createState(): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId: 'story-123',
    revision: 1,
    characters: [],
    threads: [],
    artifacts: [],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'Whispers in velvet',
    lastUpdatedAt: now
  };
}

function createProfile(): StoryLabUserProfile {
  const now = new Date().toISOString();
  return {
    userId: 'user-owner',
    displayName: 'Avery',
    preferences: {
      defaultHeatContract: {
        adultOnlyConfirmed: false,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door'
      },
      favoriteCreatures: ['witch'],
      favoriteTones: ['dark_romance'],
      librarySort: 'updated_desc'
    },
    createdAt: now,
    updatedAt: now
  };
}

function createSavedProject(): SavedStoryProject {
  const now = new Date().toISOString();
  const input = createGenesisInput();
  const summary = createSummary();

  return {
    id: 'project-cloud-1',
    storyId: summary.storyId,
    title: summary.title,
    synopsis: summary.synopsis,
    blueprint: input,
    summary,
    state: createState(),
    chapters: [],
    createdAt: now,
    updatedAt: now
  };
}

function createJobResponse<TResult = unknown>(
  jobId = 'job_00000000-0000-4000-8000-000000000000'
): StoryLabJobCreationResponse<TResult> {
  const now = new Date().toISOString();
  return {
    job: {
      jobId,
      kind: 'genesis',
      status: 'completed',
      currentStep: 'completed',
      progressPercent: 100,
      createdAt: now,
      updatedAt: now
    },
    paths: {
      statusPath: `/api/story-lab/jobs/${jobId}`,
      eventsPath: `/api/story-lab/jobs/${jobId}/events`
    },
    durability: {
      mode: 'non_durable_memory',
      durable: false,
      warning: 'Transient job scaffold.'
    }
  };
}

describe('StoryService', () => {
  let service: StoryService;
  let httpMock: HttpTestingController;
  let errorLogging: jasmine.SpyObj<ErrorLoggingService>;

  beforeEach(() => {
    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        StoryService,
        { provide: ErrorLoggingService, useValue: errorLoggingSpy }
      ]
    });

    service = TestBed.inject(StoryService);
    httpMock = TestBed.inject(HttpTestingController);
    errorLogging = TestBed.inject(ErrorLoggingService) as jasmine.SpyObj<ErrorLoggingService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts genesis requests to the story lab endpoint', () => {
    const input = createGenesisInput();
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [
          {
            chapterId: 'chapter-1',
            chapterNumber: 1,
            title: 'Moonlit Ultimatum',
            htmlContent: '<p>Content</p>',
            rawContent: '<p>Content</p>',
            summary: 'An impossible choice is presented.',
            wordCount: 900,
            hasCliffhanger: true,
            delta: {
              introducedCharacters: [],
              resolvedThreads: [],
              escalatedThreads: [],
              foreshadowedArtifacts: [],
              continuityFlags: []
            }
          }
        ],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 2000,
        averageChapterLatencyMs: 2000,
        tokensConsumed: 1200,
        retryCount: 0
      }
    };

    service.beginStory(input).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.summary.storyId).toBe('story-123');
    });

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ success: true, data: payload });

    expect(errorLogging.logInfo).toHaveBeenCalledWith(
      'Starting multi-chapter genesis request',
      'StoryService.beginStory',
      {
        creature: input.creature,
        tone: input.tone,
        spicyLevel: input.spicyLevel,
        desiredWordBudget: input.desiredWordBudget,
        chapterBatchSize: input.chapterBatchSize,
        themeCount: input.themes.length
      }
    );
  });

  it('posts continuation batches to the continuation endpoint', () => {
    const continuationInput: StoryContinuationSeam['input'] = {
      storyId: 'story-123',
      chapterBatchSize: 2,
      storyState: createState(),
      previouslyGeneratedChapters: [],
      continuationBrief: 'Escalate the romantic tension.'
    };

    service.continueStory(continuationInput).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.appendedChapterNumbers).toEqual([2, 3]);
    });

    const req = httpMock.expectOne('/api/story-lab/stories/story-123/continue');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(continuationInput);

    req.flush({
      success: true,
      data: {
        summary: createSummary(),
        batch: {
          chapters: [],
          totalWordCount: 0,
          suggestedNextPrompts: []
        },
        state: createState(),
        telemetry: {
          engine: 'gpt',
          totalLatencyMs: 2100,
          averageChapterLatencyMs: 1050,
          tokensConsumed: 1500,
          retryCount: 1
        },
        appendedChapterNumbers: [2, 3]
      }
    });
  });

  it('posts Story Lab job creation requests to the job endpoint', () => {
    const input = createGenesisInput();
    const request: StoryLabJobCreationRequest = {
      kind: 'genesis',
      blueprint: input,
      idempotencyKey: 'client-key-1'
    };
    const payload = createJobResponse<StoryIterationPayload>();

    service.createStoryLabJob<StoryIterationPayload>(request).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.job.jobId).toBe(payload.job.jobId);
    });

    const req = httpMock.expectOne('/api/story-lab/jobs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ success: true, data: payload });

    expect(errorLogging.logInfo).toHaveBeenCalledWith(
      'Creating Story Lab job',
      'StoryService.createStoryLabJob',
      { kind: 'genesis' }
    );
  });

  it('polls a Story Lab job status at its statusPath', () => {
    const payload = createJobResponse<StoryIterationPayload>('job_polling-target');
    // The route answers with the same envelope job creation does
    // (`{ job, paths, durability }`), not a bare job.
    const runningResponse = { ...payload, job: { ...payload.job, status: 'running' as const, progressPercent: 40 } };

    service.getStoryLabJobStatus<StoryIterationPayload>(payload.paths.statusPath).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.job.status).toBe('running');
      expect(response.data?.job.progressPercent).toBe(40);
    });

    const req = httpMock.expectOne(payload.paths.statusPath);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: runningResponse });

    // Deliberately no `logInfo` call here — this method is polled on a fixed
    // interval, and `ErrorLoggingService` keeps one shared, capped buffer
    // that also backs the Error Display panel. A per-poll info entry would
    // flood it and evict genuine errors.
    expect(errorLogging.logInfo).not.toHaveBeenCalled();
  });

  it('logs http errors from job status polling through the error logger', () => {
    const statusPath = '/api/story-lab/jobs/job_polling-target';

    service.getStoryLabJobStatus(statusPath).subscribe({
      next: () => fail('Expected error to be thrown'),
      error: error => {
        expect(error.status).toBe(503);
      }
    });

    const req = httpMock.expectOne(statusPath);
    req.flush('Service unavailable', { status: 503, statusText: 'Service Unavailable' });

    expect(errorLogging.logError).toHaveBeenCalled();
  });

  it('gets and updates the Story Lab account profile', () => {
    const profile = createProfile();

    service.getStoryLabProfile().subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.userId).toBe(profile.userId);
    });

    const getReq = httpMock.expectOne('/api/story-lab/account/profile');
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, data: profile });

    service.updateStoryLabProfile(profile).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.displayName).toBe('Avery');
    });

    const putReq = httpMock.expectOne('/api/story-lab/account/profile');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ profile });
    putReq.flush({ success: true, data: profile });
  });

  it('lists, saves, loads, and deletes cloud Story Lab projects', () => {
    const project = createSavedProject();
    const list: CloudStoryProjectList = {
      ownerUserId: 'user-owner',
      storageMode: 'cloud_postgres',
      projects: [{
        projectId: project.id,
        storyId: project.storyId,
        title: project.title,
        synopsis: project.synopsis,
        chapterCount: 0,
        acceptedMemoryCardCount: 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }],
      totalProjectCount: 1
    };
    const saveReceipt: CloudStoryProjectSaveReceipt = {
      projectId: project.id,
      storyId: project.storyId,
      savedAt: project.updatedAt,
      syncState: {
        mode: 'cloud_synced',
        lastSyncedAt: project.updatedAt
      }
    };

    service.listCloudStoryProjects().subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.projects.length).toBe(1);
    });
    const listReq = httpMock.expectOne('/api/story-lab/account/projects');
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ success: true, data: list });

    service.saveCloudStoryProject(project).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.projectId).toBe(project.id);
    });
    const saveReq = httpMock.expectOne('/api/story-lab/account/projects');
    expect(saveReq.request.method).toBe('POST');
    expect(saveReq.request.body).toEqual({ project });
    saveReq.flush({ success: true, data: saveReceipt });

    service.loadCloudStoryProject(project.id).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.project.id).toBe(project.id);
    });
    const loadReq = httpMock.expectOne(`/api/story-lab/account/projects/${project.id}`);
    expect(loadReq.request.method).toBe('GET');
    loadReq.flush({
      success: true,
      data: {
        projectId: project.id,
        storyId: project.storyId,
        ownerUserId: 'user-owner',
        project,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        storageMode: 'postgres'
      }
    });

    service.deleteCloudStoryProject(project.id).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.deleted).toBeTrue();
    });
    const deleteReq = httpMock.expectOne(`/api/story-lab/account/projects/${project.id}`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({
      success: true,
      data: {
        projectId: project.id,
        deleted: true
      }
    });
  });

  it('fetches the Story Lab auth config', () => {
    const service = TestBed.inject(StoryService);
    const httpMock = TestBed.inject(HttpTestingController);

    service.getStoryLabAuthConfig().subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.provider).toBe('clerk');
      expect(response.data?.publishableKey).toBe('pk_test_example');
    });

    const req = httpMock.expectOne('/api/story-lab/account/auth-config');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { provider: 'clerk', publishableKey: 'pk_test_example' } });
  });

  it('logs http errors through the error logger', () => {
    const input = createGenesisInput();

    service.beginStory(input).subscribe({
      next: () => fail('Expected error to be thrown'),
      error: error => {
        expect(error.status).toBe(500);
      }
    });

    const req = httpMock.expectOne('/api/story-lab/stories');
    req.flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(errorLogging.logError).toHaveBeenCalled();
  });
});
