// Created: 2025-10-29 08:27 UTC

import type { ApiResponse, StoryIterationPayload } from '../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { getStoryLabResponseStatus } from '../_lib/story-lab/routeStatus';
import { generateStoryLabGenesis } from '../_lib/story-lab/storyLabEngine';
import { parseStoryLabBlueprintFromBody } from '../_lib/story-lab/validation/blueprintParser';

type GenerateStoryLabGenesis = typeof generateStoryLabGenesis;

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

export function createStoryLabGenesisHandler(generateGenesis: GenerateStoryLabGenesis = generateStoryLabGenesis) {
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

    let payload: ApiResponse<StoryIterationPayload>;
    try {
      payload = await generateGenesis(parsed.blueprint);
    } catch (error) {
      logUnexpectedStoryLabRouteError('generateGenesis', error);
      res.status(500).json(unexpectedStoryLabErrorResponse);
      return;
    }

    res.status(getStoryLabResponseStatus(payload)).json(payload);
  };
}

export default createStoryLabGenesisHandler();
