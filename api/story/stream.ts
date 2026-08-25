/**
 * Real-Time Story Generation API - Server-Sent Events (SSE)
 * Created: 2025-01-10 21:30
 * 
 * Streams story generation progress and content chunks in real-time
 * Provides immediate feedback during ~21 second generation process
 */

import { StoryService } from '../_lib/services/storyService';
import { randomUUID } from 'node:crypto';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { StoryGenerationSeam, StreamingStoryGenerationSeam, VALIDATION_RULES } from '../_lib/types/contracts';
import { logInfo, logError, logWarn } from '../_lib/utils/logger';
import { toLoggableCreature, toLoggableNumber, toLoggableThemes } from '../_lib/utils/loggableRequestParameters';

const storyService = new StoryService();
const VALID_REQUESTED_CHAPTER_COUNTS = new Set([1, 2, 3]);
const VALID_STREAMING_WORD_COUNTS = new Set<number>(VALIDATION_RULES.wordCount.allowedValues);

/**
 * Serialize one Server-Sent Events frame.
 *
 * A frame is dispatched by the blank line that ends it, so the terminator has
 * to be two real newlines. Written inside a template literal, `\\n\\n` is a
 * backslash followed by `n` — printable text, not a line ending — so every
 * update this route produced ran together into one event that no client ever
 * dispatched: an `EventSource` held the whole generation open and fired
 * `message` exactly never.
 *
 * `JSON.stringify` escapes newlines inside strings, so the payload cannot end
 * the frame early no matter what the story content contains.
 */
export function formatSseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Read one query parameter, tolerating the `string[]` form a repeated parameter
 * arrives in.
 *
 * `?themes=a&themes=b` and `?creature=vampire&creature=witch` are ordinary URLs
 * — a client that builds its `EventSource` target by appending to a
 * `URLSearchParams` produces them without meaning to — and every runtime this
 * route serves hands a repeat over as an array. Read as a string, each one
 * failed in its own way and neither reached the route's own validator:
 *
 * - `themes.split(',')` threw, and the catch block below answered the throw the
 *   only way it knows, with an SSE error frame. It writes that frame before
 *   `writeHead` has run, so the client received a default 200 with no
 *   `text/event-stream` content type — a body no `EventSource` dispatches and
 *   no JSON parser reads — in place of the 400 INVALID_INPUT the route
 *   documents for a malformed `themes`.
 * - `creature` did not throw at all: an array is truthy, so validation passed,
 *   the 200 and the `connected` frame went out, and the story service rejected
 *   the array mid-stream. The caller watched a healthy stream open and then
 *   fail, and the log recorded a 500 for what is a malformed request.
 *
 * Taking the first value matches how this repository reads every other
 * possibly-repeated field — request headers in `corsPolicy` and `security`, and
 * query parameters in the Story Lab blueprint parser.
 */
