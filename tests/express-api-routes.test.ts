// Created: 2026-08-25 12:10 UTC
//
// Proves the Node/Docker deployment actually serves the API the Angular app
// calls. `StoryService` talks to `/api/story-lab/...` for every request it
// makes, and the Express server registered none of those paths — they fell
// through to the Angular SSR handler, which answers the rendered index page
// with `200 OK`, so the app was dead on that deployment while every request it
// made looked like a success on the wire.

import assert from 'node:assert/strict';
import {
  API_ROUTES,
  registerApiRoutes,
  runApiRoute,
  type ApiRouteDefinition
} from '../api/_lib/http/expressApiRoutes';

// ==================== the routes that must exist ====================

const EXPECTED_ROUTE_PATHS = [
  '/api/health',
  '/api/story/generate',
  '/api/story/continue',
  '/api/export/save',
  '/api/image/generate',
  '/api/story-lab/stories',
  '/api/story-lab/stories/:storyId/continue',
  '/api/story-lab/stream/genesis',
  '/api/story-lab/evaluate',
  '/api/story-lab/jobs',
  '/api/story-lab/jobs/:jobId/events',
  '/api/story-lab/jobs/:jobId',
  '/api/story-lab/account/profile',
  '/api/story-lab/account/projects/:projectId',
  '/api/story-lab/account/projects'
];

const registeredPaths: string[] = [];
const registeredHandlers = new Map<string, (req: any, res: any, next: (error?: unknown) => void) => void>();

registerApiRoutes({
  all(path, handler) {
    registeredPaths.push(path);
    registeredHandlers.set(path, handler);
    return undefined;
  }
});

assert.deepEqual(
  [...registeredPaths].sort(),
  [...EXPECTED_ROUTE_PATHS].sort(),
  'every serverless route should be registered on the Express deployment'
);

assert.deepEqual(
  API_ROUTES.map(route => route.path),
  registeredPaths,
  'the route table and the registration order should be the same list'
);

for (const route of API_ROUTES) {
  assert.equal(typeof route.handler, 'function', `${route.path} should resolve to a handler function`);
}

// Every path is registered for all methods, the way a Vercel function receives
// every method for its own path: dispatch and CORS preflight belong to the
// handlers, and registering `POST` alone would answer a preflight with a 404.
assert.equal(registeredHandlers.size, EXPECTED_ROUTE_PATHS.length);

// ==================== the URLs the Angular app actually calls ====================

/**
 * `StoryService` builds these. A path that matches nothing here is a request
 * the deployment answers with the SSR index page.
 */
const CLIENT_REQUEST_PATHS = [
  '/api/image/generate',
  '/api/story-lab/stories',
  '/api/story-lab/stories/story_abc/continue',
  '/api/story-lab/jobs',
  '/api/story-lab/jobs/job_abc',
  '/api/story-lab/jobs/job_abc/events',
  '/api/story-lab/account/profile',
  '/api/story-lab/account/projects',
  '/api/story-lab/account/projects/project-1',
  '/api/story-lab/stream/genesis',
  '/api/story-lab/evaluate',
  '/api/health'
];

function matchRoute(path: string): { route: ApiRouteDefinition; params: Record<string, string> } | null {
  for (const route of API_ROUTES) {
    const patternSegments = route.path.split('/');
    const pathSegments = path.split('/');
    if (patternSegments.length !== pathSegments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    const matched = patternSegments.every((segment, index) => {
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = pathSegments[index];
        return pathSegments[index].length > 0;
      }

      return segment === pathSegments[index];
    });

    if (matched) {
      return { route, params };
    }
  }

  return null;
}

for (const path of CLIENT_REQUEST_PATHS) {
  assert.ok(matchRoute(path), `${path} should be served by a registered API route`);
}

// The parameterised job paths must not be shadowed by the collection route,
// and the events stream must not be swallowed by `/jobs/:jobId`.
assert.equal(matchRoute('/api/story-lab/jobs')?.route.path, '/api/story-lab/jobs');
assert.equal(matchRoute('/api/story-lab/jobs/job_abc')?.route.path, '/api/story-lab/jobs/:jobId');
assert.equal(matchRoute('/api/story-lab/jobs/job_abc/events')?.route.path, '/api/story-lab/jobs/:jobId/events');
assert.equal(matchRoute('/api/story-lab/account/projects')?.route.path, '/api/story-lab/account/projects');
assert.equal(
  matchRoute('/api/story-lab/account/projects/project-1')?.route.path,
  '/api/story-lab/account/projects/:projectId'
);

