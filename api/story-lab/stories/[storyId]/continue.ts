// Created: 2025-10-29 08:27 UTC

import type { ApiEnvelope, StoryContinuationSeam, StoryIterationPayload } from '../../../_lib/story-lab/contracts';
import { buildContinuationResponse } from '../../../_lib/story-lab/mockData';
import { getTransientStorySnapshot } from '../../../_lib/story-lab/stateStore';

const isValidBatchSize = (size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] =>
  [1, 2, 3].includes(size as StoryContinuationSeam['input']['chapterBatchSize']);

export default async function handler(req: any, res: any) {
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
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

  const input = req.body as Partial<StoryContinuationSeam['input']>;
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

  const normalizedInput: StoryContinuationSeam['input'] = {
    ...(input as StoryContinuationSeam['input']),
    storyId,
    storyState: input.storyState ?? transientSnapshot!.state,
    previouslyGeneratedChapters: hasChapters
      ? input.previouslyGeneratedChapters!
      : transientSnapshot!.chapters,
    existingSummary: input.existingSummary ?? transientSnapshot?.summary,
    chapterBatchSize: batchSizeNumber as StoryContinuationSeam['input']['chapterBatchSize']
  };

  const payload: ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> =
    buildContinuationResponse(normalizedInput);
  res.status(200).json(payload);
}
