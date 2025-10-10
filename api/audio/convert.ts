import { AudioService } from '../lib/services/audioService';
import { AudioConversionSeam } from '../lib/types/contracts';
import { logInfo, logError, logWarn } from '../lib/utils/logger';

export default async function handler(req: any, res: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set CORS headers
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
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
    logWarn('Method not allowed', { requestId, endpoint: '/api/audio/convert', method: req.method });
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

  try {
    const input: AudioConversionSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.content) {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/audio/convert',
        method: 'POST'
      }, { receivedFields: Object.keys(input) });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
    }

    logInfo('Audio conversion endpoint called', {
      requestId,
      endpoint: '/api/audio/convert',
      method: 'POST',
      userInput: {
        storyId: input.storyId,
        voice: input.voice,
        format: input.format,
        contentLength: input.content.length
      }
    });

    const audioService = new AudioService();
    const result = await audioService.convertToAudio(input);
    
    res.status(200).json(result);

  } catch (error: any) {
    logError('Audio conversion endpoint error', error, {
      requestId,
      endpoint: '/api/audio/convert',
      method: 'POST',
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
}