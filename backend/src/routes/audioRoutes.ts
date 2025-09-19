import express from 'express';
import { AudioService } from '../services/audioService';
import { AudioConversionSeam } from '../types/contracts';

const router = express.Router();
const audioService = new AudioService();

// POST /api/convert-audio
router.post('/convert-audio', async (req, res) => {
  try {
    const input: AudioConversionSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
    }

    // Validate content length (ElevenLabs has limits)
    const cleanContent = input.content.replace(/<[^>]*>/g, '');
    if (cleanContent.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT',
          message: 'Story content too long for audio conversion (max 5000 characters)',
          unsupportedElements: ['excessive_length']
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

// POST /api/convert-audio-multivoice - New endpoint specifically for multi-voice
router.post('/convert-audio-multivoice', async (req, res) => {
  try {
    const input: AudioConversionSeam['input'] = {
      ...req.body,
      multiVoice: true // Force multi-voice mode
    };

    // Validate required fields
    if (!input.storyId || !input.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
    }

    // More lenient content length for multi-voice (it processes in segments)
    const cleanContent = input.content.replace(/<[^>]*>/g, '');
    if (cleanContent.length > 15000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT',
          message: 'Story content too long for multi-voice conversion (max 15000 characters)',
          unsupportedElements: ['excessive_length']
        }
      });
    }

    const result = await audioService.convertToAudio(input);
    res.json(result);

  } catch (error: any) {
    console.error('Multi-voice audio conversion route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Multi-voice audio conversion failed'
      }
    });
  }
});

export { router as audioRoutes };