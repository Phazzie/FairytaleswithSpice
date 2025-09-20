import { AudiobookService } from '../lib/services/audiobookService';
import { AudiobookCompilationSeam } from '../lib/types/contracts';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
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
    const input: AudiobookCompilationSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyArcId || !input.chapterIds || input.chapterIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyArcId, chapterIds'
        }
      });
    }

    const audiobookService = new AudiobookService();
    const result = await audiobookService.compileAudiobook(input);
    
    res.status(200).json(result);

  } catch (error: any) {
    console.error('Audiobook compilation serverless function error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audiobook compilation failed'
      }
    });
  }
}