import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam } from '../lib/types/contracts';
import { logInfo, logError, logWarn } from '../lib/utils/logger';

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
    logWarn('Method not allowed', { requestId, endpoint: '/api/story/generate', method: req.method });
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

  try {
    console.log(`[${requestId}] POST /api/story/generate - Request received`);
    
    const input: StoryGenerationSeam['input'] = req.body;

    // Validate required fields
    if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/story/generate',
        method: 'POST'
      }, { receivedFields: Object.keys(input) });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        }
      });
    }

    logInfo('Story generation endpoint called', {
      requestId,
      endpoint: '/api/story/generate',
      method: 'POST',
      userInput: {
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        wordCount: input.wordCount
      }
    });

    const storyService = new StoryService();
    const result = await storyService.generateStory(input);
    
    console.log(`[${requestId}] Story generation ${result.success ? 'succeeded' : 'failed'}`);
    res.status(200).json(result);

  } catch (error: any) {
<<<<<<< HEAD
    logError('Story generation endpoint error', error, {
      requestId,
      endpoint: '/api/story/generate',
      method: 'POST',
      statusCode: 500
    });
    
=======
    console.error(`[${requestId}] Story generation serverless function error:`, error);
>>>>>>> c07c20875b1643c77ba40490b75daf80504c0651
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
}