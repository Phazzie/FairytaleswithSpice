// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryContinuationSeam, StoryIterationPayload } from '../../../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../../../_lib/http/corsPolicy';
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

    const storyId = input.storyId?.trim() ?? '';
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
