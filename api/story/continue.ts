import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { applyRequestId } from '../_lib/http/requestId';
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
  // This route generated an id, logged every line under it, and never sent it,
  // so the caller of the request could not name the id its failure was recorded
  // under — and a caller that did send `X-Request-ID` had it ignored, splitting
  // the two sides of one request across two ids.
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
    logWarn('Method not allowed', { requestId, endpoint: '/api/story/continue', method: req.method });
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

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
