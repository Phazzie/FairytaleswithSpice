import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse
} from '@fairytales-with-spice/contracts';
import { AIService } from './ai/AIService';
import { StoryInputValidator } from '../lib/validation/StoryInputValidator';
import { generateChapterId, generateRequestId, generateStoryId } from '../lib/utils/id';
import { countWords, detectCliffhanger, extractSpicyLevelFromContent, extractThemesFromContent } from '../lib/utils/content';
import { generateChapterTitle, generateTitle } from '../lib/utils/title';

export class StoryService {
  private aiService: AIService;
  private validator: StoryInputValidator;

  constructor(aiService: AIService, validator: StoryInputValidator) {
    this.aiService = aiService;
    this.validator = validator;
  }

  async generateStory(input: StoryGenerationSeam['input']): Promise<ApiResponse<StoryGenerationSeam['output']>> {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      const validationError = this.validator.validate(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          metadata: { requestId, processingTime: Date.now() - startTime }
        };
      }

      const storyContent = await this.aiService.generateStoryContent(input);

      const output: StoryGenerationSeam['output'] = {
        storyId: generateStoryId(),
        title: generateTitle(input),
        content: storyContent,
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        actualWordCount: countWords(storyContent),
        estimatedReadTime: Math.ceil(countWords(storyContent) / 200),
        hasCliffhanger: detectCliffhanger(storyContent),
        generatedAt: new Date()
      };

      return {
        success: true,
        data: output,
        metadata: { requestId, processingTime: Date.now() - startTime }
      };

    } catch (error: any) {
      console.error('Story generation error:', error);
      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate story',
          details: error.message
        },
        metadata: { requestId, processingTime: Date.now() - startTime }
      };
    }
  }

  async continueStory(input: ChapterContinuationSeam['input']): Promise<ApiResponse<ChapterContinuationSeam['output']>> {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      const chapterContent = await this.aiService.generateChapterContent(input);

      const output: ChapterContinuationSeam['output'] = {
        chapterId: generateChapterId(),
        chapterNumber: input.currentChapterCount + 1,
        title: `Chapter ${input.currentChapterCount + 1}: ${generateChapterTitle(input)}`,
        content: chapterContent,
        wordCount: countWords(chapterContent),
        cliffhangerEnding: detectCliffhanger(chapterContent),
        themesContinued: extractThemesFromContent(input.existingContent),
        spicyLevelMaintained: extractSpicyLevelFromContent(input.existingContent),
        appendedToStory: input.existingContent + '\\n\\n<hr>\\n\\n' + chapterContent
      };

      return {
        success: true,
        data: output,
        metadata: { requestId, processingTime: Date.now() - startTime }
      };

    } catch (error: any) {
      console.error('Chapter continuation error:', error);
      return {
        success: false,
        error: {
          code: 'CONTINUATION_FAILED',
          message: 'Failed to continue story',
          details: error.message
        },
        metadata: { requestId, processingTime: Date.now() - startTime }
      };
    }
  }
}