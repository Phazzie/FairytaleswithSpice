import { Router, Request, Response } from 'express';
import { StoryService } from '../lib/services/storyService';
import { ChapterContinuationSeam } from '@project/contracts';

const router = Router();
const storyService = new StoryService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: ChapterContinuationSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.existingContent || typeof input.currentChapterCount !== 'number') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, existingContent, currentChapterCount'
        }
      });
    }

    const result = await storyService.continueChapter(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Chapter continuation API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Chapter continuation failed'
      }
    });
  }
});

export default router;