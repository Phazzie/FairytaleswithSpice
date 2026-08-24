import { randomUUID } from 'node:crypto';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { ExportService } from '../_lib/services/exportService';
import { SaveExportSeam } from '../_lib/types/contracts';
import { FILE_SIZE } from '../_lib/constants';
import { ERROR_CODES } from '../_lib/errorCodes';

export default async function handler(req: any, res: any) {
  // Generate or extract request ID for tracking
  const requestId = req.headers['x-request-id'] || 
                    `req_${randomUUID()}`;
  
  // Set request ID in response header for client tracking
  res.setHeader('X-Request-ID', requestId);
  
  const cors = applyCorsPolicy(req, res, {
    methods: ['POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }
    });
  }

  try {
    console.log(`[${requestId}] POST /api/export/save - Request received`);
    
    const input = readJsonObjectBody<SaveExportSeam['input']>(req.body);

    // Validate required fields. A body that is missing entirely fails here, as
    // one more malformed request, rather than throwing on `input.storyId` into
    // the catch block below and reporting the caller's mistake as a 500.
    if (!input || !input.storyId || !input.content || !input.title || !input.format) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format'
        }
      });
    }

    // Validate content length (max 500KB)
    const MAX_CONTENT_LENGTH = FILE_SIZE.MAX_CONTENT_LENGTH_KB * 1000;
    if (input.content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          message: `Content exceeds maximum size of ${FILE_SIZE.MAX_CONTENT_LENGTH_KB}KB`,
          contentLength: input.content.length,
          maxLength: MAX_CONTENT_LENGTH
        }
      });
    }

    const exportService = new ExportService();
    const result = await exportService.saveAndExport(input);
    
    console.log(`[${requestId}] Export ${result.success ? 'succeeded' : 'failed'}`);
    res.status(200).json(result);

  } catch {
    console.error(`[${requestId}] Export serverless function failed`);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
}
