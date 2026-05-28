// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryGenerationSeam, StoryIterationPayload } from '../_lib/story-lab/contracts';
import { buildGenesisResponse } from '../_lib/story-lab/mockData';

const VALID_BATCH_SIZES: ReadonlyArray<StoryGenerationSeam['input']['chapterBatchSize']> = [1, 2, 3];

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

  const input = req.body as StoryGenerationSeam['input'] | undefined;
  if (!input || typeof input !== 'object') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BLUEPRINT',
        message: 'Request body is required.'
      }
    });
    return;
  }

  const normalizedBatch = Number(input.chapterBatchSize) as StoryGenerationSeam['input']['chapterBatchSize'];
  const validBatch = VALID_BATCH_SIZES.includes(normalizedBatch);
  const trimmedLogline = input.logline?.trim() ?? '';

  if (!trimmedLogline || !validBatch) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BLUEPRINT',
        message: 'Blueprint requires a logline and chapterBatchSize of 1, 2, or 3.'
      }
    });
    return;
  }

  const normalizedInput: StoryGenerationSeam['input'] = {
    ...input,
    logline: trimmedLogline,
    chapterBatchSize: normalizedBatch,
    themes: Array.isArray(input.themes) ? input.themes : []
  };

  const payload: ApiResponse<StoryIterationPayload> = buildGenesisResponse(normalizedInput);
  res.status(200).json(payload);
}
