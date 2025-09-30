import { Router, Request, Response } from 'express';
import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam } from '@project/contracts';

const router = Router();
const storyService = new StoryService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: StoryGenerationSeam['input'] = req.body;

    // Validate required fields
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
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Story generation API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
});

export default router;