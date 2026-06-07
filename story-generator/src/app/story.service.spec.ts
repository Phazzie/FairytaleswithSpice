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
  StoryLabJobEvent,
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

class MockEventSource {
  static readonly instances: MockEventSource[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly close = jasmine.createSpy('close');

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  fail(): void {
    this.onerror?.(new Event('error'));
  }
}

describe('StoryService', () => {
  let service: StoryService;
  let httpMock: HttpTestingController;
  let errorLogging: jasmine.SpyObj<ErrorLoggingService>;
  let originalEventSource: typeof EventSource;

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
    originalEventSource = globalThis.EventSource;
    MockEventSource.instances.length = 0;
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource
    });
  });

  afterEach(() => {
    httpMock.verify();
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: originalEventSource
    });
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

  it('gets Story Lab job snapshots by opaque job id', () => {
    const jobId = 'job_00000000-0000-4000-8000-000000000000';
    const payload = createJobResponse(jobId);

    service.getStoryLabJob(jobId).subscribe(response => {
      expect(response.success).toBeTrue();
      expect(response.data?.paths.eventsPath).toContain(jobId);
    });

    const req = httpMock.expectOne(`/api/story-lab/jobs/${jobId}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: payload });
  });

  it('streams Story Lab job events by opaque job id', () => {
    const jobId = 'job_00000000-0000-4000-8000-000000000000';
    const response = createJobResponse<StoryIterationPayload>(jobId);
    const event: StoryLabJobEvent<StoryIterationPayload> = {
      eventId: 'event-1',
      type: 'snapshot',
      emittedAt: response.job.updatedAt,
      job: response.job
    };
    const received: StoryLabJobEvent<StoryIterationPayload>[] = [];
    let completed = false;

    service.streamStoryLabJobEvents<StoryIterationPayload>(jobId, nextEvent => received.push(nextEvent)).subscribe({
      complete: () => {
        completed = true;
      }
    });

    expect(MockEventSource.instances.length).toBe(1);
    const source = MockEventSource.instances[0];
    expect(source.url).toBe(`/api/story-lab/jobs/${jobId}/events`);

    source.emit(event);

    expect(received).toEqual([event]);
    expect(completed).toBeTrue();
    expect(source.close).toHaveBeenCalled();
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
