import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { App } from './app';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import {
  ApiResponse,
  StoryIterationPayload,
  StoryLabJobCreationResponse,
  StoryLabJobEvent,
  StoryStateSnapshot,
  StorySummary,
  GeneratedChapter
} from './contracts';

const STORAGE_KEY = 'fairytales_story_lab_projects_v1';
const SKIN_STORAGE_KEY = 'fairytales_story_lab_skin_v1';
const ACTIVE_JOB_STORAGE_KEY = 'fairytales_story_lab_active_job_v1';
type GenesisJobOverrides = Partial<StoryLabJobCreationResponse<StoryIterationPayload>['job']>;
type ContinuationJobResult = StoryIterationPayload & { appendedChapterNumbers: number[] };
type ContinuationJobOverrides = Partial<StoryLabJobCreationResponse<ContinuationJobResult>['job']>;

function createChapter(overrides: Partial<GeneratedChapter> = {}): GeneratedChapter {
  return {
    chapterId: overrides.chapterId ?? 'chapter-1',
    chapterNumber: overrides.chapterNumber ?? 1,
    title: overrides.title ?? 'Chapter One',
    htmlContent: overrides.htmlContent ?? '<p>Sample content</p>',
    rawContent: overrides.rawContent ?? '<p>Sample content</p>',
    summary: overrides.summary ?? 'Summary of chapter one.',
    wordCount: overrides.wordCount ?? 900,
    hasCliffhanger: overrides.hasCliffhanger ?? false,
    delta: overrides.delta ?? {
      introducedCharacters: [],
      resolvedThreads: [],
      escalatedThreads: [],
      foreshadowedArtifacts: [],
      continuityFlags: []
    }
  };
}

function createSummary(overrides: Partial<StorySummary> = {}): StorySummary {
  const now = new Date().toISOString();
  return {
    storyId: overrides.storyId ?? 'story-123',
    title: overrides.title ?? 'Crimson Pact',
    synopsis: overrides.synopsis ?? 'A dark romance entwined with ancient oaths.',
    tone: overrides.tone ?? 'dark_romance',
    spicyLevel: overrides.spicyLevel ?? 3,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now
  };
}

function createState(overrides: Partial<StoryStateSnapshot> = {}): StoryStateSnapshot {
  const now = new Date().toISOString();
  return {
    storyId: overrides.storyId ?? 'story-123',
    revision: overrides.revision ?? 1,
    characters: overrides.characters ?? [],
    threads: overrides.threads ?? [],
    artifacts: overrides.artifacts ?? [],
    beats: overrides.beats ?? [],
    continuityWarnings: overrides.continuityWarnings ?? [],
    narrativeVoice: overrides.narrativeVoice ?? 'Velvet noir',
    lastUpdatedAt: overrides.lastUpdatedAt ?? now
  };
}

function createGenesisJobResponse(
  payload?: StoryIterationPayload,
  overrides: Partial<StoryLabJobCreationResponse<StoryIterationPayload>['job']> = {}
): StoryLabJobCreationResponse<StoryIterationPayload> {
  const now = new Date().toISOString();
  const jobId = overrides.jobId ?? 'job_123e4567-e89b-12d3-a456-426614174000';

  return {
    job: {
      jobId,
      kind: 'genesis',
      status: overrides.status ?? 'completed',
      currentStep: overrides.currentStep ?? 'completed',
      progressPercent: overrides.progressPercent ?? 100,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      result: payload,
      error: overrides.error,
      ...overrides
    },
    paths: {
      statusPath: `/api/story-lab/jobs/${jobId}`,
      eventsPath: `/api/story-lab/jobs/${jobId}/events`
    },
    durability: {
      mode: 'non_durable_memory',
      durable: false,
      warning: 'Jobs are held in memory for this deployment.'
    }
  };
}

