import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response, NextFunction } from 'express';
import { join } from 'node:path';
import { createCorsMiddleware } from '../../api/_lib/http/corsPolicy';
import { StoryService } from '../../api/_lib/services/storyService';
import { ExportService } from '../../api/_lib/services/exportService';
import { ImageService } from '../../api/_lib/services/imageService';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// ==================== MIDDLEWARE ====================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for the API surface, through the same origin allow-list the serverless
// routes use: `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, and
// `FRONTEND_URL` are comma-separated lists, and the response names the one
// origin the request actually matched. Page responses are left alone — they are
// same-origin, and an allow-list is not the SSR handler's business.
app.use('/api', createCorsMiddleware({
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    services: {
      grok: !!process.env['XAI_API_KEY'] ? 'configured' : 'mock'
    },
    version: '2.1.0'
  });
});

// Story generation
app.post('/api/story/generate', async (req: Request, res: Response) => {
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
app.post('/api/story/continue', async (req: Request, res: Response) => {
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

// Export/Save
app.post('/api/export/save', async (req: Request, res: Response) => {
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

// Image generation
app.post('/api/image/generate', async (req: Request, res: Response) => {
  try {
    const input = req.body;

    if (!input.storyId || !input.content || !input.creature || !input.themes || !input.style) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, creature, themes, style'
        }
      });
      return;
    }

    const imageService = new ImageService();
    const result = await imageService.generateImage(input);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Image generation failed'
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
app.use((req: Request, res: Response, next: NextFunction) => {
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
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
