import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { ImageService } from '../_lib/services/imageService.js';

const imageService = new ImageService();

export default async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: ['POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: { 
        code: 'METHOD_NOT_ALLOWED', 
        message: 'Only POST requests are allowed' 
      } 
    });
  }

  try {
    const result = await imageService.generateImage(req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Image generation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during image generation'
      }
    });
  }
}
