import {
  StoryGenerationSeam,
  ChapterContinuationSeam,
  ApiResponse
} from '@fairytales-with-spice/contracts';
import { AIService } from './ai/AIService';
import { StoryInputValidator } from '../lib/validation/StoryInputValidator';
import { generateRequestId, generateStoryId } from '../lib/utils/id';
import { countWords, detectCliffhanger } from '../lib/utils/content';
import { generateTitle } from '../lib/utils/title';
import { Story } from '../lib/domain/Story';

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
      const story = new Story(
        generateStoryId(),
        generateTitle(input),
        input.creature,
        input.themes,
        input.spicyLevel,
        storyContent
      );

      const output: StoryGenerationSeam['output'] = {
        storyId: story.id,
        title: story.title,
        content: story.fullContent,
        creature: story.creature,
        themes: story.themes,
        spicyLevel: story.spicyLevel,
        actualWordCount: countWords(story.fullContent),
        estimatedReadTime: Math.ceil(countWords(story.fullContent) / 200),
        hasCliffhanger: detectCliffhanger(story.fullContent),
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

    // In a real application, we would fetch the story from a database
    // For now, we will just create a new story object from the input
    const story = new Story(
      input.storyId,
      'A continuing story', // This should be fetched from the database
      'vampire', // This should be fetched from the database
      [], // This should be fetched from the database
      3, // This should be fetched from the database
      input.existingContent
    );

    try {
      const chapterContent = await this.aiService.generateChapterContent(input);
      const newChapter = story.addChapter(`Chapter ${story.chapters.length + 1}`, chapterContent);

      const output: ChapterContinuationSeam['output'] = {
        chapterId: newChapter.chapterNumber.toString(), // This should be a real ID
        chapterNumber: newChapter.chapterNumber,
        title: newChapter.title,
        content: newChapter.content,
        wordCount: countWords(newChapter.content),
        cliffhangerEnding: detectCliffhanger(newChapter.content),
        themesContinued: story.themes,
        spicyLevelMaintained: story.spicyLevel,
        appendedToStory: story.fullContent
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