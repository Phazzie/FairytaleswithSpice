// Created: 2026-08-25 08:14 UTC

import { randomUUID } from 'node:crypto';
import { readJsonObjectBody } from '../../api/_lib/http/jsonRequestBody';
import { endSseStream, SseResponseLike, writeSseFrame } from '../../api/_lib/http/sseStream';
import { StoryService } from '../../api/_lib/services/storyService';
import { StoryGenerationSeam, VALIDATION_RULES } from '../../api/_lib/types/contracts';

const ALLOWED_WORD_COUNTS = new Set<number>(VALIDATION_RULES.wordCount.allowedValues);

export interface StoryStreamChunk {
  content: string;
  isComplete: boolean;
  wordsGenerated: number;
  estimatedWordsRemaining: number;
  generationSpeed: number;
}

export interface StoryStreamRequestLike {
  body?: unknown;
}

export interface StoryStreamResponseLike extends SseResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): StoryStreamResponseLike;
  json(body: unknown): void;
}

/**
 * `POST /api/story/stream` for the Node/Docker deployment.
 *
 * Lifted out of `server.ts` so the streaming lifecycle can be driven by a test.
 * The serverless `/api/story/stream` is the same route on the other stack, and
 * had already been fixed for the three faults below; this one had not, so the
 * deployment a reader actually reaches over Docker or DigitalOcean still
 * carried all three.
 */
export async function handleStoryStreamRequest(
  req: StoryStreamRequestLike,
  res: StoryStreamResponseLike,
  createStoryService: () => StoryService = () => new StoryService()
): Promise<void> {
  const input = readStreamInput(req.body);
  if (!input) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message:
          'Invalid or missing fields: creature, themes, spicyLevel, wordCount. '
          + `wordCount must be one of ${VALIDATION_RULES.wordCount.allowedValues.join(', ')}.`
      }
    });
    return;
  }

  const streamId = `stream_${randomUUID()}`;

  try {
    // Inside the `try`: opening the stream is itself something that fails —
    // a socket the reader has already closed, a proxy that rejected the
    // upgrade — and a failure there is precisely the one the catch below has
    // to answer as JSON, because no frame has gone out for a client to read.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    writeSseFrame(res, { type: 'connected', streamId });

    await createStoryService().generateStoryStreaming(input, chunk => {
      writeSseFrame(res, buildStreamFrame(chunk, input.wordCount, streamId));

      if (chunk.isComplete) {
        endSseStream(res);
      }
    });

    // The generation resolving is the only thing that reliably means it is
    // over. Ending was reachable *only* from a chunk carrying `isComplete`, and
    // nothing guarantees one arrives: the fast path returns whole, the provider
    // can close a stream after its last content chunk, and a generation that
    // yields no content at all emits nothing to carry the flag. The response
    // then stayed open on a generation that had already finished, so the reader
    // watched a spinner until their own browser or the platform's idle timeout
    // gave up — the story was written, and no client ever saw it end. Ending
    // here is a no-op when a completion chunk already did it.
    endSseStream(res);
  } catch (error: any) {
    console.error('Streaming generation error:', error);

    // An SSE error frame is only readable once the stream has been opened.
    // Failing before the first frame goes out leaves the response with no
    // status and no `text/event-stream` content type, so writing the frame
    // anyway sends a default 200 carrying a body that neither an `EventSource`
    // nor a JSON client can read — the failure reaches the caller as a success.
    if (res.headersSent !== true) {
      res.status(500).json({
        success: false,
        error: {
          code: 'STREAM_FAILED',
          message: 'Story streaming could not be started.'
        }
      });
      return;
    }

    // Both guarded: the throw can just as easily arrive *after* a completion
    // chunk ended the response — the story service does its own bookkeeping
    // once the last chunk is out — and writing to an ended response answers
    // with `ERR_STREAM_WRITE_AFTER_END`, thrown from here and replacing the
    // failure being reported with an unrelated one.
    writeSseFrame(res, {
      type: 'error',
      error: {
        code: 'GENERATION_FAILED',
        message: error?.message || 'Story generation failed'
      }
    });
    endSseStream(res);
  }
}

function buildStreamFrame(
  chunk: StoryStreamChunk,
  wordCount: number,
  streamId: string
): Record<string, unknown> {
  if (chunk.isComplete) {
    return {
      type: 'complete',
      content: chunk.content,
      storyId: `story_${streamId}`,
      metadata: {
        wordsGenerated: chunk.wordsGenerated,
        generationSpeed: chunk.generationSpeed,
        percentage: 100
      }
    };
  }

  return {
    type: 'chunk',
    content: chunk.content,
    metadata: {
      wordsGenerated: chunk.wordsGenerated,
      estimatedWordsRemaining: chunk.estimatedWordsRemaining,
      generationSpeed: chunk.generationSpeed,
      // `wordCount` is one of the contract's allowed counts by the time this
      // runs, so the division has a real divisor. The check used to be
      // `!input.wordCount`, which passes anything truthy: `"lots"` divided into
      // a word count is `NaN`, and `Math.min(NaN, 100)` is `NaN`, so every
      // frame carried `percentage: null` once `JSON.stringify` was through with
      // it and the progress bar never moved. The value also went on to the
      // story service, whose own validator rejected it — several seconds into a
      // stream the route had already reported as healthy, as a 500, for a
      // request that was malformed before any of it started.
      percentage: Math.min((chunk.wordsGenerated / wordCount) * 100, 100)
    }
  };
}

/**
 * Read the generation input, or `null` when the caller has to be told 400.
 *
 * Matches the validation the serverless twin performs, which is stricter than
 * the truthiness checks this route had in two ways that matter: the body is
 * required to be a JSON object at all — a missing one, or one sent without
 * `Content-Type: application/json`, used to reach `input.creature` and crash
 * into the catch block, reporting the service as broken for a request only the
 * caller can fix — and `wordCount` is required to be one of the counts the
 * contract allows rather than merely truthy.
 */
function readStreamInput(body: unknown): StoryGenerationSeam['input'] | null {
  const candidate = readJsonObjectBody<Partial<StoryGenerationSeam['input']>>(body);
  if (!candidate) {
    return null;
  }

  const isValid = typeof candidate.creature === 'string'
    && candidate.creature.length > 0
    && Array.isArray(candidate.themes)
    && Number.isInteger(candidate.spicyLevel)
    && (candidate.spicyLevel as number) >= VALIDATION_RULES.spicyLevel.min
    && (candidate.spicyLevel as number) <= VALIDATION_RULES.spicyLevel.max
    && Number.isInteger(candidate.wordCount)
    && ALLOWED_WORD_COUNTS.has(candidate.wordCount as number);

  return isValid ? (candidate as StoryGenerationSeam['input']) : null;
}
