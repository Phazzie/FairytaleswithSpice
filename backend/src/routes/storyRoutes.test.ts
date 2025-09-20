import request from 'supertest';
import express from 'express';
import { storyRoutes } from '../routes/storyRoutes';
import { ThemeType, CreatureType, SpicyLevel } from '../types/contracts';

// Create an app with mocked service
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', storyRoutes);
  return app;
}

// Mock the entire StoryService module
jest.mock('../services/storyService', () => {
  return {
    StoryService: jest.fn().mockImplementation(() => ({
      generateStory: jest.fn(),
      continueStory: jest.fn()
    }))
  };
});

import { StoryService } from '../services/storyService';
const MockStoryService = StoryService as jest.MockedClass<typeof StoryService>;

describe('Story Routes', () => {
  let app: express.Application;
  let mockStoryService: any;

  beforeEach(() => {
    app = createTestApp();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mock instance
    mockStoryService = new MockStoryService();
  });

  describe('POST /api/generate-story', () => {
    const validPayload = {
      creature: 'vampire' as CreatureType,
      themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
      userInput: 'Victorian setting',
      spicyLevel: 3 as SpicyLevel,
      wordCount: 900 as const
    };

    it('should generate story with valid payload', async () => {
      const mockResponse = {
        success: true,
        data: {
          storyId: 'story_123',
          title: "The Vampire's Forbidden Passion",
          content: '<h3>Test Story</h3><p>Content...</p>',
          creature: 'vampire' as CreatureType,
          themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
          spicyLevel: 3 as SpicyLevel,
          actualWordCount: 150,
          estimatedReadTime: 1,
          hasCliffhanger: false,
          generatedAt: new Date()
        },
        metadata: {
          requestId: 'req_123',
          processingTime: 2500
        }
      };

      mockStoryService.generateStory.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/generate-story')
        .send(validPayload)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockStoryService.generateStory).toHaveBeenCalledWith(validPayload);
    });

    it('should return 400 for missing creature', async () => {
      const invalidPayload = {
        themes: ['romance'],
        spicyLevel: 3,
        wordCount: 900
      };

      const response = await request(app)
        .post('/api/generate-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        }
      });

      expect(mockStoryService.generateStory).not.toHaveBeenCalled();
    });

    it('should return 400 for missing themes', async () => {
      const invalidPayload = {
        creature: 'vampire' as CreatureType,
        spicyLevel: 3 as SpicyLevel,
        wordCount: 900 as const
      };

      const response = await request(app)
        .post('/api/generate-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for invalid spicyLevel type', async () => {
      const invalidPayload = {
        creature: 'vampire' as CreatureType,
        themes: ['passion'] as ThemeType[],
        spicyLevel: 'hot', // Should be number
        wordCount: 900 as const
      };

      const response = await request(app)
        .post('/api/generate-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for missing wordCount', async () => {
      const invalidPayload = {
        creature: 'vampire' as CreatureType,
        themes: ['passion'] as ThemeType[],
        spicyLevel: 3 as SpicyLevel
      };

      const response = await request(app)
        .post('/api/generate-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should handle service errors gracefully', async () => {
      mockStoryService.generateStory.mockRejectedValueOnce(new Error('Service Error'));

      const response = await request(app)
        .post('/api/generate-story')
        .send(validPayload)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Story generation failed'
        }
      });
    });

    it('should handle service returning error response', async () => {
      const serviceErrorResponse = {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'AI service temporarily unavailable'
        },
        metadata: {
          requestId: 'req_123',
          processingTime: 1000
        }
      };

      mockStoryService.generateStory.mockResolvedValueOnce(serviceErrorResponse);

      const response = await request(app)
        .post('/api/generate-story')
        .send(validPayload)
        .expect(200);

      expect(response.body).toEqual(serviceErrorResponse);
    });

    it('should accept optional userInput', async () => {
      const payloadWithUserInput = {
        ...validPayload,
        userInput: 'Custom user ideas'
      };

      const mockResponse = {
        success: true,
        data: {
          storyId: 'story_123',
          title: "The Vampire's Forbidden Passion",
          content: '<h3>Test Story</h3>',
          creature: 'vampire' as CreatureType,
          themes: ['forbidden_love', 'dark_secrets'] as ThemeType[],
          spicyLevel: 3 as SpicyLevel,
          actualWordCount: 150,
          estimatedReadTime: 1,
          hasCliffhanger: false,
          generatedAt: new Date()
        },
        metadata: {
          requestId: 'req_123',
          processingTime: 2500
        }
      };

      mockStoryService.generateStory.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/generate-story')
        .send(payloadWithUserInput)
        .expect(200);

      expect(mockStoryService.generateStory).toHaveBeenCalledWith(payloadWithUserInput);
    });
  });

  describe('POST /api/continue-story', () => {
    const validPayload = {
      storyId: 'story_123',
      currentChapterCount: 1,
      existingContent: '<h3>Chapter 1</h3><p>Existing story content...</p>',
      userInput: 'Make it more intense',
      maintainTone: true
    };

    it('should continue story with valid payload', async () => {
      const mockResponse = {
        success: true,
        data: {
          chapterId: 'chapter_456',
          chapterNumber: 2,
          title: 'Chapter 2: The Deeper Shadows',
          content: '<h3>Chapter 2</h3><p>Continuation...</p>',
          wordCount: 120,
          cliffhangerEnding: true,
          themesContinued: ['forbidden_love', 'dark_secrets'] as ThemeType[],
          spicyLevelMaintained: 3 as SpicyLevel,
          appendedToStory: '<h3>Chapter 1</h3><p>Existing story content...</p>\n\n<hr>\n\n<h3>Chapter 2</h3><p>Continuation...</p>'
        },
        metadata: {
          requestId: 'req_456',
          processingTime: 3000
        }
      };

      mockStoryService.continueStory.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/continue-story')
        .send(validPayload)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockStoryService.continueStory).toHaveBeenCalledWith(validPayload);
    });

    it('should return 400 for missing storyId', async () => {
      const invalidPayload = {
        currentChapterCount: 1,
        existingContent: '<p>Content</p>',
        maintainTone: true
      };

      const response = await request(app)
        .post('/api/continue-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, currentChapterCount, existingContent'
        }
      });
    });

    it('should return 400 for invalid currentChapterCount type', async () => {
      const invalidPayload = {
        storyId: 'story_123',
        currentChapterCount: 'one', // Should be number
        existingContent: '<p>Content</p>',
        maintainTone: true
      };

      const response = await request(app)
        .post('/api/continue-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for missing existingContent', async () => {
      const invalidPayload = {
        storyId: 'story_123',
        currentChapterCount: 1,
        maintainTone: true
      };

      const response = await request(app)
        .post('/api/continue-story')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should handle service errors gracefully', async () => {
      mockStoryService.continueStory.mockRejectedValueOnce(new Error('Service Error'));

      const response = await request(app)
        .post('/api/continue-story')
        .send(validPayload)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Chapter continuation failed'
        }
      });
    });

    it('should accept payload without optional fields', async () => {
      const minimalPayload = {
        storyId: 'story_123',
        currentChapterCount: 1,
        existingContent: '<h3>Chapter 1</h3><p>Content...</p>'
        // userInput and maintainTone are optional
      };

      const mockResponse = {
        success: true,
        data: {
          chapterId: 'chapter_456',
          chapterNumber: 2,
          title: 'Chapter 2: The Deeper Shadows',
          content: '<h3>Chapter 2</h3><p>Continuation...</p>',
          wordCount: 120,
          cliffhangerEnding: true,
          themesContinued: ['passion'] as ThemeType[],
          spicyLevelMaintained: 3 as SpicyLevel,
          appendedToStory: '<h3>Chapter 1</h3><p>Content...</p>\n\n<hr>\n\n<h3>Chapter 2</h3><p>Continuation...</p>'
        },
        metadata: {
          requestId: 'req_456',
          processingTime: 3000
        }
      };

      mockStoryService.continueStory.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/continue-story')
        .send(minimalPayload)
        .expect(200);

      expect(mockStoryService.continueStory).toHaveBeenCalledWith(minimalPayload);
    });

    it('should handle service returning error response', async () => {
      const serviceErrorResponse = {
        success: false,
        error: {
          code: 'CONTINUATION_FAILED',
          message: 'Failed to continue story'
        },
        metadata: {
          requestId: 'req_456',
          processingTime: 2000
        }
      };

      mockStoryService.continueStory.mockResolvedValueOnce(serviceErrorResponse);

      const response = await request(app)
        .post('/api/continue-story')
        .send(validPayload)
        .expect(200);

      expect(response.body).toEqual(serviceErrorResponse);
    });
  });

  describe('JSON parsing', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/generate-story')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express handles JSON parsing errors
      expect(response.body).toBeDefined();
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/generate-story')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });
});