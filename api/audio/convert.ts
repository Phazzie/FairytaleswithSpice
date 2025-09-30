import { Router, Request, Response } from 'express';
import { AudioService } from '../lib/services/audioService';
import { AudioConversionSeam } from '@project/contracts';

const router = Router();
const audioService = new AudioService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: AudioConversionSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
    }

    const result = await audioService.convertToAudio(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Audio conversion API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
});

export default router;