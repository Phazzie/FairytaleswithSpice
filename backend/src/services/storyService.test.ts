import { StoryService } from '../services/storyService';
import { StoryGenerationSeam, ChapterContinuationSeam, ThemeType, CreatureType, SpicyLevel } from '../types/contracts';
import axios from 'axios';

// Mock axios to control API responses
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('StoryService', () => {
  let storyService: StoryService;

  beforeEach(() => {
    storyService = new StoryService();
    jest.clearAllMocks();
    // Clear environment variable for consistent testing
    delete process.env.XAI_API_KEY;
  });

  describe('generateStory', () => {
    const validInput: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['forbidden_love', 'dark_secrets'],
      userInput: 'Victorian setting',
      spicyLevel: 3,
      wordCount: 900
    };

    it('should generate story with valid input (mock mode)', async () => {
      const result = await storyService.generateStory(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.storyId).toMatch(/^story_\d+_.+/);
      expect(result.data!.title).toBe("The Vampire's Forbidden Passion");
      expect(result.data!.content).toContain('<h3>');
      expect(result.data!.content).toContain('<p>');
      expect(result.data!.creature).toBe('vampire');
      expect(result.data!.themes).toEqual(['forbidden_love', 'dark_secrets']);
      expect(result.data!.spicyLevel).toBe(3);
      expect(result.data!.actualWordCount).toBeGreaterThan(0);
      expect(result.data!.estimatedReadTime).toBeGreaterThan(0);
      expect(typeof result.data!.hasCliffhanger).toBe('boolean');
      expect(result.data!.generatedAt).toBeInstanceOf(Date);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.requestId).toMatch(/^req_\d+_.+/);
      expect(result.metadata!.processingTime).toBeGreaterThan(0);
    });

    it('should handle API mode with successful response', async () => {
      process.env.XAI_API_KEY = 'test-api-key';
      storyService = new StoryService(); // Recreate to pick up env var

      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: '<h3>AI Generated Story</h3><p>This is a test story from the AI service.</p>'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await storyService.generateStory(validInput);

      expect(result.success).toBe(true);
      expect(result.data!.content).toContain('AI Generated Story');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          model: 'grok-4-0709',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('DYNAMIC STYLE SELECTION')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('vampire')
            })
          ]),
          max_tokens: 1800, // wordCount * 2
          temperature: 0.8
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      process.env.XAI_API_KEY = 'test-api-key';
      storyService = new StoryService();

      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await storyService.generateStory(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('GENERATION_FAILED');
      expect(result.error!.message).toBe('Failed to generate story');
    });

    it('should validate invalid creature type', async () => {
      const invalidInput = {
        ...validInput,
        creature: 'dragon' as any
      };

      const result = await storyService.generateStory(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_INPUT');
      expect(result.error!.message).toBe('Invalid creature type');
    });

    it('should validate too many themes', async () => {
      const invalidInput = {
        ...validInput,
        themes: ['forbidden_love', 'dark_secrets', 'betrayal', 'obsession', 'power_dynamics', 'revenge'] as ThemeType[]
      };

      const result = await storyService.generateStory(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_INPUT');
      expect(result.error!.message).toContain('Too many themes');
    });

    it('should validate user input length', async () => {
      const invalidInput = {
        ...validInput,
        userInput: 'x'.repeat(1001) // Exceeds 1000 character limit
      };

      const result = await storyService.generateStory(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_INPUT');
      expect(result.error!.message).toContain('User input too long');
    });

    it('should handle all creature types correctly', async () => {
      const creatures: Array<StoryGenerationSeam['input']['creature']> = ['vampire', 'werewolf', 'fairy'];

      for (const creature of creatures) {
        const input = { ...validInput, creature };
        const result = await storyService.generateStory(input);

        expect(result.success).toBe(true);
        expect(result.data!.creature).toBe(creature);
        expect(result.data!.title).toContain(creature.charAt(0).toUpperCase() + creature.slice(1));
      }
    });

    it('should handle all spicy levels correctly', async () => {
      const spicyLevels: Array<StoryGenerationSeam['input']['spicyLevel']> = [1, 2, 3, 4, 5];

      for (const spicyLevel of spicyLevels) {
        const input = { ...validInput, spicyLevel };
        const result = await storyService.generateStory(input);

        expect(result.success).toBe(true);
        expect(result.data!.spicyLevel).toBe(spicyLevel);
      }
    });

    it('should handle all word counts correctly', async () => {
      const wordCounts: Array<StoryGenerationSeam['input']['wordCount']> = [700, 900, 1200];

      for (const wordCount of wordCounts) {
        const input = { ...validInput, wordCount };
        const result = await storyService.generateStory(input);

        expect(result.success).toBe(true);
        // Word count should be reasonably close to requested (within reasonable margin)
        expect(result.data!.actualWordCount).toBeGreaterThan(wordCount * 0.5);
        expect(result.data!.actualWordCount).toBeLessThan(wordCount * 2);
      }
    });
  });

  describe('continueStory', () => {
    const validInput: ChapterContinuationSeam['input'] = {
      storyId: 'story_123',
      currentChapterCount: 1,
      existingContent: '<h3>Chapter 1</h3><p>Existing story content...</p>',
      userInput: 'Make it more intense',
      maintainTone: true
    };

    it('should continue story with valid input (mock mode)', async () => {
      const result = await storyService.continueStory(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.chapterId).toMatch(/^chapter_\d+_.+/);
      expect(result.data!.chapterNumber).toBe(2);
      expect(result.data!.title).toBe('Chapter 2: The Deeper Shadows');
      expect(result.data!.content).toContain('<h3>');
      expect(result.data!.content).toContain('<p>');
      expect(result.data!.wordCount).toBeGreaterThan(0);
      expect(typeof result.data!.cliffhangerEnding).toBe('boolean');
      expect(Array.isArray(result.data!.themesContinued)).toBe(true);
      expect([1, 2, 3, 4, 5]).toContain(result.data!.spicyLevelMaintained);
      expect(result.data!.appendedToStory).toContain(validInput.existingContent);
      expect(result.data!.appendedToStory).toContain('<hr>');
    });

    it('should handle API mode for continuation', async () => {
      process.env.XAI_API_KEY = 'test-api-key';
      storyService = new StoryService();

      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: '<h3>Chapter 2: AI Continuation</h3><p>This is a continuation from AI.</p>'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await storyService.continueStory(validInput);

      expect(result.success).toBe(true);
      expect(result.data!.content).toContain('AI Continuation');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          model: 'grok-4-0709',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Continue this story')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Existing Story:')
            })
          ]),
          max_tokens: 1000,
          temperature: 0.8
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should handle continuation API errors', async () => {
      process.env.XAI_API_KEY = 'test-api-key';
      storyService = new StoryService();

      mockedAxios.post.mockRejectedValueOnce(new Error('Continuation API Error'));

      const result = await storyService.continueStory(validInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CONTINUATION_FAILED');
      expect(result.error!.message).toBe('Failed to continue story');
    });
  });

  describe('utility methods', () => {
    it('should count words correctly', async () => {
      const htmlContent = '<h3>Title</h3><p>This is a test paragraph with <em>emphasis</em>.</p>';
      const result = await storyService.generateStory({
        creature: 'vampire',
        themes: ['passion'],
        userInput: '',
        spicyLevel: 1,
        wordCount: 700
      });

      // The mock story should have a reasonable word count
      expect(result.data!.actualWordCount).toBeGreaterThan(10);
    });

    it('should detect cliffhangers', async () => {
      // This tests the cliffhanger detection indirectly through the service
      const result = await storyService.generateStory({
        creature: 'vampire',
        themes: ['passion'],
        userInput: 'end with a cliffhanger suddenly',
        spicyLevel: 1,
        wordCount: 700
      });

      expect(typeof result.data!.hasCliffhanger).toBe('boolean');
    });

    it('should generate unique IDs', async () => {
      const result1 = await storyService.generateStory({
        creature: 'vampire',
        themes: ['passion'],
        userInput: '',
        spicyLevel: 1,
        wordCount: 700
      });

      const result2 = await storyService.generateStory({
        creature: 'vampire',
        themes: ['passion'],
        userInput: '',
        spicyLevel: 1,
        wordCount: 700
      });

      expect(result1.data!.storyId).not.toBe(result2.data!.storyId);
      expect(result1.metadata!.requestId).not.toBe(result2.metadata!.requestId);
    });
  });

  describe('edge cases', () => {
    it('should handle empty user input', async () => {
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['passion'],
        userInput: '',
        spicyLevel: 1,
        wordCount: 700
      };

      const result = await storyService.generateStory(input);
      expect(result.success).toBe(true);
    });

    it('should handle minimal themes array', async () => {
      const input: StoryGenerationSeam['input'] = {
        creature: 'fairy',
        themes: ['desire'],
        userInput: 'test',
        spicyLevel: 1,
        wordCount: 700
      };

      const result = await storyService.generateStory(input);
      expect(result.success).toBe(true);
      expect(result.data!.themes).toEqual(['desire']);
    });

    it('should handle missing optional continuation input', async () => {
      const input: ChapterContinuationSeam['input'] = {
        storyId: 'story_123',
        currentChapterCount: 1,
        existingContent: '<p>Existing content</p>',
        maintainTone: true
        // userInput is optional
      };

      const result = await storyService.continueStory(input);
      expect(result.success).toBe(true);
    });
  });
});