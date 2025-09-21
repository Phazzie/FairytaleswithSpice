import express from 'express';
import { StoryService } from '../services/storyService';
import { StoryGenerationSeam, ChapterContinuationSeam } from '@fairytales-with-spice/contracts';

export const storyRoutes = (storyService: StoryService) => {
  const router = express.Router();

  // POST /api/generate-story
  router.post('/generate-story', async (req, res) => {
    try {
      const input: StoryGenerationSeam['input'] = req.body;

      // Basic validation can remain here, or be moved to a middleware
      if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
          }
        });
      }

      const result = await storyService.generateStory(input);
      res.json(result);

    } catch (error: any) {
      console.error('Story generation route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Story generation failed'
        }
      });
    }
  });

  // POST /api/continue-story
  router.post('/continue-story', async (req, res) => {
    try {
      const input: ChapterContinuationSeam['input'] = req.body;

      if (!input.storyId || typeof input.currentChapterCount !== 'number' || !input.existingContent) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: storyId, currentChapterCount, existingContent'
          }
        });
      }

      const result = await storyService.continueStory(input);
      res.json(result);

    } catch (error: any) {
      console.error('Chapter continuation route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Chapter continuation failed'
        }
      });
    }
  });

  return router;
};