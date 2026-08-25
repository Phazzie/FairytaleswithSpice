// Created: 2026-08-25 12:10 UTC

import healthHandler from '../../health';
import exportSaveHandler from '../../export/save';
import storyContinueHandler from '../../story/continue';
import storyGenerateHandler from '../../story/generate';
import storyLabEvaluateHandler from '../../story-lab/evaluate';
import storyLabStreamGenesisHandler from '../../story-lab/stream/genesis';
import { createStoryLabGenesisHandler } from '../../story-lab/stories';
import { createStoryLabContinuationHandler } from '../../story-lab/stories/[storyId]/continue';
import { handleStoryLabAccountRoute } from '../story-lab/account/accountRouteHandlers';
import { handleStoryLabJobsRoute } from '../story-lab/jobs/jobRouteHandlers';
import { handleImageGenerationRoute } from './imageGenerationRoute';

/**
 * Mount every serverless route on a connect/Express router.
 *
 * The Node/Docker deployment served four hand-written routes —
 * `/api/health`, `/api/story/generate`, `/api/story/continue`, and
 * `/api/export/save` — and nothing else. The Angular app does not call any of
 * them: `StoryService` talks to `/api/story-lab/...` for every request it
 * makes, from genesis and continuation to jobs, the account library, the
 * evaluation route, and the genesis event stream. None of those paths was
 * registered, so each one fell past the API routes into `express.static` and
 * then the Angular SSR handler, which answers with the rendered index page —
 * `200 OK`, `text/html`. `HttpClient` then failed to parse a page as JSON and
 * reported a parse error, so the whole app was dead on that deployment while
 * every request it made looked like a success on the wire.
 *
 * The four routes it did serve were re-implementations rather than the
 * serverless handlers, and had drifted: the export route lost the 500KB byte
 * cap and the string checks on `content` and `title` that `api/export/save.ts`
 * enforces, the story routes lost the redacted structured logging and the
 * `X-Request-ID` correlation header, and `/api/health` answered a bare object
 * where the serverless route answers an `ApiResponse` envelope. Serving the
 * same handlers is what keeps the two deployments answering the same way
 * without either having to be kept in step by hand.
 *
 * The handlers are written against the serverless `(req, res)` signature, which
 * is the Node request and response Express also extends: they read `method`,
 * `body`, `query`, `url`, `headers`, and `socket`, and write through
 * `setHeader`, `status().json()`, `writeHead`, `write`, and `end`. Method
 * dispatch and CORS preflight stay inside each handler, as they do on Vercel,
 * so every path is registered for all methods.
 */

export type ApiRouteHandler = (req: any, res: any) => unknown;

/**
 * The part of an Express app or router this needs. Structural so a test can
 * record what was registered without standing up a server, and so the caller
 * can pass either `app` or a `Router`.
 */
export interface ApiRouteRegistrar {
  all(path: string, handler: (req: any, res: any, next: (error?: unknown) => void) => void): unknown;
}

const storyLabGenesisHandler = createStoryLabGenesisHandler();
const storyLabContinuationHandler = createStoryLabContinuationHandler();

/**
 * The query values Vercel's rewrites put on a request before the function sees
 * it. `vercel.json` turns `/api/story-lab/jobs/:jobId/events` into
 * `/api/story-lab/jobs?jobId=:jobId&events=1`, and the account paths into
 * `?resource=…`; Express matches the path itself and puts the same values in
 * `req.params`, so they are bridged here rather than the handlers having to
 * learn a second shape.
 */
type RouteQuery = Record<string, string | undefined>;

export interface ApiRouteDefinition {
  path: string;
  handler: ApiRouteHandler;
  /** Derive the rewrite query values from the matched path parameters. */
  query?: (params: Record<string, string>) => RouteQuery;
}

export const API_ROUTES: readonly ApiRouteDefinition[] = [
  { path: '/api/health', handler: healthHandler },
  { path: '/api/story/generate', handler: storyGenerateHandler },
  { path: '/api/story/continue', handler: storyContinueHandler },
  { path: '/api/export/save', handler: exportSaveHandler },
  // No serverless counterpart — the route budget consolidation removed it, so
  // this path exists on the Node deployment only. It is registered here rather
  // than written inline in `server.ts` so it gets the same body reading, status
  // mapping, and test coverage as every other route.
  { path: '/api/image/generate', handler: handleImageGenerationRoute },
  { path: '/api/story-lab/stories', handler: storyLabGenesisHandler },
  { path: '/api/story-lab/stories/:storyId/continue', handler: storyLabContinuationHandler },
  { path: '/api/story-lab/stream/genesis', handler: storyLabStreamGenesisHandler },
  { path: '/api/story-lab/evaluate', handler: storyLabEvaluateHandler },
  { path: '/api/story-lab/jobs', handler: handleStoryLabJobsRoute },
  {
    path: '/api/story-lab/jobs/:jobId/events',
    handler: handleStoryLabJobsRoute,
    query: params => ({ jobId: params['jobId'], events: '1' })
  },
  {
    path: '/api/story-lab/jobs/:jobId',
    handler: handleStoryLabJobsRoute,
    query: params => ({ jobId: params['jobId'] })
  },
  {
    path: '/api/story-lab/account/profile',
    handler: handleStoryLabAccountRoute,
    query: () => ({ resource: 'profile' })
  },
  {
    path: '/api/story-lab/account/projects/:projectId',
    handler: handleStoryLabAccountRoute,
    query: params => ({ resource: 'project', projectId: params['projectId'] })
  },
  {
    path: '/api/story-lab/account/projects',
    handler: handleStoryLabAccountRoute,
    query: () => ({ resource: 'projects' })
  }
];

export function registerApiRoutes(registrar: ApiRouteRegistrar): void {
  for (const route of API_ROUTES) {
    registrar.all(route.path, (req, res, next) => {
      runApiRoute(route, req, res, next);
    });
  }
}

/**
 * Exported for the same reason the route table is: this is where a rejected
 * handler stops being an unhandled rejection, and asserting on it through a
 * live server would prove nothing the fake registrar cannot.
 */
export function runApiRoute(
  route: ApiRouteDefinition,
  req: any,
  res: any,
  next: (error?: unknown) => void
): void {
  let result: unknown;

  try {
    result = route.handler(withRewriteQuery(req, route), res);
  } catch (error) {
    next(error);
    return;
  }

  // Express 5 forwards a rejected handler promise to the error middleware on
  // its own, but only for the handler it called — this one is a wrapper, so the
  // rejection has to be handed on explicitly or it becomes an unhandled
  // rejection that takes the process down under the default Node policy.
  if (isPromiseLike(result)) {
    Promise.resolve(result).catch(next);
  }
}

/**
 * Present the request with the query a Vercel rewrite would have produced.
 *
 * `req.query` is a getter on the Express request prototype and cannot be
 * assigned, so the extra values go on a derived object that inherits everything
 * else — `body`, `headers`, `method`, `url`, and the `socket` the genesis
 * stream watches for a reader who left. A route with no rewrite gets the
 * request itself, untouched.
 */
function withRewriteQuery(req: any, route: ApiRouteDefinition): any {
  if (!route.query) {
    return req;
  }

  const derived = Object.create(req);
  Object.defineProperty(derived, 'query', {
    value: {
      ...(req?.query ?? {}),
      ...omitUndefined(route.query(req?.params ?? {}))
    },
    enumerable: true
  });

  return derived;
}

function omitUndefined(query: RouteQuery): Record<string, string> {
  const defined: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      defined[key] = value;
    }
  }

  return defined;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value) && typeof (value as PromiseLike<unknown>).then === 'function';
}
