import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { RATE_LIMITS } from '../_lib/constants';
import { StoryService } from '../_lib/services/storyService';
import { ChapterContinuationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import {
  CHAPTER_CONTINUATION_REQUEST_FIELDS,
  toLoggableFieldNames,
  toLoggableNumber,
  toLoggableStoryId
} from '../_lib/utils/loggableRequestParameters';

export default async function handler(req: any, res: any) {
  // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
  // one place all four paid POST routes state them. `null` means the response
  // has already been written and there is nothing left for this handler to do.
  const start = await beginPostRoute(req, res, 'story/continue', RATE_LIMITS.CHAPTER_CONTINUATION);
  if (!start) {
    return;
  }

  const requestId = start.requestId;

  try {
    const input = readJsonObjectBody<ChapterContinuationSeam['input']>(req.body);

    // Validate required fields. A body that is missing entirely fails here, as
    // one more malformed request, rather than throwing on `input.storyId` into
    // the catch block below and reporting the caller's mistake as a 500.
    if (!input || !input.storyId || !input.existingContent || typeof input.currentChapterCount !== 'number') {
      logWarn('Invalid input - missing required fields', {
        requestId,
        endpoint: '/api/story/continue',
        method: 'POST'
        // The field *names* are caller text as much as the values are: a JSON
        // object's keys are whatever the body was written with. Reduced to the
        // contract's own names plus a count of the rest.
      }, toLoggableFieldNames(input, CHAPTER_CONTINUATION_REQUEST_FIELDS));
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, existingContent, currentChapterCount'
        }
      });
    }

    logInfo('Chapter continuation endpoint called', {
      requestId,
      endpoint: '/api/story/continue',
      method: 'POST',
      requestParameters: {
        storyId: toLoggableStoryId(input.storyId),
        currentChapterCount: toLoggableNumber(input.currentChapterCount),
        existingContentLength: input.existingContent.length
      }
    });

    const storyService = new StoryService();
    const result = await storyService.continueChapter(input);
    
    res.status(getApiResponseStatus(result)).json(result);

  } catch (error: any) {
    logError('Chapter continuation endpoint error', error, {
      requestId,
      endpoint: '/api/story/continue',
      method: 'POST',
      statusCode: 500
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Chapter continuation failed'
      }
    });
  }
}
