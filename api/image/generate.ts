import { Router, Request, Response } from 'express';
import { ImageService } from '../lib/services/imageService';
import { ImageGenerationSeam } from '@project/contracts';

const router = Router();
const imageService = new ImageService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: ImageGenerationSeam['input'] = req.body;
    const result = await imageService.generateImage(input);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Image generation API error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during image generation'
      }
    });
  }
});

export default router;