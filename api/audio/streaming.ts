/**
 * Streaming Audio Routes - API endpoints for background audio processing
 */

import { Router } from 'express';
import { AudioService } from '../services/audioService';
import { AudioConversionSeam } from '../types/contracts';

const router = Router();
const audioService = new AudioService();

/**
 * POST /api/audio/stream/start
 * Starts streaming audio generation
 */
router.post('/stream/start', async (req, res) => {
  try {
    const { storyId, content, voice, speed, format } = req.body;

    // Validate required fields
    if (!storyId || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'storyId and content are required'
        }
      });
    }

    const input: AudioConversionSeam['input'] = {
      storyId,
      content,
      voice,
      speed,
      format
    };

    // Start streaming generation
    const result = await audioService.startStreamingAudio(input, (progress) => {
      // In a real implementation, this would be sent via WebSocket or Server-Sent Events
      console.log(`📊 Progress for story ${storyId}:`, progress);
    });

    res.json({
      success: true,
      data: {
        jobId: result.jobId,
        estimatedDuration: result.estimatedDuration,
        message: 'Streaming audio generation started'
      }
    });

  } catch (error: any) {
    console.error('Streaming audio start error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STREAMING_START_FAILED',
        message: 'Failed to start streaming audio generation',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/audio/stream/status/:jobId
 * Gets streaming job status
 */
router.get('/stream/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const status = audioService.getStreamingJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Streaming job not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        jobId: status.jobId,
        storyId: status.storyId,
        status: status.status,
        progress: status.progress,
        totalChunks: status.totalChunks,
        completedChunks: status.completedChunks,
        estimatedCompletionTime: status.estimatedCompletionTime,
        audioUrl: status.audioUrl
      }
    });

  } catch (error: any) {
    console.error('Streaming status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to check streaming status',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/audio/stream/result/:jobId
 * Gets final audio URL for completed job
 */
router.get('/stream/result/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const status = audioService.getStreamingJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Streaming job not found'
        }
      });
    }

    if (status.status !== 'completed') {
      return res.status(202).json({
        success: false,
        error: {
          code: 'JOB_NOT_READY',
          message: 'Job is still processing',
          details: {
            status: status.status,
            progress: status.progress
          }
        }
      });
    }

    const audioUrl = audioService.getStreamingAudioUrl(jobId);

    if (!audioUrl) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUDIO_NOT_AVAILABLE',
          message: 'Audio file not available'
        }
      });
    }

    res.json({
      success: true,
      data: {
        audioId: `streaming_${jobId}`,
        storyId: status.storyId,
        audioUrl: audioUrl,
        duration: status.audioBuffer ? Math.floor(status.audioBuffer.length / 1000) : 0,
        fileSize: status.audioBuffer ? status.audioBuffer.length : 0,
        format: 'mp3',
        completedAt: new Date(),
        progress: status.progress
      }
    });

  } catch (error: any) {
    console.error('Streaming result error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESULT_FETCH_FAILED',
        message: 'Failed to fetch streaming result',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/audio/stream/cancel/:jobId
 * Cancels a streaming job
 */
router.delete('/stream/cancel/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const cancelled = audioService.cancelStreamingJob(jobId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Streaming job not found or already completed'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Streaming job cancelled successfully',
        jobId: jobId
      }
    });

  } catch (error: any) {
    console.error('Streaming cancel error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCEL_FAILED',
        message: 'Failed to cancel streaming job',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/audio/stream/progress/:jobId
 * Server-Sent Events endpoint for real-time progress updates
 */
router.get('/stream/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type": "connected", "message": "Progress stream connected"}\\n\\n');

  // Set up progress listener
  const progressListener = (progress: any) => {
    const data = {
      type: 'progress',
      jobId: jobId,
      progress: progress,
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(data)}\\n\\n`);
  };

  // Subscribe to progress updates
  const processor = (audioService as any).streamingProcessor;
  processor.on(`progress:${jobId}`, progressListener);

  // Handle client disconnect
  req.on('close', () => {
    processor.off(`progress:${jobId}`, progressListener);
    res.end();
  });

  // Send periodic keepalive
  const keepAlive = setInterval(() => {
    res.write('data: {"type": "keepalive"}\\n\\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

export default router;