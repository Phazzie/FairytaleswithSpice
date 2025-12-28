import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StreamingStoryComponent } from './streaming-story.component';
import { StoryService } from '../story.service';
import { StreamingProgressChunk, StoryIterationPayload } from '../contracts';

function createPayload(): StoryIterationPayload {
  const now = new Date().toISOString();
  return {
    summary: {
      storyId: 'story-abc',
      title: 'Midnight Tether',
      synopsis: 'A vampire envoy risks everything for a mortal bond.',
      tone: 'dark_romance',
      spicyLevel: 3,
      createdAt: now,
      updatedAt: now
    },
    batch: {
      chapters: [
        {
          chapterId: 'chapter-1',
          chapterNumber: 1,
          title: 'Chapter 1: Velvet Overture',
          htmlContent: '<p>The envoy meets her mortal muse beneath moonlight.</p>',
          summary: 'Desire collides with duty in the moonlit garden.',
          wordCount: 850,
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
      totalWordCount: 850,
      suggestedNextPrompts: []
    },
    state: {
      storyId: 'story-abc',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      beats: [],
      continuityWarnings: [],
      narrativeVoice: 'Velvet noir',
      lastUpdatedAt: now
    },
    telemetry: {
      engine: 'gpt',
      totalLatencyMs: 2000,
      averageChapterLatencyMs: 2000,
      tokensConsumed: 1200,
      retryCount: 0
    }
  };
}

describe('StreamingStoryComponent', () => {
  let fixture: ComponentFixture<StreamingStoryComponent>;
  let component: StreamingStoryComponent;
  let storyService: jasmine.SpyObj<StoryService>;

  beforeEach(async () => {
    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', ['streamStoryGeneration']);

    await TestBed.configureTestingModule({
      imports: [StreamingStoryComponent],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StreamingStoryComponent);
    component = fixture.componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
    fixture.detectChanges();
  });

  it('creates the streaming component', () => {
    expect(component).toBeTruthy();
  });

  it('starts streaming and applies progress updates', async () => {
    let progressHandler: (chunk: StreamingProgressChunk) => void = () => {};

    storyService.streamStoryGeneration.and.callFake((_input, onProgress) => {
      progressHandler = onProgress;
      return of({ success: true, data: createPayload() });
    });

    await component.startStreaming();

    expect(storyService.streamStoryGeneration).toHaveBeenCalled();
    expect(component.isStreaming).toBeFalse();
    expect(component.storyTitle).toContain('Midnight Tether');

    progressHandler({
      type: 'chapter_progress',
      chapterNumber: 1,
      partialHtml: '<p>Streaming content fragment.</p>',
      percentage: 40
    });

    expect(component.streamedContent).toContain('Streaming content fragment.');
    expect(component.progress.wordsGenerated).toBeGreaterThan(0);
  });
});
