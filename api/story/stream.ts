/**
 * Real-Time Story Generation API - SEAM DRIVEN IMPLEMENTATION
 * Implements StreamingStoryGenerationSeam contract for real-time story updates
 */

import { StoryService } from '../lib/services/storyService';
import { StreamingStoryGenerationSeam, ApiResponse } from '../lib/types/contracts';

const storyService = new StoryService();

/**
 * POST /api/story/stream
 * Implements StreamingStoryGenerationSeam contract
 */
export default async function handler(req: any, res: any) {
  // Set CORS headers
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' }
    });
  }

  try {
    const input: StreamingStoryGenerationSeam['input'] = req.body;

    // Validate input against contract
    if (!input.creature || !input.themes || !input.spicyLevel || !input.wordCount) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_INPUT', 
          message: 'Missing required fields as defined in StreamingStoryGenerationSeam contract' 
        }
      } as ApiResponse<never>);
    }

    // Set up Server-Sent Events with proper CORS
    const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
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
    console.error('Streaming generation error:', error);
    
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