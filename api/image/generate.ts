import { ImageService } from '../lib/services/imageService.js';

const imageService = new ImageService();

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env['FRONTEND_URL'] || 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
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