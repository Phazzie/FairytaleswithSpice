// Created: 2025-10-29 08:27 UTC

import type {
  ApiEnvelope,
  StoryIterationPayload,
  StreamingProgressChunk
} from '../../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../../_lib/http/corsPolicy';
import { generateStoryLabGenesis } from '../../_lib/story-lab/storyLabEngine';
import {
  parseStoryLabBlueprintFromQuery,
  type StoryLabBlueprintParseResult
} from '../../_lib/story-lab/validation/blueprintParser';

type GenesisResponse = ApiEnvelope<StoryIterationPayload>;

export default async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: ['GET', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are supported for streaming.' }
    });
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
    Connection: 'keep-alive'
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

  const sendChunk = (chunk: StreamingProgressChunk | GenesisResponse) => {
    if (clientDisconnected) {
      return;
    }

    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  const endStream = () => {
    cleanup();
    if (!clientDisconnected) {
      res.end();
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
