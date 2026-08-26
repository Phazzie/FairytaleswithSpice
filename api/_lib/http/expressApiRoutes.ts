// Created: 2026-08-25 12:10 UTC

import healthHandler from '../../health';
import exportSaveHandler from '../../export/save';
import imageGenerateHandler from '../../image/generate';
import storyLabEvaluateHandler from '../../story-lab/evaluate';
import storyLabStreamGenesisHandler from '../../story-lab/stream/genesis';
import { createStoryLabGenesisHandler } from '../../story-lab/stories';
import { createStoryLabContinuationHandler } from '../../story-lab/stories/[storyId]/continue';
import { handleStoryLabAccountRoute } from '../story-lab/account/accountRouteHandlers';
import { handleStoryLabJobsRoute } from '../story-lab/jobs/jobRouteHandlers';

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
 * `/api/story/generate` and `/api/story/continue` are gone from the table
 * below: they were never reachable from the app described above — the
 * Angular client only ever calls `/api/story-lab/...` — and the correlation
 * id, access control, and redacted logging they carried have since moved onto
 * the Story Lab genesis and continuation routes that do serve real traffic.
 * See `api/README.md`'s "Retired route files" for the rest of that history.
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
 * The query values a Vercel deployment puts on a request before the function
 * sees it. `vercel.json` turns `/api/story-lab/jobs/:jobId/events` into
 * `/api/story-lab/jobs?jobId=:jobId&events=1`, and the account paths into
 * `?resource=…`; a dynamic route directory such as `[storyId]` does the same
 * for its own segment with no rewrite at all. Express matches the path itself
 * and puts the values in `req.params`, so they are bridged here rather than the
 * handlers having to learn a second shape.
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
  { path: '/api/export/save', handler: exportSaveHandler },
  { path: '/api/image/generate', handler: imageGenerateHandler },
  { path: '/api/story-lab/stories', handler: storyLabGenesisHandler },
  {
    path: '/api/story-lab/stories/:storyId/continue',
    handler: storyLabContinuationHandler,
    // Vercel serves this route from `api/story-lab/stories/[storyId]/continue.ts`
    // and puts the dynamic segment in `req.query` without a rewrite, so there is
    // no `vercel.json` entry to mirror here — but the handler reads the segment
    // from the same place on both deployments, and Express would otherwise leave
    // it only in `req.params`.
    query: params => ({ storyId: params['storyId'] })
  },
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
 * Answer an `/api` path no route claimed.
 *
 * Without this, an unregistered API path falls past `express.static` into the
 * Angular SSR handler, which renders the index page and answers `200 OK`,
 * `text/html` — the exact failure this module exists to end, only narrowed from
 * "every Story Lab route" to "any path that is not in the table above": a typo
 * in a client URL, a route retired on one deployment and not the other, or a
 * `vercel.json` rewrite whose Express twin was never added. `HttpClient` reports
 * that page as a JSON parse error, so the one thing the response does not say is
 * that the path does not exist.
 *
 * Mount it directly after `registerApiRoutes`, before the static and SSR
 * handlers, since falling through to them is the thing being prevented.
 *
 * The message names nothing from the request. It used to quote the method and
 * path back — friendlier to read in a log, and a reflected-XSS sink: the path
 * arrives from the caller and left again inside the response body. A browser
 * percent-encodes the URL it sends, so `%3Cscript%3E` is what
 * `req.originalUrl` holds and what came back; a client writing the request line
 * itself is under no such constraint, and a raw `<script>` reached the body
 * verbatim. It is served as `application/json`, which is why this was narrow
 * rather than live — but "narrow" depends on a `Content-Type` being respected,
 * and the caller already knows which URL it asked for, so the echo was buying
 * nothing worth defending.
 */
export function apiNotFoundHandler(_req: any, res: any): void {
  sendApiEnvelope(res, 404, {
    success: false,
    error: {
      code: 'API_ROUTE_NOT_FOUND',
      message: 'No API route matches this path.'
    }
  });
}

/**
 * Turn a failure anywhere under `/api` into the envelope every caller of this
 * API already reads.
 *
 * `runApiRoute` hands a thrown or rejected handler to `next`, and the body
 * parsers mounted ahead of the routes reject a malformed or oversized payload
 * the same way. With no error middleware registered, all of that reached
 * Express's default handler, which answers `text/html` — carrying the full stack
 * trace whenever `NODE_ENV` is not `production`, which is the default. So a
 * server-side bug was served to the browser as a stack trace that `HttpClient`
 * could only report as a parse error, and a client that sent a truncated JSON
 * body was told nothing it could act on.
 *
 * The two body-parser failures are caller errors and are named as such; anything
 * else is this service failing and is reported as `500` with no detail beyond
 * the code, because the detail is what the stack trace was leaking.
 *
 * Express recognises an error handler by its four declared parameters, so `next`
 * has to stay in the signature even though a response that is already streaming
 * is the only case that uses it.
 */
export function apiErrorHandler(
  error: any,
  _req: any,
  res: any,
  next: (error?: unknown) => void
): void {
  // A route that already began writing — an SSE stream, say — cannot be given a
  // status and a body now. Express's default handler is what closes that socket.
  if (res?.headersSent) {
    next(error);
    return;
  }

  const bodyError = readBodyParserError(error);
  if (bodyError) {
    sendApiEnvelope(res, bodyError.status, {
      success: false,
      error: { code: bodyError.code, message: bodyError.message }
    });
    return;
  }

  sendApiEnvelope(res, 500, {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The API failed to handle this request.'
    }
  });
}

/**
 * Recognise the two failures `express.json` and `express.urlencoded` raise for
 * a request the caller can fix. Both carry a `type` naming the check that
 * failed; the status they set is used as-is so a change in Express does not
 * silently become a 500 here.
 */
function readBodyParserError(
  error: any
): { status: number; code: string; message: string } | null {
  const type = error && typeof error === 'object' ? (error as { type?: unknown }).type : undefined;
  const status = readErrorStatus(error);

  if (type === 'entity.parse.failed') {
    return {
      status: status ?? 400,
      code: 'INVALID_INPUT',
      message: 'Request body is not valid JSON.'
    };
  }

  if (type === 'entity.too.large') {
    return {
      status: status ?? 413,
      code: 'CONTENT_TOO_LARGE',
      message: 'Request body is larger than this API accepts.'
    };
  }

  return null;
}

function readErrorStatus(error: any): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = (error as { status?: unknown; statusCode?: unknown });
  for (const value of [candidate.status, candidate.statusCode]) {
    if (typeof value === 'number' && value >= 400 && value <= 599) {
      return value;
    }
  }

  return undefined;
}

function sendApiEnvelope(res: any, status: number, body: unknown): void {
  // Defence in depth for the whole envelope path, not for the echo that was
  // removed above: `application/json` only keeps a body from being read as
  // markup while something honours it, and a browser that content-sniffs does
  // not. `nosniff` is what makes the declared type binding, so a response here
  // cannot be turned into a document by any later change to what these
  // envelopes carry. Express's own `json escape` setting is the other half and
  // is off by default, so `<` in a JSON string is written through literally.
  res.setHeader?.('X-Content-Type-Options', 'nosniff');

  if (typeof res?.status === 'function' && typeof res.status(status)?.json === 'function') {
    res.status(status).json(body);
    return;
  }

  // A response double, or a bare `ServerResponse`, may carry neither helper.
  // Saying so in JSON is still better than the HTML default.
  res.statusCode = status;
  res.setHeader?.('Content-Type', 'application/json');
  res.end?.(JSON.stringify(body));
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