function readQueryParam(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * Build the generation input an `EventSource` sent as query parameters.
 *
 * Nothing here rejects anything: the fields are read into the contract's shape
 * and the handler's own validator — the one that owns the 400 INVALID_INPUT
 * message — decides whether they are usable. That is the whole point of
 * reading them without throwing.
 */
function readStreamInputFromQuery(query: any): StoryGenerationSeam['input'] {
  const themes = readQueryParam(query?.themes);
  const userInput = readQueryParam(query?.userInput);
  const requestedChapterCount = readQueryParam(query?.requestedChapterCount);

  return {
    creature: readQueryParam(query?.creature) as any,
    themes: themes ? themes.split(',') as any[] : [],
    spicyLevel: Number.parseInt(readQueryParam(query?.spicyLevel) as string, 10) as any,
    wordCount: Number.parseInt(readQueryParam(query?.wordCount) as string, 10) as any,
    userInput: userInput || '',
    requestedChapterCount: (requestedChapterCount
      ? Number.parseInt(requestedChapterCount, 10)
      : undefined) as any
  };
}

/**
 * GET/POST /api/story/stream
 * Implements StreamingStoryGenerationSeam contract
 * Supports GET with query params for EventSource compatibility
 */
export default async function handler(req: any, res: any) {
  const requestId = req.headers['x-request-id'] || 
                    `req_${randomUUID()}`;
  
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    logWarn('Method not allowed', { requestId, endpoint: '/api/story/stream', method: req.method });
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET/POST allowed' }
    });
  }

  try {
    // Support both POST body and GET query params for EventSource compatibility
    const input: StoryGenerationSeam['input'] = req.method === 'GET'
      ? readStreamInputFromQuery(req.query)
      : req.body;

    // Validate input
    if (
      !input ||
      !input.creature ||
      !Array.isArray(input.themes) ||
      !Number.isInteger(input.spicyLevel) ||
      input.spicyLevel < 1 ||
      input.spicyLevel > 5 ||
      !Number.isInteger(input.wordCount) ||
      !VALID_STREAMING_WORD_COUNTS.has(input.wordCount)
    ) {
      logWarn('Invalid streaming input', { requestId, endpoint: '/api/story/stream' }, { receivedFields: input ? Object.keys(input) : [] });
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_INPUT', 
          message: `Invalid or missing fields: creature, themes, spicyLevel, wordCount. wordCount must be one of ${VALIDATION_RULES.wordCount.allowedValues.join(', ')}.`
        }
      });
    }

    if (
      input.requestedChapterCount !== undefined &&
      !VALID_REQUESTED_CHAPTER_COUNTS.has(input.requestedChapterCount)
    ) {
      logWarn('Invalid requested chapter count', { requestId, endpoint: '/api/story/stream' }, {
        requestedChapterCount: input.requestedChapterCount
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'requestedChapterCount must be 1, 2, or 3'
        }
      });
    }

    logInfo('Starting streaming story generation', {
      requestId,
      endpoint: '/api/story/stream',
      method: req.method,
      requestParameters: {
        creature: toLoggableCreature(input.creature),
        // This route builds `themes` by splitting a query string, so every
        // entry is caller text until it is matched against the allow-list.
        ...toLoggableThemes(input.themes),
        spicyLevel: toLoggableNumber(input.spicyLevel),
        wordCount: toLoggableNumber(input.wordCount),
        requestedChapterCount: toLoggableNumber(input.requestedChapterCount)
      }
    });

    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('X-Request-ID', requestId);
    // Only the status. `writeHead`'s header argument takes precedence over
    // everything `setHeader` has already put on the response, so repeating a
    // subset of these headers here overwrote them: `Cache-Control` went out as
    // `no-cache`, dropping the `no-transform` set two lines above — the one
    // directive that stops an intermediary from compressing or re-chunking the
    // body, which is the same buffering `X-Accel-Buffering: no` is here to
    // prevent. A proxy that buffers an SSE stream holds every update until the
    // generation finishes, which is the whole thing this route exists to avoid.
    // The CORS headers were already written by `applyCorsPolicy`, and the
    // content type and connection headers are set immediately above, so there
    // is nothing left for the argument to carry. This is what the sibling
    // `/api/story-lab/stream/genesis` route and the job stream already do.
    res.writeHead(200);

    const streamId = `stream_${randomUUID()}`;

    // Send initial connection message per contract
    const connectedUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
      streamId: streamId,
      type: 'connected',
      isComplete: false,
      metadata: {
        wordsGenerated: 0,
        totalWordsTarget: input.wordCount,
        estimatedWordsRemaining: input.wordCount,
        generationSpeed: 0,
        percentage: 0
      }
    };
    res.write(formatSseFrame(connectedUpdate));

    // Generate story with streaming per seam contract
    await storyService.generateStoryStreaming(input, (chunk) => {
      const progressUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
        streamId: streamId,
        storyId: `story_${streamId}`,
        type: chunk.isComplete ? 'complete' : 'chunk',
        content: chunk.content,
        isComplete: chunk.isComplete,
        metadata: {
          wordsGenerated: chunk.wordsGenerated,
          totalWordsTarget: input.wordCount,
          estimatedWordsRemaining: chunk.estimatedWordsRemaining,
          generationSpeed: chunk.generationSpeed,
          percentage: Math.min((chunk.wordsGenerated / input.wordCount) * 100, 100),
          estimatedTimeRemaining: chunk.estimatedWordsRemaining / Math.max(chunk.generationSpeed, 1)
        }
      };
      
      res.write(formatSseFrame(progressUpdate));
    });

    res.end();

  } catch (error: any) {
    // The method the request actually used. It was hard-coded to `POST`, and
    // GET is the path an `EventSource` takes — the reason this route accepts a
    // query at all — so every browser-side streaming failure was recorded as a
    // POST. That is the one field that tells whoever reads the log whether the
    // input came from a JSON body or from the query, which is where the two
    // paths differ and where a malformed request would have come from.
    logError('Streaming story generation failed', error, {
      requestId,
      endpoint: '/api/story/stream',
      method: req.method,
      statusCode: 500
    });
    
    // An SSE error frame is only readable once the stream has been opened. A
    // failure before `writeHead` leaves the response with no status and no
    // `text/event-stream` content type, so writing the frame anyway sends a
    // default 200 carrying a body that neither an `EventSource` nor a JSON
    // client can read — the failure reaches the caller as a success. Before the
    // stream exists, the answer is an ordinary JSON error.
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'STREAM_FAILED',
          message: 'Story streaming could not be started.'
        }
      });
    }

    const errorUpdate: StreamingStoryGenerationSeam['progressUpdate'] = {
      streamId: 'error_stream',
      type: 'error',
      isComplete: true,
      metadata: {
        wordsGenerated: 0,
        totalWordsTarget: 0,
        estimatedWordsRemaining: 0,
        generationSpeed: 0,
        percentage: 0
      }
    };

    res.write(formatSseFrame(errorUpdate));
    res.end();
  }
}
