import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam } from '../lib/types/contracts';

export default async function handler(req: any, res: any) {
  // Set comprehensive CORS headers for Vercel deployment
  const allowedOrigins = [
    'http://localhost:4200',
    'https://fairytaleswithspice.vercel.app',
    'https://*.vercel.app'
  ];
  
  const origin = req.headers.origin;
  const isAllowedOrigin = allowedOrigins.some(allowed => 
    allowed === origin || 
    (allowed.includes('*') && origin?.endsWith('.vercel.app'))
  );

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : 'https://fairytaleswithspice.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
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
    const input: StoryGenerationSeam['input'] = req.body;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[${requestId}] Story generation request:`, input);

    // Validate required fields
    if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      console.error(`[${requestId}] Validation failed - missing fields`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        },
        metadata: { requestId }
      });
    }

    const storyService = new StoryService();
    const result = await storyService.generateStory(input);
    
    console.log(`[${requestId}] Story generation response:`, { success: result.success });
    res.status(200).json(result);

  } catch (error: any) {
    const requestId = `req_${Date.now()}_error`;
    console.error(`[${requestId}] Story generation serverless function error:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      },
      metadata: { requestId }
    });
  }
}