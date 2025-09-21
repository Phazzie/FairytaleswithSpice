import express from 'express';
import { IAudioService } from '../services/audioService';
import { AudioConversionSeam } from '@fairytales-with-spice/contracts';

export const audioRoutes = (audioService: IAudioService) => {
  const router = express.Router();

  router.post('/convert-audio', async (req, res) => {
    try {
      const input: AudioConversionSeam['input'] = req.body;

      if (!input.storyId || !input.content) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: storyId, content'
          }
        });
      }

      const result = await audioService.convertToAudio(input);
      res.json(result);

    } catch (error: any) {
      console.error('Audio conversion route error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Audio conversion failed'
        }
      });
    }
  });

  return router;
};