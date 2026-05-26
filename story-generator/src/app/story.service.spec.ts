import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import {
  StoryGenerationSeam,
  StoryIterationPayload,
  StoryContinuationSeam,
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
      { input }
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
