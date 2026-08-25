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
    // `content` and `title` are read as text below and by every branch of the
    // export renderer, which calls `String` methods on them. A JSON body can
    // carry a number or an object under either name, and both are truthy, so a
    // presence check let them through: the renderer threw a `TypeError` inside
    // `saveAndExport`, whose catch reports `EXPORT_FAILED` — the caller was
    // told the export had failed rather than that its request was malformed.
    if (
      !input ||
      !input.storyId ||
      typeof input.content !== 'string' || !input.content ||
      typeof input.title !== 'string' || !input.title ||
      !input.format
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing required fields: storyId, content, title, format'
        }
      });
    }

    // The cap is a size in kilobytes, so it has to be measured in bytes.
    // `String.length` counts UTF-16 code units, which undercounts every
    // non-ASCII character a story contains — the same confusion
    // `ExportService` reports `fileSize` with `Buffer.byteLength` to avoid. A
    // story written in any non-Latin script is up to three bytes per unit, so
    // the 500KB limit admitted roughly 1.5MB of it; the `contentLength` the
    // refusal reported was not a byte count either, and `1000` bytes to the
    // kilobyte contradicted the `BYTES_PER_KB` this repository defines.
    const MAX_CONTENT_LENGTH = FILE_SIZE.MAX_CONTENT_LENGTH_KB * FILE_SIZE.BYTES_PER_KB;
    const contentLength = Buffer.byteLength(input.content, 'utf8');
    if (contentLength > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          message: `Content exceeds maximum size of ${FILE_SIZE.MAX_CONTENT_LENGTH_KB}KB`,
          contentLength,
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