// ==================== the query a Vercel rewrite would have produced ====================

function queryFor(path: string): Record<string, string | undefined> {
  const match = matchRoute(path);
  assert.ok(match, `${path} should match a route`);
  return match.route.query ? match.route.query(match.params) : {};
}

assert.deepEqual(queryFor('/api/story-lab/jobs/job_abc'), { jobId: 'job_abc' });
assert.deepEqual(queryFor('/api/story-lab/jobs/job_abc/events'), { jobId: 'job_abc', events: '1' });
assert.deepEqual(queryFor('/api/story-lab/account/profile'), { resource: 'profile' });
assert.deepEqual(queryFor('/api/story-lab/account/projects'), { resource: 'projects' });
assert.deepEqual(
  queryFor('/api/story-lab/account/projects/project-1'),
  { resource: 'project', projectId: 'project-1' }
);
assert.deepEqual(queryFor('/api/story-lab/stories'), {}, 'a route with no rewrite adds nothing');

// ==================== the request the handler is actually given ====================

function fakeRequest(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    url: '/api/story-lab/jobs/job_abc/events?cursor=2',
    headers: { authorization: 'Bearer token' },
    body: { kind: 'genesis' },
    query: { cursor: '2' },
    params: { jobId: 'job_abc' },
    socket: { on: () => undefined },
    ...overrides
  };
}

let seenRequest: any = null;
runApiRoute(
  {
    path: '/api/story-lab/jobs/:jobId/events',
    handler: req => {
      seenRequest = req;
      return undefined;
    },
    query: params => ({ jobId: params['jobId'], events: '1' })
  },
  fakeRequest(),
  {},
  error => assert.fail(`a handler that returned nothing should not call next: ${String(error)}`)
);

assert.deepEqual(
  seenRequest.query,
  { cursor: '2', jobId: 'job_abc', events: '1' },
  'the rewrite values should be merged onto the query the request already carried'
);
assert.equal(seenRequest.method, 'GET', 'method should still read through');
assert.equal(seenRequest.url, '/api/story-lab/jobs/job_abc/events?cursor=2', 'url should still read through');
assert.deepEqual(seenRequest.headers, { authorization: 'Bearer token' }, 'headers should still read through');
assert.deepEqual(seenRequest.body, { kind: 'genesis' }, 'body should still read through');
assert.equal(
  typeof seenRequest.socket?.on,
  'function',
  'the socket the genesis stream watches for a departed reader should still read through'
);

// An undefined parameter is left off rather than written as the string
// "undefined", which the account route would read as a project id.
let sparseRequest: any = null;
runApiRoute(
  {
    path: '/api/story-lab/account/projects/:projectId',
    handler: req => {
      sparseRequest = req;
      return undefined;
    },
    query: params => ({ resource: 'project', projectId: params['projectId'] })
  },
  fakeRequest({ params: {}, query: {} }),
  {},
  error => assert.fail(`unexpected next: ${String(error)}`)
);
assert.deepEqual(sparseRequest.query, { resource: 'project' });

// A route with no rewrite is handed the request itself, untouched.
let passthroughRequest: any = null;
const originalRequest = fakeRequest();
runApiRoute(
  {
    path: '/api/story-lab/stories',
    handler: req => {
      passthroughRequest = req;
      return undefined;
    }
  },
  originalRequest,
  {},
  error => assert.fail(`unexpected next: ${String(error)}`)
);
assert.equal(passthroughRequest, originalRequest);

// ==================== failures reach Express rather than the process ====================

const thrown = new Error('handler threw');
let synchronousError: unknown = null;
runApiRoute(
  {
    path: '/api/health',
    handler: () => {
      throw thrown;
    }
  },
  fakeRequest(),
  {},
  error => {
    synchronousError = error;
  }
);
assert.equal(synchronousError, thrown, 'a synchronous throw should be forwarded to next');

const rejected = new Error('handler rejected');
let asynchronousError: unknown = null;
runApiRoute(
  {
    path: '/api/health',
    handler: async () => {
      throw rejected;
    }
  },
  fakeRequest(),
  {},
  error => {
    asynchronousError = error;
  }
);

// The rejection is delivered on a microtask, so the assertion waits for one.
async function assertRejectionWasForwarded(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    asynchronousError,
    rejected,
    'a rejected handler promise should be forwarded to next rather than becoming an unhandled rejection'
  );
}

assertRejectionWasForwarded().then(
  () => {
    console.log('Express API route registration tests passed');
  },
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);
