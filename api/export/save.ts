import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { readRequestCorrelationId } from '../_lib/http/requestCorrelationId';
import { enforceApiAccessControl } from '../_lib/middleware/apiAccessControl';
import { ExportService } from '../_lib/services/exportService';
import { SaveExportSeam } from '../_lib/types/contracts';
import { FILE_SIZE, RATE_LIMITS } from '../_lib/constants';
import { ERROR_CODES } from '../_lib/errorCodes';

/**
 * Read an export request, or say the body cannot be served.
 *
 * A body that is missing entirely fails here, as one more malformed request,
 * rather than throwing on `input.storyId` into the handler's catch block and
 * reporting the caller's mistake as a 500.
 *
 * `content` and `title` have to be text, not merely present. Every branch of
 * the export renderer calls `String` methods on them, and a JSON body can carry
 * a number or an object under either name — both truthy, so a presence check
 * let them through. The renderer then threw a `TypeError` inside
 * `saveAndExport`, whose catch answers `EXPORT_FAILED`: the caller was told the
 * export had failed and that retrying might help, when it is the request that is
 * malformed and only the caller can fix it. It is also what makes the byte
 * measurement below safe, since `Buffer.byteLength` of a number throws.
 */
function readExportRequest(body: unknown): SaveExportSeam['input'] | null {
  const input = readJsonObjectBody<SaveExportSeam['input']>(body);
  if (!input || !input.storyId || !input.format) {
    return null;
  }

  if (!isNonEmptyString(input.content) || !isNonEmptyString(input.title)) {
    return null;
  }

  return input;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export default async function handler(req: any, res: any) {
  // Accept the caller's correlation id when it is one, otherwise mint it: the
  // value is echoed below and stamped into every log line this request writes.
  const requestId = readRequestCorrelationId(req);

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

  const access = await enforceApiAccessControl(req, res, 'export/save', RATE_LIMITS.EXPORT);
  if (!access.allowed) {
    return;
  }

  try {
    console.log(`[${requestId}] POST /api/export/save - Request received`);

    const input = readExportRequest(req.body);

    if (!input) {
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
    res.status(getApiResponseStatus(result)).json(result);

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
