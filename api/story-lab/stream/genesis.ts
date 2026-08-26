// Created: 2025-10-29 08:27 UTC

import type {
  ApiEnvelope,
  StoryIterationPayload,
  StreamingProgressChunk
} from '../../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../../_lib/http/corsPolicy';
import { sendMethodNotAllowed } from '../../_lib/http/methodNotAllowed';
import { endSseStream, writeSseFrame } from '../../_lib/http/sseStream';
import { RATE_LIMITS } from '../../_lib/constants';
import { enforceApiAccessControl, withEventStreamAuth } from '../../_lib/middleware/apiAccessControl';
import { generateStoryLabGenesis } from '../../_lib/story-lab/storyLabEngine';
import {
  parseStoryLabBlueprintFromQuery,
  type StoryLabBlueprintParseResult
} from '../../_lib/story-lab/validation/blueprintParser';

type GenesisResponse = ApiEnvelope<StoryIterationPayload>;

/** What this route serves, for CORS and for `Allow` alike. */
const GENESIS_STREAM_METHODS = ['GET', 'OPTIONS'];

export default async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: GENESIS_STREAM_METHODS,
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if (req.method !== 'GET') {
    sendMethodNotAllowed(res, GENESIS_STREAM_METHODS, 'Only GET requests are supported for streaming.');
    return;
  }

  // `EventSource` cannot set custom headers, so this checks for the key
  // through `withEventStreamAuth`'s `apiKey` query-parameter fallback as well
  // as the usual headers — see that helper for why.
  const access = await enforceApiAccessControl(
    withEventStreamAuth(req),
    res,
    'story-lab/stream/genesis',
    RATE_LIMITS.STREAMING
  );
  if (!access.allowed) {
    return;
  }

  const parsed = parseBlueprint(req);
  if (parsed.error) {
    res.status(400).json({
      success: false,
      error: { code: parsed.error.code, message: parsed.error.message }
    });
    return;
  }

  res.writeHead(200, {
    ...cors.headers,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // The one header that makes the staggering below observable. nginx buffers
    // a proxied response by default and will hold every frame until the
    // response closes, which for this route means the reader sees nothing for
    // the whole generation and then the finished story all at once — the exact
    // outcome streaming exists to avoid, on the Docker/DigitalOcean deployment
    // that puts a proxy in front of the app. `no-transform` above tells an
    // intermediary not to recompress the body; this tells nginx not to hold it.
    // The route this repository's other SSE implementation sent it from was
    // retired, and this one had never sent it.
    'X-Accel-Buffering': 'no'
  });

  const timeouts: NodeJS.Timeout[] = [];
  const cleanup = () => {
    while (timeouts.length) {
      const timeout = timeouts.pop();
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };

  /**
   * A reader who closes the tab — or an `EventSource` the Angular service
   * unsubscribes — ends this request while the generation is still in flight.
   * Clearing the timer list was the whole of the response to that, and the list
   * is empty for the entire time the generation runs, so the close did nothing:
   * everything after the `await` went on as if the reader were still there. The
   * route scheduled one fresh timer per chapter plus a completion timer on a
   * socket nobody is reading, held the serverless invocation open until the last
   * of them fired, and wrote every frame into a destroyed stream. The flag is
   * what makes a disconnect stick past the point where it was noticed.
   */
  let clientDisconnected = false;

  req.socket?.on?.('close', () => {
    clientDisconnected = true;
    cleanup();
  });

  /**
   * The flag says the reader left; the stream itself says whether a write can
   * still land, and only the second of those is always available. The listener
   * above is optional-chained because `req.socket` is not guaranteed — and on a
   * runtime that does not supply it, the flag stays `false` for a reader who is
   * already gone. Every per-chapter timer then writes into a destroyed
   * response, and because those writes happen inside a `setTimeout` callback
   * with no `try` around it, the `ERR_STREAM_DESTROYED` they answer with is an
   * uncaught exception rather than a handled one. Framing through the shared
   * helpers reads `res.destroyed` and skips the write instead.
   */
  const sendChunk = (chunk: StreamingProgressChunk | GenesisResponse) => {
    if (clientDisconnected) {
      return;
    }

    writeSseFrame(res, chunk);
  };

  const endStream = () => {
    cleanup();
    if (!clientDisconnected) {
      endSseStream(res);
    }
  };

  sendChunk({
    type: 'connected',
    percentage: 0,
    estimatedMsRemaining: parsed.blueprint.chapterBatchSize * 90000
  });

  let genesis: GenesisResponse;
  try {
    genesis = await generateStoryLabGenesis(parsed.blueprint);
  } catch (error) {
    sendChunk({
      type: 'error',
      percentage: 100,
      error: {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate response.'
      }
    });
    endStream();
    return;
  }

  if (clientDisconnected) {
    return;
  }

  if (!genesis.success) {
    sendChunk({
      type: 'error',
      percentage: 100,
      error: genesis.error
    });
    endStream();
    return;
  }

  const storyId = genesis.data.summary.storyId;
  const totalChapters = genesis.data.batch.chapters.length;

  genesis.data.batch.chapters.forEach((chapter, index) => {
    const timeout = setTimeout(() => {
      const progress: StreamingProgressChunk = {
        type: 'chapter_progress',
        storyId,
        chapterNumber: chapter.chapterNumber,
        partialHtml: chapter.htmlContent,
        percentage: Math.round(((index + 1) / Math.max(totalChapters, 1)) * 100),
        estimatedMsRemaining: Math.max(totalChapters - (index + 1), 0) * 500
      };

      sendChunk(progress);
    }, (index + 1) * 500);

    timeouts.push(timeout);
  });

  const completionTimeout = setTimeout(() => {
    sendChunk({
      type: 'batch_complete',
      storyId,
      percentage: 100
    });

    sendChunk(genesis);
    endStream();
  }, (totalChapters + 1) * 500);

  timeouts.push(completionTimeout);
}

export function parseBlueprint(req: any): StoryLabBlueprintParseResult {
  return parseStoryLabBlueprintFromQuery(req.query ?? {});
}
