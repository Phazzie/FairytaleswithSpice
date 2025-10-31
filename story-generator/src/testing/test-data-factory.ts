import { ApiResponse, StoryGenerationSeam, StreamingProgressChunk } from '../app/contracts';

type StoryInput = StoryGenerationSeam['input'];
type StoryOutput = StoryGenerationSeam['output'];

export function createMockStoryInput(overrides: Partial<StoryInput> = {}): StoryInput {
  return {
    creature: 'vampire',
    themes: ['forbidden_love'],
    userInput: 'A moonlit encounter near the ruins.',
    spicyLevel: 3,
    wordCount: 900,
    ...overrides
  } as StoryInput;
}

export function createMockStoryResponse(
  dataOverrides: Partial<StoryOutput> = {},
  responseOverrides: Partial<Omit<ApiResponse<StoryOutput>, 'data'>> = {}
): ApiResponse<StoryOutput> {
  const baseData: StoryOutput = {
    storyId: 'story_123',
    title: 'Mock Story',
    content: '<h3>Chapter 1</h3><p>Mock content</p>',
    rawContent: '<h3>Chapter 1</h3><p>Mock content</p>',
    creature: 'vampire',
    themes: ['forbidden_love'],
    spicyLevel: 3,
    actualWordCount: 150,
    estimatedReadTime: 1,
    hasCliffhanger: false,
    generatedAt: new Date()
  };

  const mergedData = { ...baseData, ...dataOverrides };

  if (mergedData.generatedAt && !(mergedData.generatedAt instanceof Date)) {
    mergedData.generatedAt = new Date(mergedData.generatedAt);
  }

  const baseResponse: ApiResponse<StoryOutput> = {
    success: true,
    data: mergedData,
    metadata: { requestId: 'req_mock', processingTime: 1000 }
  };

  const mergedMetadata = responseOverrides.metadata
    ? { ...baseResponse.metadata, ...responseOverrides.metadata }
    : baseResponse.metadata;

  return {
    ...baseResponse,
    ...responseOverrides,
    data: mergedData,
    metadata: mergedMetadata
  };
}

export function createMockProgressChunk(
  typeOrOverrides: StreamingProgressChunk['type'] | Partial<StreamingProgressChunk> = 'chunk',
  overrides: Partial<StreamingProgressChunk> = {}
): StreamingProgressChunk {
  const baseMetadata = {
    wordsGenerated: 120,
    estimatedWordsRemaining: 780,
    generationSpeed: 20,
    percentage: 15
  };

  const base: StreamingProgressChunk = {
    type: 'chunk',
    content: '<p>Chunk</p>',
    storyId: 'story_123',
    streamId: 'stream_123',
    metadata: baseMetadata
  };

  const mergedOverrides = typeof typeOrOverrides === 'string'
    ? { ...overrides, type: typeOrOverrides }
    : { ...typeOrOverrides };

  const metadata = {
    wordsGenerated: mergedOverrides.metadata?.wordsGenerated ?? baseMetadata.wordsGenerated,
    estimatedWordsRemaining: mergedOverrides.metadata?.estimatedWordsRemaining ?? baseMetadata.estimatedWordsRemaining,
    generationSpeed: mergedOverrides.metadata?.generationSpeed ?? baseMetadata.generationSpeed,
    percentage: mergedOverrides.metadata?.percentage ?? baseMetadata.percentage
  };

  return {
    ...base,
    ...mergedOverrides,
    metadata
  };
}

export function createSSEMessage(data: any): MessageEvent {
  return new MessageEvent('message', {
    data: JSON.stringify(data)
  });
}
