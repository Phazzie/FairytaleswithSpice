import { AudioService } from '../lib/services/audioService';
import { AudioConversionSeam } from '../lib/types/contracts';

export default async function handler(req: any, res: any) {
  // Generate or extract request ID for tracking
  const requestId = req.headers['x-request-id'] || 
                    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set request ID in response header for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  // Set CORS headers
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Request-ID'
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
    console.log(`[${requestId}] POST /api/audio/convert - Request received`);
    
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

    // Validate content length (max 500KB)
    const MAX_CONTENT_LENGTH = FILE_SIZE.MAX_CONTENT_LENGTH_KB * 1000;
    if (input.content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          message: `Content exceeds maximum size of ${FILE_SIZE.MAX_CONTENT_LENGTH_KB}KB`,
          contentLength: input.content.length,
          maxLength: MAX_CONTENT_LENGTH
        }
      });
    }

    const audioService = new AudioService();
    const result = await audioService.convertToAudio(input);
    
    console.log(`[${requestId}] Audio conversion ${result.success ? 'succeeded' : 'failed'}`);
    res.status(200).json(result);

  } catch (error: any) {
    console.error(`[${requestId}] Audio conversion serverless function error:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
}