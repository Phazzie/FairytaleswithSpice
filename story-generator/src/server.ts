import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response, NextFunction } from 'express';
import { join } from 'node:path';
import { createCorsMiddleware } from '../../api/_lib/http/corsPolicy';
import { registerApiRoutes } from '../../api/_lib/http/expressApiRoutes';

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

// The same handlers the serverless deployment runs, at the same paths — see
// `registerApiRoutes`. Registering them here is what makes the Story Lab API
// (`/api/story-lab/...`, which is every request the Angular app makes) reachable
// on this deployment at all, and what stops the four legacy routes from being a
// second, drifting implementation of routes that already exist.
//
// `/api/image/generate` is in that table too. It has no serverless counterpart
// and is served on this deployment only, but it was the last route written
// inline here, and being written inline is why it was the one route that never
// got the shared body reading: it read `req.body.storyId` straight through, and
// Express 5 leaves `req.body` undefined for a request sent without a JSON body,
// so a malformed request was answered as a 500.
registerApiRoutes(app);

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
