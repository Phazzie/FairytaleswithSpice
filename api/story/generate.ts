import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { RATE_LIMITS } from '../_lib/constants';
import { StoryService } from '../_lib/services/storyService';
import { StoryGenerationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import {
  STORY_GENERATION_REQUEST_FIELDS,
  toLoggableCreature,
  toLoggableFieldNames,
  toLoggableNumber,
  toLoggableThemes
} from '../_lib/utils/loggableRequestParameters';

export default async function handler(req: any, res: any) {
  // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
  // one place all four paid POST routes state them. `null` means the response
  // has already been written and there is nothing left for this handler to do.
  const start = await beginPostRoute(req, res, 'story/generate', RATE_LIMITS.STORY_GENERATION);
  if (!start) {
    return;
  }

  const requestId = start.requestId;

  try {
    console.log(`[${requestId}] POST /api/story/generate - Request received`);
    
    const input = readJsonObjectBody<StoryGenerationSeam['input']>(req.body);

    // Validate required fields. A body that is missing entirely fails here, as
    // one more malformed request, rather than throwing on `input.creature` into
    // the catch block below and reporting the caller's mistake as a 500.
    if (!input || !input.creature || !input.themes || typeof input.spicyLevel !== 'number' || !input.wordCount) {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/story/generate',
        method: 'POST'
        // The field *names* are caller text as much as the values are: a JSON
        // object's keys are whatever the body was written with. Reduced to the
        // contract's own names plus a count of the rest.
      }, toLoggableFieldNames(input, STORY_GENERATION_REQUEST_FIELDS));
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: creature, themes, spicyLevel, wordCount'
        }
      });
    }

    logInfo('Story generation endpoint called', {
      requestId,
      endpoint: '/api/story/generate',
      method: 'POST',
      requestParameters: {
        creature: toLoggableCreature(input.creature),
        ...toLoggableThemes(input.themes),
        spicyLevel: toLoggableNumber(input.spicyLevel),
        wordCount: toLoggableNumber(input.wordCount)
      }
    });

    const storyService = new StoryService();
    const result = await storyService.generateStory(input);
    
    console.log(`[${requestId}] Story generation ${result.success ? 'succeeded' : 'failed'}`);
    res.status(getApiResponseStatus(result)).json(result);

  } catch (error: any) {
    logError('Story generation endpoint error', error, {
      requestId,
      endpoint: '/api/story/generate',
      method: 'POST',
      statusCode: 500
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Story generation failed'
      }
    });
  }
}
