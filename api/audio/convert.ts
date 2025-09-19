import { AudioService } from '../lib/services/audioService';
import { AudioConversionSeam } from '../lib/types/contracts';
import { setCorsHeaders, handlePreflight, validateMethod } from '../lib/utils/cors';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (handlePreflight(req, res)) return;

  // Only allow POST requests
  if (!validateMethod(req, res, ['POST'])) return;

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

    const audioService = new AudioService();
    const result = await audioService.convertToAudio(input);
    
    res.status(200).json(result);

  } catch (error: any) {
    console.error('Audio conversion serverless function error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
}