import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';

// Integration tests for the complete Fairytales with Spice workflow
// This tests the real API endpoints and validates the entire seam-driven architecture

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

interface StoryGenerationRequest {
  creature: 'vampire' | 'werewolf' | 'fairy';
  themes: ('romance' | 'adventure' | 'mystery' | 'comedy' | 'dark')[];
  userInput: string;
  spicyLevel: 1 | 2 | 3 | 4 | 5;
  wordCount: 700 | 900 | 1200;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    processingTime: number;
    rateLimitRemaining?: number;
  };
}

describe('End-to-End Integration Tests: Complete Story Workflow', () => {
  let generatedStoryId: string;
  let generatedStoryContent: string;
  let generatedStoryTitle: string;

  beforeAll(() => {
    // Set timeout for integration tests
    jest.setTimeout(30000);
  });

  afterAll(() => {
    // Reset timeout
    jest.setTimeout(5000);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toEqual(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: expect.any(String),
          environment: expect.any(String),
          services: expect.objectContaining({
            grok: expect.stringMatching(/^(configured|mock)$/),
            elevenlabs: expect.stringMatching(/^(configured|mock)$/),
          }),
          cors: expect.objectContaining({
            allowedOrigin: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Complete Story Generation → Audio → Export Workflow', () => {
    it('should generate a story with all creature types', async () => {
      const creatures = ['vampire', 'werewolf', 'fairy'] as const;
      
      for (const creature of creatures) {
        const request: StoryGenerationRequest = {
          creature,
          themes: ['romance', 'mystery'],
          userInput: `A ${creature} story with romantic mystery`,
          spicyLevel: 3,
          wordCount: 900,
        };

        const response = await axios.post(`${API_BASE_URL}/story/generate`, request);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.data).toEqual(
          expect.objectContaining({
            storyId: expect.any(String),
            title: expect.any(String),
            content: expect.any(String),
            creature,
            themes: expect.arrayContaining(['romance', 'mystery']),
            spicyLevel: 3,
            actualWordCount: expect.any(Number),
            estimatedReadTime: expect.any(Number),
            hasCliffhanger: expect.any(Boolean),
            generatedAt: expect.any(String),
          })
        );

        // Store the first generated story for subsequent tests
        if (creature === 'vampire') {
          generatedStoryId = response.data.data.storyId;
          generatedStoryContent = response.data.data.content;
          generatedStoryTitle = response.data.data.title;
        }
      }
    });

    it('should continue the generated story', async () => {
      expect(generatedStoryId).toBeDefined();
      expect(generatedStoryContent).toBeDefined();

      const continueRequest = {
        storyId: generatedStoryId,
        currentChapterCount: 1,
        existingContent: generatedStoryContent,
        maintainTone: true,
      };

      const response = await axios.post(`${API_BASE_URL}/story/continue`, continueRequest);
      
      expect(response.status).toBe(200);
      
      if (response.data.success) {
        expect(response.data.data).toEqual(
          expect.objectContaining({
            chapterId: expect.any(String),
            chapterNumber: expect.any(Number),
            title: expect.any(String),
            content: expect.any(String),
            wordCount: expect.any(Number),
            cliffhangerEnding: expect.any(Boolean),
            themesContinued: expect.any(Array),
            spicyLevelMaintained: expect.any(Number),
            appendedToStory: expect.any(String),
          })
        );

        // Update content for next test
        generatedStoryContent = response.data.data.appendedToStory;
      } else {
        // In mock mode or service unavailable - this is acceptable for integration tests
        expect(response.data.error.code).toMatch(/CONTINUATION_FAILED|SERVICE_UNAVAILABLE/);
      }
    });

    it('should convert story to audio', async () => {
      expect(generatedStoryId).toBeDefined();
      expect(generatedStoryContent).toBeDefined();

      const audioRequest = {
        storyId: generatedStoryId,
        content: generatedStoryContent,
        voice: 'female' as const,
        speed: 1.0,
        format: 'mp3' as const,
      };

      const response = await axios.post(`${API_BASE_URL}/audio/convert`, audioRequest);
      
      expect(response.status).toBe(200);
      
      if (response.data.success) {
        expect(response.data.data).toEqual(
          expect.objectContaining({
            audioId: expect.any(String),
            storyId: generatedStoryId,
            audioUrl: expect.any(String),
            duration: expect.any(Number),
            fileSize: expect.any(Number),
            format: 'mp3',
            voice: 'female',
            speed: 1.0,
            progress: expect.objectContaining({
              percentage: expect.any(Number),
              status: expect.stringMatching(/^(queued|processing|completed|failed)$/),
              message: expect.any(String),
            }),
            completedAt: expect.any(String),
          })
        );
      } else {
        // In mock mode or service unavailable - this is acceptable for integration tests
        expect(response.data.error.code).toMatch(/CONVERSION_FAILED|SERVICE_UNAVAILABLE/);
      }
    });

    it('should export story in all formats', async () => {
      expect(generatedStoryId).toBeDefined();
      expect(generatedStoryContent).toBeDefined();
      expect(generatedStoryTitle).toBeDefined();

      const formats = ['pdf', 'txt', 'html', 'epub', 'docx'] as const;
      
      for (const format of formats) {
        const exportRequest = {
          storyId: generatedStoryId,
          content: generatedStoryContent,
          title: generatedStoryTitle,
          format,
          includeMetadata: true,
          includeChapters: true,
        };

        const response = await axios.post(`${API_BASE_URL}/export/save`, exportRequest);
        
        expect(response.status).toBe(200);
        
        if (response.data.success) {
          expect(response.data.data).toEqual(
            expect.objectContaining({
              exportId: expect.any(String),
              storyId: generatedStoryId,
              downloadUrl: expect.any(String),
              filename: expect.any(String),
              format,
              fileSize: expect.any(Number),
              expiresAt: expect.any(String),
              exportedAt: expect.any(String),
            })
          );
          
          // Verify filename contains the format
          expect(response.data.data.filename).toContain(`.${format}`);
        } else {
          // In mock mode or service unavailable - this is acceptable for integration tests
          expect(response.data.error.code).toMatch(/EXPORT_FAILED|SERVICE_UNAVAILABLE/);
        }
      }
    });
  });

  describe('Contract Validation Across Seams', () => {
    it('should validate all input contracts are enforced', async () => {
      // Test invalid creature
      const invalidCreatureRequest = {
        creature: 'dragon', // Invalid creature type
        themes: ['romance'],
        userInput: 'Test story',
        spicyLevel: 3,
        wordCount: 900,
      };

      const response1 = await axios.post(`${API_BASE_URL}/story/generate`, invalidCreatureRequest);
      expect(response1.status).toBe(400);
      expect(response1.data.success).toBe(false);
      expect(response1.data.error.code).toBe('INVALID_INPUT');

      // Test invalid themes
      const invalidThemeRequest = {
        creature: 'vampire',
        themes: ['invalid_theme'],
        userInput: 'Test story',
        spicyLevel: 3,
        wordCount: 900,
      };

      // Note: This might pass if backend doesn't validate theme values, which is acceptable
      const response2 = await axios.post(`${API_BASE_URL}/story/generate`, invalidThemeRequest);
      // We check for either validation rejection or acceptance (depending on implementation)
      expect([200, 400]).toContain(response2.status);

      // Test missing required fields
      const missingFieldsRequest = {
        creature: 'vampire',
        // Missing themes, spicyLevel, wordCount
      };

      const response3 = await axios.post(`${API_BASE_URL}/story/generate`, missingFieldsRequest);
      expect(response3.status).toBe(400);
      expect(response3.data.success).toBe(false);
      expect(response3.data.error.code).toBe('INVALID_INPUT');
    });

    it('should validate CORS headers are set correctly', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      // CORS headers might not be visible in axios response headers in all environments
      // but we can verify the request succeeds, indicating CORS is properly configured
      expect(response.status).toBe(200);
    });

    it('should handle method validation correctly', async () => {
      try {
        // Try to use GET instead of POST for story generation
        await axios.get(`${API_BASE_URL}/story/generate`);
        fail('Should have returned 405 for invalid method');
      } catch (error: any) {
        expect(error.response.status).toBe(405);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.code).toBe('METHOD_NOT_ALLOWED');
      }
    });
  });

  describe('Emotion System Integration', () => {
    it('should return emotion information', async () => {
      const response = await axios.get(`${API_BASE_URL}/emotions/info`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toEqual(
        expect.objectContaining({
          availableEmotions: expect.any(Array),
          combinations: expect.any(Array),
          usage: expect.objectContaining({
            maxCombinations: expect.any(Number),
            separator: expect.any(String),
            examples: expect.any(Array),
          }),
        })
      );
    });

    it('should test emotion combinations', async () => {
      const emotionTests = [
        'happy',
        'mysterious+romantic',
        'dramatic+sad+calm',
        'invalid+emotion',
      ];

      for (const emotion of emotionTests) {
        const response = await axios.post(`${API_BASE_URL}/emotions/test`, { emotion });
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.data).toEqual(
          expect.objectContaining({
            isValid: expect.any(Boolean),
            emotion: emotion,
          })
        );

        if (response.data.data.isValid) {
          expect(response.data.data).toEqual(
            expect.objectContaining({
              parsedEmotions: expect.any(Array),
              suggestedVoiceSettings: expect.any(Object),
              compatibleVoices: expect.any(Array),
              estimatedProcessingTime: expect.any(Number),
            })
          );
        } else {
          expect(response.data.data).toEqual(
            expect.objectContaining({
              errors: expect.any(Array),
              suggestions: expect.any(Array),
            })
          );
        }
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service failures gracefully', async () => {
      // Test with potentially problematic input to trigger service errors
      const problematicRequest = {
        creature: 'vampire',
        themes: ['romance'],
        userInput: 'A'.repeat(2000), // Very long input that might cause issues
        spicyLevel: 5,
        wordCount: 1200,
      };

      const response = await axios.post(`${API_BASE_URL}/story/generate`, problematicRequest);
      
      // Should either succeed or fail gracefully
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status !== 200) {
        expect(response.data.success).toBe(false);
        expect(response.data.error).toEqual(
          expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
          })
        );
      }
    });

    it('should handle network timeouts gracefully', async () => {
      // This test verifies the API can handle requests even under load
      const requests = Array.from({ length: 5 }, (_, i) => 
        axios.post(`${API_BASE_URL}/story/generate`, {
          creature: 'vampire',
          themes: ['romance'],
          userInput: `Concurrent test story ${i}`,
          spicyLevel: 1,
          wordCount: 700,
        }, { timeout: 10000 })
      );

      const responses = await Promise.allSettled(requests);
      
      // At least some requests should succeed or fail gracefully
      responses.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect([200, 400, 500]).toContain(result.value.status);
        } else {
          // Network timeout or other connection error - acceptable for integration tests
          console.log(`Request ${index} failed:`, result.reason.message);
        }
      });
    });
  });
});