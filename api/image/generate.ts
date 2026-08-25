import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { applyRequestId } from '../_lib/http/requestId';
import { ImageService } from '../_lib/services/imageService';
import { ImageGenerationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import {
  IMAGE_GENERATION_REQUEST_FIELDS,
  toLoggableCreature,
  toLoggableFieldNames,
  toLoggableStoryId,
  toLoggableThemes
} from '../_lib/utils/loggableRequestParameters';

export default async function handler(req: any, res: any) {
  // The caller's correlation id when it sent a usable one, a generated id
  // otherwise, echoed either way. See `applyRequestId` for why the header is not
  // taken as-is.
  const requestId = applyRequestId(req, res);

  const cors = applyCorsPolicy(req, res, {
    methods: ['POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    logWarn('Method not allowed', { requestId, endpoint: '/api/image/generate', method: req.method });
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

  try {
    const input = readJsonObjectBody<ImageGenerationSeam['input']>(req.body);

    // Validate required fields. A missing body fails here, as one more
    // malformed request, rather than throwing on `input.themes.map` deeper in
    // the service and reporting the caller's mistake as a 500 — the same
    // shape of guard `/api/story/generate` uses for the same reason.
    if (!input || !input.storyId || !input.content || !input.creature || !input.themes || !input.style) {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/image/generate',
        method: 'POST'
      }, toLoggableFieldNames(input, IMAGE_GENERATION_REQUEST_FIELDS));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, creature, themes, style'
        }
      });
    }

    logInfo('Image generation endpoint called', {
      requestId,
      endpoint: '/api/image/generate',
      method: 'POST',
      requestParameters: {
        storyId: toLoggableStoryId(input.storyId),
        creature: toLoggableCreature(input.creature),
        ...toLoggableThemes(input.themes),
        style: input.style
      }
    });

    const imageService = new ImageService();
    const result = await imageService.generateImage(input);

    logInfo(`Image generation ${result.success ? 'succeeded' : 'failed'}`, {
      requestId,
      endpoint: '/api/image/generate'
    });

    // An unsuccessful envelope is not a `200`: an unsupported style or an
    // image provider outage was served as OK with `success: false` inside it,
    // which only a client that reads the body can tell from a generated image.
    res.status(getApiResponseStatus(result)).json(result);
  } catch (error: any) {
    logError('Image generation endpoint error', error, {
      requestId,
      endpoint: '/api/image/generate',
      method: 'POST',
      statusCode: 500
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Image generation failed'
      }
    });
  }
}
