// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryIterationPayload } from '../_lib/story-lab/contracts';
import { generateStoryLabGenesis } from '../_lib/story-lab/storyLabEngine';
import { parseStoryLabBlueprintFromBody } from '../_lib/story-lab/validation/blueprintParser';

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

  const parsed = parseStoryLabBlueprintFromBody(req.body);
  if (parsed.error) {
    res.status(400).json({
      success: false,
      error: {
        code: parsed.error.code,
        message: parsed.error.message
      }
    });
    return;
  }

  const payload: ApiResponse<StoryIterationPayload> = await generateStoryLabGenesis(parsed.blueprint);
  res.status(200).json(payload);
}
