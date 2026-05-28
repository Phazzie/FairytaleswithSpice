/**
 * Real-Time Story Generation API - Server-Sent Events (SSE)
 * Created: 2025-01-10 21:30
 * 
 * Streams story generation progress and content chunks in real-time
 * Provides immediate feedback during ~21 second generation process
 */

import { StoryService } from '../_lib/services/storyService';
import { randomUUID } from 'node:crypto';
import { StoryGenerationSeam, StreamingStoryGenerationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';

const storyService = new StoryService();
const VALID_REQUESTED_CHAPTER_COUNTS = new Set([1, 2, 3]);

/**
 * GET/POST /api/story/stream
 * Implements StreamingStoryGenerationSeam contract
 * Supports GET with query params for EventSource compatibility
 */
export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || 
                    `req_${randomUUID()}`;
  
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
      const { creature, themes, spicyLevel, wordCount, userInput, requestedChapterCount } = req.query;
      const parsedRequestedChapterCount = requestedChapterCount
        ? Number.parseInt(requestedChapterCount as string, 10)
        : undefined;
      input = {
        creature: creature as any,
        themes: themes ? (themes as string).split(',') as any[] : [],
        spicyLevel: Number.parseInt(spicyLevel as string, 10) as any,
        wordCount: Number.parseInt(wordCount as string, 10) as any,
        userInput: userInput as string || '',
        requestedChapterCount: parsedRequestedChapterCount as any
      };
    } else {
      // POST body
      input = req.body;
    }

    // Validate input
    if (
      !input ||
      !input.creature ||
      !Array.isArray(input.themes) ||
      !Number.isInteger(input.spicyLevel) ||
      input.spicyLevel < 1 ||
      input.spicyLevel > 5 ||
      !Number.isInteger(input.wordCount) ||
      input.wordCount < 1
    ) {
      logWarn('Invalid streaming input', { requestId, endpoint: '/api/story/stream' }, { receivedFields: input ? Object.keys(input) : [] });
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Invalid or missing fields: creature, themes, spicyLevel, wordCount'
        }
      });
    }

    if (
      input.requestedChapterCount !== undefined &&
      !VALID_REQUESTED_CHAPTER_COUNTS.has(input.requestedChapterCount)
    ) {
      logWarn('Invalid requested chapter count', { requestId, endpoint: '/api/story/stream' }, {
        requestedChapterCount: input.requestedChapterCount
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'requestedChapterCount must be 1, 2, or 3'
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
        wordCount: input.wordCount,
        requestedChapterCount: input.requestedChapterCount
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

    const streamId = `stream_${randomUUID()}`;

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
