// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryContinuationSeam, StoryIterationPayload } from '../../../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../../../_lib/http/corsPolicy';
import { continueStoryLab } from '../../../_lib/story-lab/storyLabEngine';
import { getTransientStorySnapshot } from '../../../_lib/story-lab/stateStore';

const isValidBatchSize = (size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] =>
  [1, 2, 3].includes(size as StoryContinuationSeam['input']['chapterBatchSize']);

export default async function handler(req: any, res: any) {
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

  const payload: ApiResponse<StoryIterationPayload & { appendedChapterNumbers: number[] }> =
    await continueStoryLab(normalizedInput);
  res.status(200).json(payload);
}
