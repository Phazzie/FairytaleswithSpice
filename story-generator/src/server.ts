import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

// Import API services
import { StoryService } from './api/lib/services/storyService.js';
import { AudioService } from './api/lib/services/audioService.js';
import { ExportService } from './api/lib/services/exportService.js';
import { ImageService } from './api/lib/services/imageService.js';
import { StoryGenerationSeam, AudioConversionSeam, SaveExportSeam, ImageGenerationSeam } from './api/lib/types/contracts.js';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Initialize services
const storyService = new StoryService();
const audioService = new AudioService();
const exportService = new ExportService();
const imageService = new ImageService();

// CORS middleware for API routes
const corsMiddleware = (req: any, res: any, next: any) => {
  const origin = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
};

/**
 * API Routes - Converted from Vercel serverless functions
 */

// Health check endpoint
app.get('/api/health', corsMiddleware, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      services: {
        grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock',
        elevenlabs: !!process.env['ELEVENLABS_API_KEY'] ? 'configured' : 'mock'
      },
      cors: {
        allowedOrigin: process.env['FRONTEND_URL'] || 'http://localhost:4200'
      }
    };
    
    res.status(200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Story generation endpoint
app.post('/api/story/generate', corsMiddleware, async (req, res) => {
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

    const result = await storyService.generateStory(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Story generation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
});

// Audio conversion endpoint
app.post('/api/audio/convert', corsMiddleware, async (req, res) => {
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

    const result = await audioService.convertToAudio(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Audio conversion error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
});

// Export/save endpoint
app.post('/api/export/save', corsMiddleware, async (req, res) => {
  try {
    const input: SaveExportSeam['input'] = req.body;

    // Validate required fields
    if (!input.storyId || !input.content || !input.title || !input.format) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format'
        }
      });
    }

    const result = await exportService.saveAndExport(input);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Export error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
});

// Image generation endpoint
app.post('/api/image/generate', corsMiddleware, async (req, res) => {
  try {
    const input: ImageGenerationSeam['input'] = req.body;
    const result = await imageService.generateImage(input);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during image generation'
      }
    });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
