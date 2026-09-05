import { getApiResponseStatus } from '../_lib/http/apiResponseStatus';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { beginPostRoute } from '../_lib/http/postRoutePreamble';
import { ExportService } from '../_lib/services/exportService';
import { SaveExportSeam } from '../_lib/types/contracts';
import { FILE_SIZE, RATE_LIMITS } from '../_lib/constants';
import { ERROR_CODES } from '../_lib/errorCodes';
import { logError, logInfo, logWarn } from '../_lib/utils/logger';
import { withUnhandledRouteFailureLogging } from '../_lib/http/withUnhandledRouteFailureLogging';
import {
  EXPORT_REQUEST_FIELDS,
  toLoggableExportFormat,
  toLoggableFieldNames,
  toLoggableStoryId
} from '../_lib/utils/loggableRequestParameters';

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
 *
 * `creature` and `themes` are the same reasoning one field further on, and they
 * were the two the check above did not cover. Both are optional — an export
 * without them says `Creature: unknown` and lists nothing — but when they are
 * sent they are rendered, and the renderer calls string methods on them too:
 * `escapeHtml` reduces over the value, so an HTML export of `themes: [123]`
 * already threw the `TypeError` this function exists to pre-empt, while the
 * text export of the same body wrote `123` and succeeded. One body, two answers,
 * neither of them the caller error it is. `ImageService.validateImageInput`
 * checks these same two field names for the same reason.
 */
function readExportRequest(body: unknown): SaveExportSeam['input'] | null {
  const input = readJsonObjectBody<SaveExportSeam['input']>(body);
  if (!input || !input.storyId || !input.format) {
    return null;
  }

  if (!isNonEmptyString(input.content) || !isNonEmptyString(input.title)) {
    return null;
  }

  if (input.creature !== undefined && !isNonEmptyString(input.creature)) {
    return null;
  }

  if (input.themes !== undefined && !isArrayOfNonEmptyStrings(input.themes)) {
    return null;
  }

  return input;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isArrayOfNonEmptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

async function handler(req: any, res: any) {
  // Correlation id, `X-Request-ID`, CORS, method, and access control, in the
  // one place all four paid POST routes state them. `null` means the response
  // has already been written and there is nothing left for this handler to do.
  const start = await beginPostRoute(req, res, 'export/save', RATE_LIMITS.EXPORT);
  if (!start) {
    return;
  }

  const requestId = start.requestId;

  try {
    // Through the logger rather than `console.log`, which is what all three of
    // this handler's lines were and what made it the last paid route not on the
    // structured logger. A `console.log` writes a bare string: it skips the
    // redaction every logged value passes through, it never reaches the
    // recent-log buffer an operator reads a failure out of, and the correlation
    // id it interpolates into its own prose is not a field anything can filter
    // on. `/api/image/generate` — the same shape of route, with the same
    // preamble — has logged this way since it was written.
    logInfo('Export endpoint called', {
      requestId,
      endpoint: '/api/export/save',
      method: 'POST'
    });

    const input = readExportRequest(req.body);

    if (!input) {
      // Which fields arrived, so a refusal says what was wrong with the body
      // rather than only that something was. Through the allow-list because a
      // JSON object's keys are whatever the caller wrote, and it is the
      // malformed bodies — the hand-written ones — that take this path.
      logWarn('Invalid input - missing or malformed fields', {
        requestId,
        endpoint: '/api/export/save',
        method: 'POST'
      }, toLoggableFieldNames(req.body, EXPORT_REQUEST_FIELDS));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Missing or malformed fields: storyId, content, title, and format are required; '
            + 'creature, when sent, must be a non-empty string and themes an array of non-empty strings'
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
      // The measurement, never the prose: `contentLength` is a number about the
      // story, which is exactly what `LogContext.requestParameters` is for.
      logWarn('Export content exceeds the size cap', {
        requestId,
        endpoint: '/api/export/save',
        method: 'POST'
      }, { field: 'content', contentLength, maxLength: MAX_CONTENT_LENGTH });

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

    // The title is the other half of the caller's text, and it was the half
    // nothing measured. Every renderer interpolates it — the `.txt` export
    // writes it twice, once as the heading and once as the `=` rule under it;
    // the `.epub` writes it into four XML parts — and the finished document
    // comes back base64-encoded, so the title is the cheapest field to send a
    // lot of and the most expensive one to leave open. Refused with the same
    // code and the same shape as the content cap, naming which field overran so
    // the caller is not left comparing its content against a limit it cleared.
    const titleLength = Buffer.byteLength(input.title, 'utf8');
    if (titleLength > FILE_SIZE.MAX_TITLE_LENGTH_BYTES) {
      logWarn('Export title exceeds the size cap', {
        requestId,
        endpoint: '/api/export/save',
        method: 'POST'
      }, { field: 'title', contentLength: titleLength, maxLength: FILE_SIZE.MAX_TITLE_LENGTH_BYTES });

      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_TOO_LARGE,
          message: `Title exceeds maximum size of ${FILE_SIZE.MAX_TITLE_LENGTH_BYTES} bytes`,
          field: 'title',
          contentLength: titleLength,
          maxLength: FILE_SIZE.MAX_TITLE_LENGTH_BYTES
        }
      });
    }

    const exportService = new ExportService();
    // The correlation id goes with the request, so the envelope's
    // `metadata.requestId` is the id this handler logs under and the id the
    // caller was echoed as `X-Request-ID` — rather than a `req_<uuid>` minted
    // inside the service that appeared in no log line anywhere.
    const result = await exportService.saveAndExport(input, requestId);

    logInfo(`Export ${result.success ? 'succeeded' : 'failed'}`, {
      requestId,
      endpoint: '/api/export/save'
    }, {
      storyId: toLoggableStoryId(input.storyId),
      format: toLoggableExportFormat(input.format)
    });
    res.status(getApiResponseStatus(result)).json(result);

  } catch (error: any) {
    // Bound, and kept. `catch {}` discards the only object that says what went
    // wrong, and the `console.error` inside it wrote one fixed sentence — so a
    // 500 from this route left no name, no message, no code, and no stack
    // anywhere, on either deployment. It was the one paid route whose failures
    // could not be diagnosed at all. `logError` names the fields it keeps and
    // runs them through `redactSensitiveLogData`, which is what makes keeping
    // the error safe on a route whose body is the reader's whole story.
    logError('Export endpoint error', error, {
      requestId,
      endpoint: '/api/export/save',
      method: 'POST',
      statusCode: 500
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Export failed'
      }
    });
  }
}

export default withUnhandledRouteFailureLogging(handler);
