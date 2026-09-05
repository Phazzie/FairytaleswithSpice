// Created: 2026-09-02 UTC

import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { RATE_LIMITS } from '../_lib/constants';
import { AudioService, DEFAULT_FORMAT } from '../_lib/services/audioService';
import { AudioConversionSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import { withUnhandledRouteFailureLogging } from '../_lib/http/withUnhandledRouteFailureLogging';
import {
  AUDIO_CONVERSION_REQUEST_FIELDS,
  toLoggableAudioFormat,
  toLoggableFieldNames,
  toLoggableStoryId
} from '../_lib/utils/loggableRequestParameters';

async function handler(req: any, res: any) {
  // Taken before `beginPostRoute`, not inside `AudioService.convertToAudio`:
  // that preamble can itself take real time (a `RATE_LIMIT_STORE=postgres`
  // lookup), and Vercel's 60-second `maxDuration` clock is already running
  // during it. Starting the synthesis deadline's own clock only once this
  // handler reaches the service call would let that preamble time go
  // uncounted against the platform's actual deadline.
  const invocationStartTime = Date.now();

  // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
  // one place every paid POST route states them. `null` means the response
  // has already been written and there is nothing left for this handler to do.
  const start = await beginPostRoute(req, res, 'audio/convert', RATE_LIMITS.AUDIO_CONVERSION);
  if (!start) {
    return;
  }

  const requestId = start.requestId;

  try {
    const input = readJsonObjectBody<AudioConversionSeam['input']>(req.body);

    // A missing body fails here, as one more malformed request, rather than
    // throwing deeper in the service and reporting the caller's mistake as a
    // 500 — the same shape of guard `/api/image/generate` uses for the same
    // reason.
    if (!input || !input.storyId || !input.content) {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/audio/convert',
        method: 'POST'
      }, toLoggableFieldNames(input, AUDIO_CONVERSION_REQUEST_FIELDS));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content'
        }
      });
    }

    logInfo('Audio generation endpoint called', {
      requestId,
      endpoint: '/api/audio/convert',
      method: 'POST',
      requestParameters: {
        storyId: toLoggableStoryId(input.storyId),
        // `input.format` is optional on the wire — `AudioService` defaults it
        // to `DEFAULT_FORMAT` for every normal request that omits it, so
        // logging the raw (usually `undefined`) value would record the
        // standard path as `[UNRECOGNIZED]`, indistinguishable from a
        // genuinely unsupported format during incident diagnosis.
        format: toLoggableAudioFormat(input.format ?? DEFAULT_FORMAT)
      }
    });

    const audioService = new AudioService();
    const result = await audioService.convertToAudio(input, requestId, invocationStartTime);

    logInfo(`Audio generation ${result.success ? 'succeeded' : 'failed'}`, {
      requestId,
      endpoint: '/api/audio/convert'
    });

    // An unsuccessful envelope is not a `200`, the same rule `/api/image/generate`
    // follows: an unsupported format or a provider outage is only distinguishable
    // from a real narration by a client that reads the body.
    res.status(getApiResponseStatus(result)).json(result);
  } catch (error: any) {
    logError('Audio generation endpoint error', error, {
      requestId,
      endpoint: '/api/audio/convert',
      method: 'POST',
      statusCode: 500
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Audio generation failed'
      }
    });
  }
}

export default withUnhandledRouteFailureLogging(handler);
