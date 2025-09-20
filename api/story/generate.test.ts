import generateHandler from '../story/generate';
import { TestDataFactory } from '../test-setup';

// Mock the StoryService to avoid external API calls
jest.mock('../lib/services/storyService', () => ({
  StoryService: jest.fn().mockImplementation(() => ({
    generateStory: jest.fn(),
  })),
}));

import { StoryService } from '../lib/services/storyService';

describe('API Route: /api/story/generate', () => {
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

    // Reset mocks
    jest.clearAllMocks();
    mockStoryService = {
      generateStory: jest.fn(),
    };
    (StoryService as jest.MockedClass<typeof StoryService>).mockImplementation(
      () => mockStoryService
    );
  });

  describe('CORS handling', () => {
    it('should set proper CORS headers', async () => {
      mockRequest.body = TestDataFactory.createValidStoryRequest();
      mockStoryService.generateStory.mockResolvedValue({
        success: true,
        data: { storyId: 'test-123', title: 'Test', content: 'Content' },
      });

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:4200');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    });

    it('should handle OPTIONS preflight requests', async () => {
      mockRequest.method = 'OPTIONS';

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should use custom FRONTEND_URL when set', async () => {
      process.env.FRONTEND_URL = 'https://custom.domain.com';
      mockRequest.body = TestDataFactory.createValidStoryRequest();
      mockStoryService.generateStory.mockResolvedValue({ success: true, data: {} });

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://custom.domain.com');

      delete process.env.FRONTEND_URL;
    });
  });

  describe('Method validation', () => {
    it('should return 405 for non-POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockRequest.method = method;
        await generateHandler(mockRequest, mockResponse);

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
    it('should validate required fields - missing creature', async () => {
      mockRequest.body = {
        themes: ['romance'],
        spicyLevel: 3,
        wordCount: 900,
      };

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount',
        },
      });
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing themes', async () => {
      mockRequest.body = {
        creature: 'vampire',
        spicyLevel: 3,
        wordCount: 900,
      };

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing spicyLevel', async () => {
      mockRequest.body = {
        creature: 'vampire',
        themes: ['romance'],
        wordCount: 900,
      };

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should validate required fields - missing wordCount', async () => {
      mockRequest.body = {
        creature: 'vampire',
        themes: ['romance'],
        spicyLevel: 3,
      };

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should validate spicyLevel is a number', async () => {
      mockRequest.body = {
        creature: 'vampire',
        themes: ['romance'],
        spicyLevel: 'invalid',
        wordCount: 900,
      };

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should accept valid input with all creature types', async () => {
      const creatures = ['vampire', 'werewolf', 'fairy'];
      
      for (const creature of creatures) {
        const validRequest = TestDataFactory.createValidStoryRequest({ creature });
        mockRequest.body = validRequest;
        mockStoryService.generateStory.mockResolvedValue({
          success: true,
          data: { storyId: 'test-123', title: 'Test', content: 'Content' },
        });

        await generateHandler(mockRequest, mockResponse);

        expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept valid input with all theme combinations', async () => {
      const themes = [['romance'], ['adventure', 'mystery'], ['comedy', 'dark', 'romance']];
      
      for (const themeSet of themes) {
        const validRequest = TestDataFactory.createValidStoryRequest({ themes: themeSet });
        mockRequest.body = validRequest;
        mockStoryService.generateStory.mockResolvedValue({
          success: true,
          data: { storyId: 'test-123', title: 'Test', content: 'Content' },
        });

        await generateHandler(mockRequest, mockResponse);

        expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept valid input with all spicy levels', async () => {
      const spicyLevels = [1, 2, 3, 4, 5];
      
      for (const spicyLevel of spicyLevels) {
        const validRequest = TestDataFactory.createValidStoryRequest({ spicyLevel });
        mockRequest.body = validRequest;
        mockStoryService.generateStory.mockResolvedValue({
          success: true,
          data: { storyId: 'test-123', title: 'Test', content: 'Content' },
        });

        await generateHandler(mockRequest, mockResponse);

        expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });

    it('should accept valid input with all word counts', async () => {
      const wordCounts = [700, 900, 1200];
      
      for (const wordCount of wordCounts) {
        const validRequest = TestDataFactory.createValidStoryRequest({ wordCount });
        mockRequest.body = validRequest;
        mockStoryService.generateStory.mockResolvedValue({
          success: true,
          data: { storyId: 'test-123', title: 'Test', content: 'Content' },
        });

        await generateHandler(mockRequest, mockResponse);

        expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe('Service integration', () => {
    it('should handle successful story generation', async () => {
      const validRequest = TestDataFactory.createValidStoryRequest();
      const mockSuccessResponse = {
        success: true,
        data: {
          storyId: 'story_123',
          title: 'The Vampire Librarian',
          content: '<h3>Chapter 1</h3><p>Story content...</p>',
          creature: 'vampire',
          themes: ['romance', 'mystery'],
          spicyLevel: 3,
          actualWordCount: 897,
          estimatedReadTime: 4,
          hasCliffhanger: true,
          generatedAt: new Date(),
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.generateStory.mockResolvedValue(mockSuccessResponse);

      await generateHandler(mockRequest, mockResponse);

      expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should handle service failure responses', async () => {
      const validRequest = TestDataFactory.createValidStoryRequest();
      const mockErrorResponse = {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'AI service temporarily unavailable',
        },
      };

      mockRequest.body = validRequest;
      mockStoryService.generateStory.mockResolvedValue(mockErrorResponse);

      await generateHandler(mockRequest, mockResponse);

      expect(mockStoryService.generateStory).toHaveBeenCalledWith(validRequest);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockErrorResponse);
    });

    it('should handle service throwing exceptions', async () => {
      const validRequest = TestDataFactory.createValidStoryRequest();
      mockRequest.body = validRequest;
      mockStoryService.generateStory.mockRejectedValue(new Error('Service crashed'));

      await generateHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Story generation failed',
        },
      });
    });
  });

  describe('Contract validation', () => {
    it('should pass through valid StoryGenerationSeam input', async () => {
      const validInput = TestDataFactory.createValidStoryRequest({
        userInput: 'Custom story idea about magical libraries',
      });
      mockRequest.body = validInput;
      mockStoryService.generateStory.mockResolvedValue({ success: true, data: {} });

      await generateHandler(mockRequest, mockResponse);

      expect(mockStoryService.generateStory).toHaveBeenCalledWith(validInput);
    });

    it('should handle optional userInput field', async () => {
      const inputWithoutUserInput = TestDataFactory.createValidStoryRequest();
      delete inputWithoutUserInput.userInput;
      mockRequest.body = inputWithoutUserInput;
      mockStoryService.generateStory.mockResolvedValue({ success: true, data: {} });

      await generateHandler(mockRequest, mockResponse);

      expect(mockStoryService.generateStory).toHaveBeenCalledWith(inputWithoutUserInput);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error logging', () => {
    it('should log errors when service throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const validRequest = TestDataFactory.createValidStoryRequest();
      const error = new Error('Test error');
      
      mockRequest.body = validRequest;
      mockStoryService.generateStory.mockRejectedValue(error);

      await generateHandler(mockRequest, mockResponse);

      expect(consoleSpy).toHaveBeenCalledWith('Story generation serverless function error:', error);
      
      consoleSpy.mockRestore();
    });
  });
});