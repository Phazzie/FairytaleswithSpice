import { StoryGenerationSeam, ChapterContinuationSeam } from '@fairytales-with-spice/contracts';

export interface AIService {
  generateStoryContent(input: StoryGenerationSeam['input']): Promise<string>;
  generateChapterContent(input: ChapterContinuationSeam['input']): Promise<string>;
}
