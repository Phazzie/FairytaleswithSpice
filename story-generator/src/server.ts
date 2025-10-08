import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { StoryService } from '../../api/lib/services/storyService';
import { AudioService } from '../../api/lib/services/audioService';
import { ExportService } from '../../api/lib/services/exportService';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// ==================== MIDDLEWARE ====================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  const origin = process.env['ALLOWED_ORIGINS'] || process.env['FRONTEND_URL'] || 'http://localhost:4200';
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
});

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    services: {
      grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock',
      elevenlabs: !!process.env['ELEVENLABS_API_KEY'] ? 'configured' : 'mock'
    },
    version: '2.1.0'
  });
});

// Story generation
app.post('/api/story/generate', async (req, res) => {
  try {
    const input = req.body;

    if (!input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        }
      });
      return;
    }

    const storyService = new StoryService();
    const result = await storyService.generateStory(input);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Story generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
});

// Chapter continuation
app.post('/api/story/continue', async (req, res) => {
  try {
    const input = req.body;

    if (!input.storyId || !input.existingContent || typeof input.currentChapterCount !== 'number') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, existingContent, currentChapterCount'
        }
      });
      return;
    }

    const storyService = new StoryService();
    const result = await storyService.continueChapter(input);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Chapter continuation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Chapter continuation failed'
      }
    });
  }
});

// Audio conversion
app.post('/api/audio/convert', async (req, res) => {
  try {
    const input = req.body;

    if (!input.storyId || !input.content) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
      return;
    }

    const audioService = new AudioService();
    const result = await audioService.convertToAudio(input);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Audio conversion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio conversion failed'
      }
    });
  }
});

// Export/Save
app.post('/api/export/save', async (req, res) => {
  try {
    const input = req.body;

    if (!input.storyId || !input.content || !input.title || !input.format) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format'
        }
      });
      return;
    }

    const exportService = new ExportService();
    const result = await exportService.saveAndExport(input);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
});

// ==================== STATIC FILES & ANGULAR SSR ====================

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
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 8080.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 8080;
  app.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║   🧚 Fairytales with Spice - Server Started 🧚        ║
║                                                       ║
║   Environment: ${(process.env['NODE_ENV'] || 'development').padEnd(10)}                          ║
║   Port:        ${String(port).padEnd(10)}                          ║
║   URL:         http://localhost:${port}                    ║
║                                                       ║
║   Services:                                           ║
║   - Grok AI:      ${(!!process.env['XAI_API_KEY'] ? '✅ Configured' : '⚠️  Mock Mode').padEnd(14)} ║
║   - ElevenLabs:   ${(!!process.env['ELEVENLABS_API_KEY'] ? '✅ Configured' : '⚠️  Mock Mode').padEnd(14)} ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
