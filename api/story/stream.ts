/**
 * Streaming Story Generation API
 * Real-time text streaming for better UX during AI generation
 */

import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam } from '../lib/types/contracts';

const storyService = new StoryService();

/**
 * POST /api/story/stream
 * Streams story generation in real-time chunks
 */
export default async function handler(req: any, res: any) {
  // Set CORS headers
  const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
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
    const input: StoryGenerationSeam['input'] = req.body;

    // Validate input
    if (!input.creature || !input.themes || !input.spicyLevel || !input.wordCount) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' }
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write('data: {"type": "connected", "message": "Story generation started"}\\n\\n');

    // Generate story with streaming
    const storyId = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await storyService.generateStoryStreaming(input, (chunk) => {
      // Send each chunk as it's generated
      const data = {
        type: 'chunk',
        storyId: storyId,
        content: chunk.content,
        isComplete: chunk.isComplete,
        metadata: {
          wordsGenerated: chunk.wordsGenerated,
          estimatedWordsRemaining: chunk.estimatedWordsRemaining,
          generationSpeed: chunk.generationSpeed // words per second
        }
      };
      
      res.write(`data: ${JSON.stringify(data)}\\n\\n`);
    });

    // Send completion message
    res.write('data: {"type": "complete", "message": "Story generation complete"}\\n\\n');
    res.end();

  } catch (error: any) {
    console.error('Streaming generation error:', error);
    
    const errorData = {
      type: 'error',
      error: {
        code: 'STREAMING_FAILED',
        message: 'Story generation failed',
        details: error.message
      }
    };
    
    res.write(`data: ${JSON.stringify(errorData)}\\n\\n`);
    res.end();
  }
}