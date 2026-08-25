import { randomUUID } from 'node:crypto';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { StoryService } from '../_lib/services/storyService';
import { ChapterContinuationSeam } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import { toLoggableIdentifier, toLoggableNumber } from '../_lib/utils/loggableRequestParameters';

export default async function handler(req: any, res: any) {
  const requestId = `req_${randomUUID()}`;
  
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
      }, { receivedFields: input ? Object.keys(input) : [] });
      
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
        storyId: toLoggableIdentifier(input.storyId),
        currentChapterCount: toLoggableNumber(input.currentChapterCount),
        existingContentLength: input.existingContent.length
      }
    });

    const storyService = new StoryService();
    const result = await storyService.continueChapter(input);
    
    res.status(200).json(result);

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
