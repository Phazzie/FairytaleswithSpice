// Created: 2025-10-29 08:27 UTC

import type { NextApiRequest, NextApiResponse } from 'next';

import type { ApiEnvelope, StoryContinuationSeam, StoryIterationPayload } from '../../contracts';
import { buildContinuationResponse } from '../../mockData';

const isValidBatchSize = (size: number): size is StoryContinuationSeam['input']['chapterBatchSize'] =>
  [1, 2, 3].includes(size as StoryContinuationSeam['input']['chapterBatchSize']);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }>>
) {
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

  const input: StoryContinuationSeam['input'] = req.body;

  const hasChapters = Array.isArray(input.previouslyGeneratedChapters);
  const batchSizeNumber = Number(input.chapterBatchSize);

  if (!input.storyId?.trim() || !input.storyState || !hasChapters || !isValidBatchSize(batchSizeNumber)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Continuation requires storyId, storyState, previouslyGeneratedChapters, and a chapterBatchSize of 1-3.'
      }
    });
    return;
  }

  const normalizedInput: StoryContinuationSeam['input'] = {
    ...input,
    storyId: input.storyId.trim(),
    previouslyGeneratedChapters: input.previouslyGeneratedChapters,
    chapterBatchSize: batchSizeNumber as StoryContinuationSeam['input']['chapterBatchSize']
  };

  const payload: ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> =
    buildContinuationResponse(normalizedInput);
  res.status(200).json(payload);
}
