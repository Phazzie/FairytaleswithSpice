// Must be this exact side-effecting import, first in the file - not a
// `config()` *call* placed first, however early it looks. ES module imports
// evaluate their whole dependency graph, in source order, before this file's
// *own* body runs a single statement: a `config()` call written as this
// file's own top-level code - even above the other imports - still executes
// after every one of those imports (including `expressApiRoutes` down to
// `configuredAuthPort.ts`) has already finished evaluating, which is one
// module-load too late for the `process.env` reads they do at their own
// module scope. `import 'dotenv/config'` runs `config()` as part of *its*
// module evaluation instead, which - as the first import - completes before
// the second one starts. (Confirmed the hard way: a `config()` call placed
// exactly like that left every module-scope env read seeing an empty
// `process.env`, while a request-time read in the same file saw the loaded
// values - the two only agreed once this became a bare `dotenv/config` import.)
//
// Relies on `dotenv/config`'s default `.env` lookup (`process.cwd()`), so the
// documented local-run command runs from the repo root, not story-generator/.
import 'dotenv/config';

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response, NextFunction } from 'express';
import { join } from 'node:path';
import { createCorsMiddleware } from '../../api/_lib/http/corsPolicy';
import {
  apiErrorHandler,
  apiNotFoundHandler,
  registerApiRoutes
} from '../../api/_lib/http/expressApiRoutes';
import { logUnhandledProcessFailure } from '../../api/_lib/http/unhandledProcessFailureLogger';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// ==================== MIDDLEWARE ====================

// CORS for the API surface, through the same origin allow-list the serverless
// routes use: `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, and
// `FRONTEND_URL` are comma-separated lists, and the response names the one
// origin the request actually matched. Page responses are left alone — they are
// same-origin, and an allow-list is not the SSR handler's business.
//
// Ahead of the body parsers so that a request the parsers reject is still
// answered with the CORS headers the browser needs in order to show the caller
// the 400 — and so a preflight, which carries no body worth parsing, is answered
// without one being read.
app.use('/api', createCorsMiddleware({
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== API ROUTES ====================

// The same handlers the serverless deployment runs, at the same paths — see
// `registerApiRoutes`. Registering them here is what makes the Story Lab API
// (`/api/story-lab/...`, which is every request the Angular app makes) reachable
// on this deployment at all, and what stops the four legacy routes from being a
// second, drifting implementation of routes that already exist.
registerApiRoutes(app);

// Anything left under `/api` is a path no route claimed, and it has to be said
// here: past this point lie `express.static` and the Angular SSR handler, and
// the SSR handler answers every path it is given with the rendered index page
// and a `200`. That is what made the missing Story Lab routes look like
// successes on the wire, and it does the same for any path the table above
// does not carry.
app.use('/api', apiNotFoundHandler);

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

// ==================== API ERROR HANDLING ====================

// Last, because Express matches error middleware in registration order and this
// one has to be able to see a failure from anything above it — a body the
// parsers rejected, and the handler errors `runApiRoute` deliberately forwards
// here rather than letting them become unhandled rejections. Without it those
// reached Express's default handler, which answers `text/html` and, outside
// `NODE_ENV=production`, includes the stack trace.
app.use('/api', apiErrorHandler);

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 8080.
 */
if (isMainModule(import.meta.url)) {
  // Registered only for the standalone, long-running server — not when this
  // module is merely imported for its `reqHandler` export by another host
  // (Firebase Functions, say), which manages its own process lifecycle.
  //
  // `uncaughtException` logs and exits: Node's own guidance is that the
  // process is in an undefined state past that point, and continuing risks
  // acting on corrupted state rather than a clean restart. `unhandledRejection`
  // logs without forcing an exit — the same "recoverable" treatment
  // `runApiRoute` already gives a route handler's rejected promise.
  process.on('uncaughtException', error => {
    logUnhandledProcessFailure('uncaughtException', error);
    process.exit(1);
  });
  process.on('unhandledRejection', error => {
    logUnhandledProcessFailure('unhandledRejection', error);
  });

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
