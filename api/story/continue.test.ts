import continueHandler from '../story/continue';
import { TestDataFactory } from '../test-setup';

// Mock the StoryService
jest.mock('../lib/services/storyService', () => ({
  StoryService: jest.fn().mockImplementation(() => ({
    continueStory: jest.fn(),
  })),
}));

import { StoryService } from '../lib/services/storyService';

describe('API Route: /api/story/continue', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockStoryService: any;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      body: {},
      headers: { 'content-type': 'application/json' },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    mockStoryService = {
      continueStory: jest.fn(),
    };
    (StoryService as jest.MockedClass<typeof StoryService>).mockImplementation(
      () => mockStoryService
    );
  });

  describe('CORS handling', () => {
    it('should set proper CORS headers', async () => {
      mockRequest.body = TestDataFactory.createValidContinueRequest();
      mockStoryService.continueStory.mockResolvedValue({
        success: true,
        data: { chapterId: 'chapter-2', title: 'Chapter 2' },
      });

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:4200');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    });

    it('should handle OPTIONS preflight requests', async () => {
      mockRequest.method = 'OPTIONS';

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockStoryService.continueStory).not.toHaveBeenCalled();
    });
  });

  describe('Method validation', () => {
    it('should return 405 for non-POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await continueHandler(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(405);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST requests are allowed',
          },
        });
      }
    });
  });

  describe('Input validation', () => {
    it('should validate required fields - missing storyId', async () => {
      mockRequest.body = {
        currentChapterCount: 1,
        existingContent: '<h3>Chapter 1</h3><p>Content</p>',
      };

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, existingContent, currentChapterCount',
        },
      });
      expect(mockStoryService.continueStory).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing existingContent', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        currentChapterCount: 1,
      };

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.continueStory).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing currentChapterCount', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        existingContent: '<h3>Chapter 1</h3><p>Content</p>',
      };

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.continueStory).not.toHaveBeenCalled();
    });

    it('should validate currentChapterCount is a number', async () => {
      mockRequest.body = {
        storyId: 'story-123',
        existingContent: '<h3>Chapter 1</h3><p>Content</p>',
        currentChapterCount: 'invalid',
      };

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.continueStory).not.toHaveBeenCalled();
    });

    it('should accept valid input with all required fields', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue({
        success: true,
        data: { chapterId: 'chapter-2', title: 'Chapter 2' },
      });

      await continueHandler(mockRequest, mockResponse);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should accept valid input with optional fields', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest({
        userInput: 'Make it more mysterious',
        maintainTone: false,
      });
      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue({
        success: true,
        data: { chapterId: 'chapter-2', title: 'Chapter 2' },
      });

      await continueHandler(mockRequest, mockResponse);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Service integration', () => {
    it('should handle successful chapter continuation', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      const mockSuccessResponse = {
        success: true,
        data: {
          chapterId: 'chapter_456',
          chapterNumber: 2,
          title: 'Chapter 2: The Mystery Deepens',
          content: '<h3>Chapter 2</h3><p>The vampire librarian discovered something...</p>',
          wordCount: 654,
          cliffhangerEnding: true,
          themesContinued: ['romance', 'mystery'],
          spicyLevelMaintained: 3,
          appendedToStory: '<h3>Chapter 1</h3><p>Content...</p><h3>Chapter 2</h3><p>New content...</p>',
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue(mockSuccessResponse);

      await continueHandler(mockRequest, mockResponse);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should handle service failure responses', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'CONTINUATION_FAILED',
          message: 'Failed to continue story',
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue(mockErrorResponse);

      await continueHandler(mockRequest, mockResponse);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle story not found errors', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'STORY_NOT_FOUND',
          message: 'Story not found',
          storyId: validRequest.storyId,
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue(mockErrorResponse);

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle max chapters reached errors', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'MAX_CHAPTERS_REACHED',
          message: 'Maximum chapters reached',
          maxChapters: 10,
          currentChapters: 10,
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockResolvedValue(mockErrorResponse);

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle service throwing exceptions', async () => {
      const validRequest = TestDataFactory.createValidContinueRequest();
      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockRejectedValue(new Error('Service crashed'));

      await continueHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Chapter continuation failed',
        },
      });
    });
  });

  describe('Contract validation', () => {
    it('should pass through valid ChapterContinuationSeam input', async () => {
      const validInput = TestDataFactory.createValidContinueRequest();
      mockRequest.body = validInput;
      mockStoryService.continueStory.mockResolvedValue({ success: true, data: {} });

      await continueHandler(mockRequest, mockResponse);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validInput);
    });

    it('should handle various chapter counts', async () => {
      const chapterCounts = [1, 5, 9];
      
      for (const currentChapterCount of chapterCounts) {
        const validInput = TestDataFactory.createValidContinueRequest({ currentChapterCount });
        mockRequest.body = validInput;
        mockStoryService.continueStory.mockResolvedValue({ success: true, data: {} });

        await continueHandler(mockRequest, mockResponse);

        expect(mockStoryService.continueStory).toHaveBeenCalledWith(validInput);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should handle different content formats', async () => {
      const contentFormats = [
        '<h3>Chapter 1</h3><p>Simple content</p>',
        '<div><h3>Chapter 1: Title</h3><p>Content with <em>formatting</em></p></div>',
        '<h3>Chapter 1</h3><p>Multi</p><p>paragraph</p><p>content</p>',
      ];
      
      for (const existingContent of contentFormats) {
        const validInput = TestDataFactory.createValidContinueRequest({ existingContent });
        mockRequest.body = validInput;
        mockStoryService.continueStory.mockResolvedValue({ success: true, data: {} });

        await continueHandler(mockRequest, mockResponse);

        expect(mockStoryService.continueStory).toHaveBeenCalledWith(validInput);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const validRequest = TestDataFactory.createValidContinueRequest();
      const error = new Error('Test error');
      
      mockRequest.body = validRequest;
      mockStoryService.continueStory.mockRejectedValue(error);

      await continueHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Chapter continuation serverless function error:', error);
      
      consoleSpy.mockRestore();
    });
  });
});