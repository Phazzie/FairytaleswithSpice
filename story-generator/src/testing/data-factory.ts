import {
  StoryGenerationSeam,
  Chapter,
  StreamingProgressChunk,
  ApiResponse
} from '../app/contracts';

function defaultChapter(overrides: Partial<Chapter> = {}): Chapter {
  const generatedAt = overrides.generatedAt ?? new Date();
  return {
    chapterId: overrides.chapterId ?? 'chapter_1',
    chapterNumber: overrides.chapterNumber ?? 1,
    title: overrides.title ?? 'Mock Chapter',
    content: overrides.content ?? '<h3>Mock Chapter</h3><p>Content...</p>',
    rawContent: overrides.rawContent ?? '<h3>Mock Chapter</h3><p>Content...</p>',
    wordCount: overrides.wordCount ?? 900,
    generatedAt,
    hasAudio: overrides.hasAudio ?? false,
    audioUrl: overrides.audioUrl,
    audioDuration: overrides.audioDuration,
    cliffhangerEnding: overrides.cliffhangerEnding ?? false,
    nextChapterHint: overrides.nextChapterHint
  };
}

export function createMockStoryInput(
  overrides: Partial<StoryGenerationSeam['input']> = {}
): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: ['forbidden_love'],
    userInput: 'A moonlit encounter',
    spicyLevel: 3,
    wordCount: 900,
    requestedChapterCount: 1,
    ...overrides
  } as StoryGenerationSeam['input'];
}

export function createMockStoryOutput(
  overrides: Partial<StoryGenerationSeam['output']> = {}
): StoryGenerationSeam['output'] {
  const chapters = overrides.chapters ?? [defaultChapter(overrides as Partial<Chapter>)];
  const totalWordCount =
    overrides.totalWordCount ?? chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  const generatedAt = overrides.generatedAt ?? chapters[0]?.generatedAt ?? new Date();

  return {
    storyId: overrides.storyId ?? 'story_123',
    title: overrides.title ?? chapters[0]?.title ?? 'Mock Story',
    chapters,
    creature: overrides.creature ?? 'vampire',
    themes: overrides.themes ?? ['forbidden_love'],
    spicyLevel: overrides.spicyLevel ?? 3,
    totalWordCount,
    estimatedReadTime: overrides.estimatedReadTime ?? Math.ceil(totalWordCount / 200),
    hasCliffhanger:
      overrides.hasCliffhanger ?? chapters.some(chapter => chapter.cliffhangerEnding === true),
    appendedToStory:
      overrides.appendedToStory ?? chapters.map(chapter => chapter.content).join(''),
    nextChapterHint: overrides.nextChapterHint ?? chapters.find(ch => ch.nextChapterHint)?.nextChapterHint,
    generatedAt,
    chapterErrors: overrides.chapterErrors
  };
}

export function createMockStoryResponse(
  overrides: Partial<StoryGenerationSeam['output']> = {}
): ApiResponse<StoryGenerationSeam['output']> {
  return {
    success: true,
    data: createMockStoryOutput(overrides)
  };
}

export function createMockProgressChunk(
  type: StreamingProgressChunk['type'],
  data: Partial<StreamingProgressChunk> = {}
): StreamingProgressChunk {
  return {
    type,
    storyId: data.storyId ?? 'story_123',
    streamId: data.streamId ?? 'stream_123',
    content: data.content,
    metadata:
      data.metadata ?? {
        wordsGenerated: 150,
        totalWordsTarget: 900,
        estimatedWordsRemaining: 750,
        generationSpeed: 50,
        percentage: 10
      }
  };
}

export function createSSEMessage(payload: any): MessageEvent {
  return {
    data: JSON.stringify(payload)
  } as MessageEvent;
}