function createGenesisJobEvent(
  response: StoryLabJobCreationResponse<StoryIterationPayload>
): StoryLabJobEvent<StoryIterationPayload> {
  return {
    eventId: `event-${response.job.status}`,
    type: 'snapshot',
    emittedAt: response.job.updatedAt,
    job: response.job
  };
}

function createContinuationPayload(
  genesisPayload: StoryIterationPayload,
  overrides: Partial<ContinuationJobResult> = {}
): ContinuationJobResult {
  return {
    ...genesisPayload,
    state: createState({ revision: 2 }),
    batch: {
      chapters: [createChapter({ chapterId: 'chapter-2', chapterNumber: 2 })],
      totalWordCount: 900,
      suggestedNextPrompts: []
    },
    telemetry: {
      engine: 'gpt',
      totalLatencyMs: 1700,
      averageChapterLatencyMs: 850,
      tokensConsumed: 880,
      retryCount: 0
    },
    appendedChapterNumbers: [2],
    ...overrides
  };
}

function createContinuationJobResponse(
  payload?: ContinuationJobResult,
  overrides: ContinuationJobOverrides = {}
): StoryLabJobCreationResponse<ContinuationJobResult> {
  const now = new Date().toISOString();
  const jobId = overrides.jobId ?? 'job_223e4567-e89b-12d3-a456-426614174000';

  return {
    job: {
      jobId,
      kind: 'continuation',
      status: overrides.status ?? 'completed',
      currentStep: overrides.currentStep ?? 'completed',
      progressPercent: overrides.progressPercent ?? 100,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      result: payload,
      error: overrides.error,
      ...overrides
    },
    paths: {
      statusPath: `/api/story-lab/jobs/${jobId}`,
      eventsPath: `/api/story-lab/jobs/${jobId}/events`
    },
    durability: {
      mode: 'non_durable_memory',
      durable: false,
      warning: 'Jobs are held in memory for this deployment.'
    }
  };
}

function createContinuationJobEvent(
  response: StoryLabJobCreationResponse<ContinuationJobResult>
): StoryLabJobEvent<ContinuationJobResult> {
  return {
    eventId: `event-${response.job.status}`,
    type: 'snapshot',
    emittedAt: response.job.updatedAt,
    job: response.job
  };
}

function createActiveJobMarker(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    jobId: 'job_123e4567-e89b-12d3-a456-426614174000',
    kind: 'genesis',
    batchId: 'batch-recovered',
    batchSize: 1,
    statusPath: '/api/story-lab/jobs/job_123e4567-e89b-12d3-a456-426614174000',
    startedAt: new Date().toISOString(),
    ...overrides
  };
}

function storeActiveJobMarker(overrides: Partial<Record<string, unknown>> = {}) {
  sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(createActiveJobMarker(overrides)));
}

const confirmedHeatContract = {
  adultOnlyConfirmed: true,
  tensionMode: 'slow_burn' as const,
  intimacyBoundary: 'fade_to_black' as const,
  noGoContent: 'No coercion.'
};

