import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { RATE_LIMITS } from '../_lib/constants';
import { ImageService } from '../_lib/services/imageService';
import { ImageGenerationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import {
  IMAGE_GENERATION_REQUEST_FIELDS,
  toLoggableCreature,
  toLoggableFieldNames,
  toLoggableImageStyle,
  toLoggableStoryId,
  toLoggableThemes
} from '../_lib/utils/loggableRequestParameters';

export default async function handler(req: any, res: any) {
  // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
  // one place all four paid POST routes state them. `null` means the response
  // has already been written and there is nothing left for this handler to do.
  const start = await beginPostRoute(req, res, 'image/generate', RATE_LIMITS.IMAGE_GENERATION);
  if (!start) {
    return;
  }

  const requestId = start.requestId;

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
        // Through the allow-list like every other field on this line: the
        // guard above accepted `style` for being present, not for being one of
        // the five the contract names, so it is still caller text here.
        style: toLoggableImageStyle(input.style)
      }
    });

    const imageService = new ImageService();
    // The correlation id goes with the request: it is what this handler's own
    // lines are stamped with, what the caller was echoed as `X-Request-ID`, and
    // now what the envelope's `metadata.requestId` and the service's own failure
    // lines carry, instead of an `img-req-<uuid>` minted inside the service that
    // appeared in no log line anywhere.
    const result = await imageService.generateImage(input, requestId);

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
