/**
 * Real-Time Story Generation API - Server-Sent Events (SSE)
 * Created: 2025-01-10 21:30
 * 
 * Streams story generation progress and content chunks in real-time
 * Provides immediate feedback during ~21 second generation process
 */

import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam, StreamingStoryGenerationSeam } from '../lib/types/contracts';
import { logInfo, logError, logWarn } from '../lib/utils/logger';

const storyService = new StoryService();

/**
 * GET/POST /api/story/stream
 * Implements StreamingStoryGenerationSeam contract
 * Supports GET with query params for EventSource compatibility
 */
export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || 
                    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set CORS headers FIRST
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Request-ID');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    logWarn('Method not allowed', { requestId, endpoint: '/api/story/stream', method: req.method });
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET/POST allowed' }
    });
  }

  try {
    // Support both POST body and GET query params for EventSource compatibility
    let input: StoryGenerationSeam['input'];
    
    if (req.method === 'GET') {
      // Parse from query params for EventSource
      const { creature, themes, spicyLevel, wordCount, userInput } = req.query;
      input = {
        creature: creature as any,
        themes: themes ? (themes as string).split(',') as any[] : [],
        spicyLevel: parseInt(spicyLevel as string, 10) as any,
        wordCount: parseInt(wordCount as string, 10) as any,
        userInput: userInput as string || ''
      };
    } else {
      // POST body
      input = req.body;
    }

    // Validate input
    if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      logWarn('Invalid streaming input', { requestId, endpoint: '/api/story/stream' }, { receivedFields: Object.keys(input) });
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount' 
        }
      });
    }

    logInfo('Starting streaming story generation', {
      requestId,
      endpoint: '/api/story/stream',
      method: req.method,
      userInput: {
        creature: input.creature,
        themes: input.themes,
        spicyLevel: input.spicyLevel,
        wordCount: input.wordCount
      }
    });

    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('X-Request-ID', requestId);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control, X-API-Key, Authorization'
    });

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send initial connection message per contract
    const connectedUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
      streamId: streamId,
      type: 'connected',
      isComplete: false,
      metadata: {
        wordsGenerated: 0,
        totalWordsTarget: input.wordCount,
        estimatedWordsRemaining: input.wordCount,
        generationSpeed: 0,
        percentage: 0
      }
    };
    res.write(`data: ${JSON.stringify(connectedUpdate)}\\n\\n`);

    // Generate story with streaming per seam contract
    await storyService.generateStoryStreaming(input, (chunk) => {
      const progressUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
        streamId: streamId,
        storyId: `story_${streamId}`,
        type: chunk.isComplete ? 'complete' : 'chunk',
        content: chunk.content,
        isComplete: chunk.isComplete,
        metadata: {
          wordsGenerated: chunk.wordsGenerated,
          totalWordsTarget: input.wordCount,
          estimatedWordsRemaining: chunk.estimatedWordsRemaining,
          generationSpeed: chunk.generationSpeed,
          percentage: Math.min((chunk.wordsGenerated / input.wordCount) * 100, 100),
          estimatedTimeRemaining: chunk.estimatedWordsRemaining / Math.max(chunk.generationSpeed, 1)
        }
      };
      
      res.write(`data: ${JSON.stringify(progressUpdate)}\\n\\n`);
    });

    res.end();

  } catch (error: any) {
    logError('Streaming story generation failed', error, {
      requestId,
      endpoint: '/api/story/stream',
      method: 'POST',
      statusCode: 500
    });
    
    const errorUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
      streamId: 'error_stream',
      type: 'error',
      isComplete: true,
      metadata: {
        wordsGenerated: 0,
        totalWordsTarget: 0,
        estimatedWordsRemaining: 0,
        generationSpeed: 0,
        percentage: 0
      }
    };
    
    res.write(`data: ${JSON.stringify(errorUpdate)}\\n\\n`);
    res.end();
  }
}