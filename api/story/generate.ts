import { StoryService } from '../lib/services/storyService';
import { StoryGenerationSeam } from '../lib/types/contracts';
import { setCorsHeaders, handlePreflight, validateMethod } from '../lib/utils/cors';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  setCorsHeaders(req, res);

  // Handle preflight OPTIONS request
  if (handlePreflight(req, res)) return;

  // Only allow POST requests
  if (!validateMethod(req, res, ['POST'])) return;

  try {
    const input: StoryGenerationSeam['input'] = req.body;

    // Validate required fields
    if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        }
      });
    }

    const storyService = new StoryService();
    const result = await storyService.generateStory(input);
    
    res.status(200).json(result);

  } catch (error: any) {
    console.error('Story generation serverless function error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
}