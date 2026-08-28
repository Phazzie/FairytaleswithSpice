// Created: 2026-08-26 UTC

import { applyCorsPolicy } from './corsPolicy';
import { sendMethodNotAllowed } from './methodNotAllowed';
import { settleRequestCorrelationId } from './requestCorrelationId';
import {
  ApiRateLimitConfig,
  enforceApiAccessControl
} from '../middleware/apiAccessControl';
import { logWarn } from '../utils/logger';

/**
 * The four things every paid `POST` route does before it reads its body.
 *
 * Correlation id, `X-Request-ID`, CORS, method, access control — in that order,
 * because each one depends on the last: the id is stamped into the log line the
 * method check writes, and access control must not run for a preflight or for a
 * method the route does not serve.
 *
 * This existed as four copies. `/api/story/generate`, `/api/image/generate`,
 * and `/api/export/save` already carried it verbatim, and giving
 * `/api/story/continue` the correlation id it was missing made it the fourth —
 * a hundred and forty-four identical tokens, which is what the duplication gate
 * measures and what it failed this change for. The gate was right, and it was
 * right about the shape of the fix too: the reason those routes are identical
 * here is that this sequence is a rule about paid routes rather than a detail
 * of any one of them, and a rule stated four times is a rule that can be
 * changed in three places.
 *
 * `endpoint` is the route's path below `/api/`, which is what
 * `enforceApiAccessControl` keys its rate limit on and what the log line names
 * with the prefix put back. One argument rather than two, so the two cannot
 * disagree about which route this is.
 */
export interface PostRouteStart {
  requestId: string;
}

/** What a paid POST route serves, for CORS and for `Allow` alike. */
const POST_ROUTE_METHODS = ['POST', 'OPTIONS'];

/**
 * Run the preamble. Answers `null` when the response has already been written —
 * a preflight, a method this route does not serve, an unauthenticated caller,
 * or one past its rate limit — in which case the handler must return without
 * doing any further work, exactly as `enforceApiAccessControl` already required
 * on its own.
 */
export async function beginPostRoute(
  req: any,
  res: any,
  endpoint: string,
  rateLimit: ApiRateLimitConfig
): Promise<PostRouteStart | null> {
  // Accept the caller's correlation id when it is one, otherwise mint it, and
  // echo it: the value is stamped into every log line the request writes. The
  // read and the echo live together in `settleRequestCorrelationId` because
  // routes that serve more than `POST` need that pair without the method rules
  // below — see its docblock.
  const requestId = settleRequestCorrelationId(req, res);

  const cors = applyCorsPolicy(req, res, {
    methods: POST_ROUTE_METHODS,
    credentials: true
  });
  if (cors.handled) {
    return null;
  }

  if (req.method !== 'POST') {
    logWarn('Method not allowed', { requestId, endpoint: `/api/${endpoint}`, method: req.method });
    // The same list the CORS policy above was given, so the preflight answer
    // and the `Allow` header cannot disagree about what this route serves.
    sendMethodNotAllowed(res, POST_ROUTE_METHODS, 'Only POST requests are allowed');
    return null;
  }

  const access = await enforceApiAccessControl(req, res, endpoint, rateLimit);
  if (!access.allowed) {
    return null;
  }

  return { requestId };
}