describe('App', () => {
  let component: App;
  let storyService: jasmine.SpyObj<StoryService>;
  let queryParamMap$: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKIN_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);

    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'beginStory',
      'continueStory',
      'createStoryLabJob',
      'getStoryLabJob',
      'streamStoryLabJobEvents',
      'streamStoryGeneration'
    ]);
    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError'
    ]);

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$.asObservable() } }
      ]
    }).compileComponents();

    component = TestBed.createComponent(App).componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SKIN_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  });

  function configureValidBlueprint(logline: string) {
    component.blueprint.set({
      ...component.blueprint(),
      logline,
      themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Forbidden romance.' }],
      heatContract: confirmedHeatContract
    });
  }

  function stubRunningGenesisJob(
    events$: Subject<StoryLabJobEvent<StoryIterationPayload>>,
    overrides: GenesisJobOverrides = {}
  ) {
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(undefined, {
        status: 'running',
        currentStep: 'generating_story',
        progressPercent: 32,
        ...overrides
      })
    }));
    storyService.streamStoryLabJobEvents.and.returnValue(events$.asObservable());
  }

  function startGenesisJobFlow(
    logline: string,
    events$: Subject<StoryLabJobEvent<StoryIterationPayload>>,
    initialJobOverrides: GenesisJobOverrides = {}
  ) {
    stubRunningGenesisJob(events$, initialJobOverrides);
    configureValidBlueprint(logline);
    component.startGenesis();
  }

  function seedWorkbenchForContinuation(overrides: Partial<StoryIterationPayload> = {}): StoryIterationPayload {
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 1800,
        averageChapterLatencyMs: 900,
        tokensConsumed: 900,
        retryCount: 0
      },
      ...overrides
    };

    component.workbench.set({
      story: payload.summary,
      state: payload.state,
      chapterHistory: payload.batch.chapters,
      activeBatchSize: 1,
      lastTelemetry: payload.telemetry
    });

    return payload;
  }

  it('creates the workbench with default blueprint values', () => {
    expect(component.blueprint().creature).toBe('vampire');
    expect(component.blueprint().tone).toBe('dark_romance');
    expect(component.blueprint().spicyLevel).toBe(3);
    expect(component.activeHeatContract().adultOnlyConfirmed).toBeFalse();
    expect(component.workbench().chapterHistory.length).toBe(0);
  });

  it('hides the debug panel unless debug mode is requested', () => {
    expect(component.showDebugPanel()).toBeFalse();
  });

  it('enables the debug panel with the debug query parameter', () => {
    queryParamMap$.next(convertToParamMap({ debug: '1' }));
    expect(component.showDebugPanel()).toBeTrue();
  });

  it('toggles theme selections', () => {
    expect(component.blueprint().themes.length).toBe(0);

    component.toggleTheme({ id: 'forbidden_love', label: 'Forbidden Love', description: '' });
    expect(component.blueprint().themes.length).toBe(1);

    component.toggleTheme({ id: 'forbidden_love', label: 'Forbidden Love', description: '' });
    expect(component.blueprint().themes.length).toBe(0);
  });

  it('selects and persists a visual skin without changing story inputs', () => {
    const initialBlueprint = component.blueprint();

    component.selectSkin('bookshop');

    expect(component.activeSkin()).toBe('bookshop');
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('bookshop');
    expect(component.blueprint()).toEqual(initialBlueprint);
  });

  it('supports the expanded creature set and spice labels', () => {
    expect(component.creatureOptions.map(option => option.id)).toContain('dragon');
    expect(component.creatureOptions.map(option => option.id)).toContain('mermaid');

    component.updateBlueprint('creature', 'dragon');
    component.updateBlueprint('spicyLevel', 5);

    expect(component.blueprint().creature).toBe('dragon');
    expect(component.activeSpiceOption().label).toBe('Inferno');
  });

  it('updates the Heat Contract without changing the rest of the blueprint', () => {
    component.updateHeatContract('adultOnlyConfirmed', true);
    component.updateHeatContract('tensionMode', 'dangerous_proximity');
    component.updateHeatContract('intimacyBoundary', 'literary_on_page');
    component.updateHeatContract('noGoContent', 'No humiliation.');

    expect(component.activeHeatContract().adultOnlyConfirmed).toBeTrue();
    expect(component.activeHeatContract().tensionMode).toBe('dangerous_proximity');
    expect(component.activeHeatContract().intimacyBoundary).toBe('literary_on_page');
    expect(component.activeHeatContract().noGoContent).toBe('No humiliation.');
    expect(component.blueprint().creature).toBe('vampire');
  });

  it('prevents genesis without a logline', () => {
    component.startGenesis();
    expect(storyService.beginStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).not.toHaveBeenCalled();
  });

  it('starts genesis through a Story Lab job and hydrates the workbench on completion', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary(),
      batch: {
        chapters: [createChapter(), createChapter({ chapterId: 'chapter-2', chapterNumber: 2 })],
        totalWordCount: 1800,
        suggestedNextPrompts: ['Explore the rival court.']
      },
      state: createState(),
      telemetry: {
        engine: 'gpt',
        totalLatencyMs: 2100,
        averageChapterLatencyMs: 1050,
        tokensConsumed: 1420,
        retryCount: 0
      }
    };
    const events$ = new Subject<StoryLabJobEvent<StoryIterationPayload>>();

    startGenesisJobFlow('A vampire princess bound by forbidden vows.', events$);

    expect(storyService.beginStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).toHaveBeenCalled();
    expect(storyService.createStoryLabJob.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      kind: 'genesis',
      blueprint: jasmine.objectContaining({
        logline: 'A vampire princess bound by forbidden vows.',
        chapterBatchSize: 1
      })
    }));
    expect(storyService.streamStoryLabJobEvents).toHaveBeenCalledWith(
      'job_123e4567-e89b-12d3-a456-426614174000',
      jasmine.any(Function)
    );

    events$.next(createGenesisJobEvent(createGenesisJobResponse(payload)));
    events$.complete();

    expect(component.workbench().story?.storyId).toBe('story-123');
    expect(component.workbench().chapterHistory.length).toBe(2);
    expect(component.selectedChapter()?.chapterNumber).toBe(2);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('completed');
    expect(component.suggestedNextPrompts()).toEqual(['Explore the rival court.']);
    expect(component.savedProjects().length).toBe(1);
    expect(component.workspaceSaveStatus()).toBe('Saved in this browser.');
  });

  it('updates genesis progress from Story Lab job snapshots', () => {
    const events$ = new Subject<StoryLabJobEvent<StoryIterationPayload>>();
    startGenesisJobFlow(
      'A siren archivist bargains with a moonlit duke.',
      events$,
      {
        status: 'running',
        currentStep: 'queued',
        progressPercent: 10
      }
    );

    events$.next(createGenesisJobEvent(createGenesisJobResponse(undefined, {
      status: 'running',
      currentStep: 'generating_story',
      progressPercent: 47
    })));

    expect(component.generationProgress().active).toBeTrue();
    expect(component.generationProgress().percent).toBe(47);
    expect(component.generationProgress().stage).toContain('Grok');
    expect(component.statusMessage()).toContain('Grok');
  });

  it('shows a friendly AI configuration error when a genesis job cannot use Grok', () => {
    const events$ = new Subject<StoryLabJobEvent<StoryIterationPayload>>();

    startGenesisJobFlow('A dragon guardian bargains for one night of forbidden mercy.', events$);
    events$.next(createGenesisJobEvent(createGenesisJobResponse(undefined, {
      status: 'failed',
      currentStep: 'failed',
      progressPercent: 100,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'The AI story engine is not configured for this deployment.'
      }
    })));

    expect(component.statusMessage()).toContain('missing its Grok configuration');
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
  });

  it('cancels an in-flight genesis job creation subscription on destroy', () => {
    const creation$ = new Subject<ApiResponse<StoryLabJobCreationResponse<StoryIterationPayload>>>();
    storyService.createStoryLabJob.and.returnValue(creation$.asObservable());
    configureValidBlueprint('A witch queen bargains with a haunted mirror.');

    component.startGenesis();

    expect(creation$.observed).toBeTrue();
    component.ngOnDestroy();
    expect(creation$.observed).toBeFalse();
  });

  it('stores an active genesis job marker while job snapshots are running', () => {
    const events$ = new Subject<StoryLabJobEvent<StoryIterationPayload>>();

    startGenesisJobFlow('A siren spy steals a vow from a forbidden archive.', events$);

    const marker = JSON.parse(sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY) ?? '{}');
    expect(marker).toEqual(jasmine.objectContaining({
      jobId: 'job_123e4567-e89b-12d3-a456-426614174000',
      kind: 'genesis',
      batchSize: 1,
      statusPath: '/api/story-lab/jobs/job_123e4567-e89b-12d3-a456-426614174000'
    }));
    expect(marker.batchId).toMatch(/^batch-/);
  });

  it('recovers a running genesis job from browser storage and resumes events', () => {
    const events$ = new Subject<StoryLabJobEvent<StoryIterationPayload>>();
    storeActiveJobMarker();
    storyService.getStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(undefined, {
        status: 'running',
        currentStep: 'generating_story',
        progressPercent: 41
      })
    }));
    storyService.streamStoryLabJobEvents.and.returnValue(events$.asObservable());

    const recovered = TestBed.createComponent(App).componentInstance;

    expect(storyService.getStoryLabJob).toHaveBeenCalledWith('job_123e4567-e89b-12d3-a456-426614174000');
    expect(storyService.streamStoryLabJobEvents).toHaveBeenCalledWith(
      'job_123e4567-e89b-12d3-a456-426614174000',
      jasmine.any(Function)
    );
    expect(recovered.generationProgress().active).toBeTrue();
    expect(recovered.generationProgress().percent).toBe(41);
    expect(recovered.statusMessage()).toContain('Grok');
  });

  it('recovers a completed genesis job and clears the active job marker', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary({ title: 'Recovered Pact' }),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'grok',
        model: 'grok-4.3',
        totalLatencyMs: 1200,
        averageChapterLatencyMs: 1200,
        tokensConsumed: 900,
        retryCount: 0
      }
    };
    storeActiveJobMarker();
    storyService.getStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(payload)
    }));

    const recovered = TestBed.createComponent(App).componentInstance;

    expect(recovered.workbench().story?.title).toBe('Recovered Pact');
    expect(recovered.workbench().chapterHistory.length).toBe(1);
    expect(sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBeNull();
  });

  it('clears malformed active job storage without crashing startup', () => {
    sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, '{not-json');

    expect(() => TestBed.createComponent(App).componentInstance).not.toThrow();
    expect(sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY)).toBeNull();
    expect(storyService.getStoryLabJob).not.toHaveBeenCalled();
  });

  it('loads a saved browser-local project into the workbench', () => {
    const payload: StoryIterationPayload = {
      summary: createSummary({ title: 'Saved Pact' }),
      batch: {
        chapters: [createChapter()],
        totalWordCount: 900,
        suggestedNextPrompts: []
      },
      state: createState(),
      telemetry: {
        engine: 'grok',
        model: 'grok-4.3',
        totalLatencyMs: 1200,
        averageChapterLatencyMs: 1200,
        tokensConsumed: 900,
        retryCount: 0
      }
    };

    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createGenesisJobResponse(payload)
    }));
    component.blueprint.set({
      ...component.blueprint(),
      logline: 'A vampire princess bound by forbidden vows.',
      themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Forbidden romance.' }],
      heatContract: confirmedHeatContract
    });
    component.startGenesis();
    component.resetWorkbench();
    component.loadSavedProject('story-123');

    expect(component.workbench().story?.title).toBe('Saved Pact');
    expect(component.workbench().chapterHistory.length).toBe(1);
    expect(component.modelBadge()).toBe('grok-4.3');
  });

  it('continues an existing saga and appends chapters', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: continuationPayload }));

    component.continueSaga('Focus on the betrayal arc.');

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(storyService.createStoryLabJob).toHaveBeenCalledWith(jasmine.objectContaining({
      kind: 'continuation',
      continuation: jasmine.objectContaining({
        storyId: 'story-123',
        continuationBrief: 'Focus on the betrayal arc.'
      })
    }));
    expect(component.workbench().chapterHistory.length).toBe(2);
    expect(component.selectedChapter()?.chapterNumber).toBe(2);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('completed');
  });

  it('continues with a selected direction brief', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(continuationPayload)
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: continuationPayload }));

    component.continueWithDirection(component.continuationDirections[1]);

    expect(storyService.continueStory).not.toHaveBeenCalled();
    const jobRequest = storyService.createStoryLabJob.calls.mostRecent().args[0] as {
      kind: 'continuation';
      continuation: { continuationBrief?: string };
    };
    expect(jobRequest.kind).toBe('continuation');
    expect(jobRequest.continuation.continuationBrief)
      .toContain('external danger');
  });

  it('updates continuation progress from Story Lab job snapshots', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    const continuationPayload = createContinuationPayload(genesisPayload);
    const events$ = new Subject<StoryLabJobEvent<ContinuationJobResult>>();
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(undefined, {
        status: 'running',
        currentStep: 'continuing_story',
        progressPercent: 28
      })
    }));
    storyService.streamStoryLabJobEvents.and.returnValue(events$.asObservable());
    storyService.continueStory.and.returnValue(of({ success: true, data: continuationPayload }));

    component.continueSaga('Make the rival reveal dangerous.');

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(storyService.streamStoryLabJobEvents).toHaveBeenCalledWith(
      'job_223e4567-e89b-12d3-a456-426614174000',
      jasmine.any(Function)
    );
    expect(component.generationProgress().percent).toBe(28);
    expect(component.statusMessage()).toContain('Grok');

    events$.next(createContinuationJobEvent(createContinuationJobResponse(continuationPayload)));
    events$.complete();

    expect(component.workbench().chapterHistory.length).toBe(2);
    expect(component.selectedChapter()?.chapterNumber).toBe(2);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('completed');
  });

  it('keeps existing chapters when a continuation job fails', () => {
    const genesisPayload = seedWorkbenchForContinuation();
    storyService.createStoryLabJob.and.returnValue(of({
      success: true,
      data: createContinuationJobResponse(undefined, {
        status: 'failed',
        currentStep: 'failed',
        progressPercent: 100,
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'The AI story engine is not configured for this deployment.'
        }
      })
    }));
    storyService.continueStory.and.returnValue(of({ success: true, data: createContinuationPayload(genesisPayload) }));

    component.continueSaga();

    expect(storyService.continueStory).not.toHaveBeenCalled();
    expect(component.workbench().chapterHistory).toEqual(genesisPayload.batch.chapters);
    expect(component.activeBatchQueue().at(-1)?.status).toBe('failed');
    expect(component.statusMessage()).toContain('missing its Grok configuration');
  });

  it('copies generated story text to the clipboard', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    component.workbench.set({
      story: createSummary({ title: 'Copied Pact' }),
      state: createState(),
      chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      activeBatchSize: 1
    });

    await component.copyStory();

    expect(writeText).toHaveBeenCalled();
    expect(writeText.calls.mostRecent().args[0]).toContain('Copied Pact');
    expect(writeText.calls.mostRecent().args[0]).toContain('Heat rose.');
    expect(component.statusMessage()).toBe('Story copied to your clipboard.');
  });

  it('downloads generated story HTML locally', fakeAsync(() => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a') as HTMLAnchorElement;
    const clickSpy = spyOn(anchor, 'click');
    spyOn(document, 'createElement').and.callFake((tagName: string) => {
      return tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName);
    });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:story-download');
    spyOn(URL, 'revokeObjectURL');
    component.workbench.set({
      story: createSummary({ title: 'Downloaded Pact', synopsis: 'A pact worth keeping.' }),
      state: createState(),
      chapterHistory: [createChapter({ title: 'First Ember', htmlContent: '<p>Heat rose.</p>' })],
      activeBatchSize: 1
    });

    component.downloadStory();

    expect(anchor.download).toBe('downloaded-pact.html');
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    tick();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:story-download');
    expect(component.statusMessage()).toBe('Story download created.');
  }));
});
