import { Router, Request, Response } from 'express';
import { StoryService } from '../lib/services/storyService';
import { StreamingStoryGenerationSeam } from '@project/contracts';

const router = Router();
const storyService = new StoryService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const input: StreamingStoryGenerationSeam['input'] = req.body;

    if (!input.creature || !input.themes || !input.spicyLevel || !input.wordCount) {
      console.error('Invalid input for stream:', input);
      return res.status(400).end('Invalid input');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
    res.write(`data: ${JSON.stringify(connectedUpdate)}\n\n`);

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
      
      res.write(`data: ${JSON.stringify(progressUpdate)}\n\n`);
    });

    return res.end();

  } catch (error: any) {
    console.error('Streaming generation API error:', error);
    
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
    
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: { code: 'STREAM_SETUP_FAILED', message: (error as Error).message }});
    } else {
      res.write(`data: ${JSON.stringify(errorUpdate)}\n\n`);
      return res.end();
    }
  }
});

export default router;