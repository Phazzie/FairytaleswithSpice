// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryContinuationSeam, StoryIterationPayload } from '../../../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../../../_lib/http/corsPolicy';
import { RATE_LIMITS } from '../../../_lib/constants';
import { enforceApiAccessControl } from '../../../_lib/middleware/apiAccessControl';
import { getStoryLabResponseStatus } from '../../../_lib/story-lab/routeStatus';
import { continueStoryLab } from '../../../_lib/story-lab/storyLabEngine';
import { getTransientStorySnapshot } from '../../../_lib/story-lab/stateStore';

const isValidBatchSize = (size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] =>
  [1, 2, 3].includes(size as StoryContinuationSeam['input']['chapterBatchSize']);

type ContinueStoryLab = typeof continueStoryLab;

const unexpectedStoryLabErrorResponse: ApiResponse<never> = {
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Story Lab request failed unexpectedly.'
  }
};

function logUnexpectedStoryLabRouteError(operation: string, error: unknown): void {
  const errorType = error instanceof Error ? error.name : 'UnknownError';
  console.error('Story Lab route failed unexpectedly', { operation, errorType });
}

/**
 * The story this URL addresses.
 *
 * This route is `/api/story-lab/stories/:storyId/continue` on both deployments
 * — the directory it lives in is named `[storyId]`, and `registerApiRoutes`
 * mounts the same pattern on Express — and the segment was read by neither.
 * `storyId` came only from the request body, which made the path parameter
 * decorative and left two things wrong with it.
 *
 * A caller that follows the URL contract, naming the story in the path and not
 * repeating it in the body, was answered `400 INVALID_REQUEST` saying `storyId`
 * is required, from a URL that names the story it is required to name. And when
 * the body did carry one, it won: `POST /stories/A/continue` with
 * `{"storyId": "B"}` continued story B — reading B's transient snapshot and
 * appending to B — while every log line, proxy rule, and reader of the request
 * saw a request against A.
 *
 * The value arrives as a query parameter on both deployments: Vercel puts a
 * dynamic segment in `req.query`, and the Express route table bridges
 * `req.params` into the same place, which is the point of that mapping. Both
 * decode the segment on the way, so nothing is decoded again here.
 */
function readRouteStoryId(req: any): string {
  const raw = req?.query?.storyId;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The story id the body carries: its trimmed text, `''` when the field is
 * absent, and `null` when it is present but is not a string a story id could
 * be. `null` is distinct from absent because a body that names the field has
 * made a claim about which story this is, and a claim the route cannot read is
 * a caller error rather than something to fall back from.
 */
function readBodyStoryId(value: unknown): string | null {
  if (value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value.trim() : null;
}

export function createStoryLabContinuationHandler(continueStory: ContinueStoryLab = continueStoryLab) {
  return async function handler(req: any, res: any) {
    const cors = applyCorsPolicy(req, res, {
      methods: ['POST', 'OPTIONS'],
      credentials: true
    });
    if (cors.handled) {
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST requests are supported.'
        }
      });
      return;
    }

    const access = await enforceApiAccessControl(
      req,
      res,
      'story-lab/stories/continue',
      RATE_LIMITS.STORY_LAB_CONTINUATION
    );
    if (!access.allowed) {
      return;
    }

    const input = req.body as Partial<StoryContinuationSeam['input']> | undefined;
    if (!input || typeof input !== 'object') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required.'
        }
      });
      return;
    }

    // `storyId` arrives from the request body, so its type is whatever the
    // caller sent. Calling `.trim()` on it directly threw a `TypeError` for
    // every non-string — `{"storyId": 123}` was answered with an unhandled
    // rejection rather than the 400 the field check below exists to give,
    // because nothing here catches it. The job route's own normalizer already
    // reads the field this way; this is the same check.
    const routeStoryId = readRouteStoryId(req);
    const bodyStoryId = readBodyStoryId(input.storyId);

    if (bodyStoryId === null) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'storyId must be a string when the request body carries one.'
        }
      });
      return;
    }

    // Two ids that disagree are refused rather than resolved. Either one could
    // be the mistake, and quietly picking one continues a story the caller did
    // not ask for — which is the failure this route had when the body always
    // won.
    if (routeStoryId && bodyStoryId && routeStoryId !== bodyStoryId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'storyId in the request body must match the story id in the request path.'
        }
      });
      return;
    }

    const storyId = routeStoryId || bodyStoryId;
    const transientSnapshot = storyId ? getTransientStorySnapshot(storyId) : null;

    const hasChapters = Array.isArray(input.previouslyGeneratedChapters);
    const batchSizeNumber = Number(input.chapterBatchSize);

    if (!storyId || (!input.storyState && !transientSnapshot) || (!hasChapters && !transientSnapshot) || !isValidBatchSize(batchSizeNumber)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Continuation requires storyId, storyState or transient snapshot, previous chapters or transient snapshot, and a chapterBatchSize of 1-3.'
        }
      });
      return;
    }

    const previousChapters = hasChapters
      ? input.previouslyGeneratedChapters ?? []
      : transientSnapshot!.chapters;

    const normalizedInput: StoryContinuationSeam['input'] = {
      ...(input as StoryContinuationSeam['input']),
      storyId,
      storyState: input.storyState ?? transientSnapshot!.state,
      previouslyGeneratedChapters: previousChapters,
      existingSummary: input.existingSummary ?? transientSnapshot?.summary,
      chapterBatchSize: batchSizeNumber as StoryContinuationSeam['input']['chapterBatchSize']
    };

    let payload: ApiResponse<StoryIterationPayload & { appendedChapterNumbers: number[] }>;
    try {
      payload = await continueStory(normalizedInput);
    } catch (error) {
      logUnexpectedStoryLabRouteError('continueStory', error);
      res.status(500).json(unexpectedStoryLabErrorResponse);
      return;
    }

    res.status(getStoryLabResponseStatus(payload)).json(payload);
  };
}

export default createStoryLabContinuationHandler();
