import type { ApiResponse, EvaluationCriteria, EvaluationRequest } from '../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { XaiTextClient } from '../_lib/services/xaiTextClient';
import { getXaiFastTimeoutMs } from '../_lib/config/xaiConfig';
import { buildStoryQualityHeuristicReport } from '../_lib/story-lab/evaluation/storyQualityHeuristics';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { stripMarkdownJsonFence } from '../_lib/utils/modelJsonPayload';
import { FILE_SIZE } from '../_lib/constants';
import { ERROR_CODES } from '../_lib/errorCodes';

interface NormalizedEvaluationRequest {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

function getMockEvaluation(request: NormalizedEvaluationRequest): EvaluationCriteria {
  return {
    score: 75,
    strengths: [
      'Strong opening hook that captures attention',
      'Good sensory details throughout',
      'Effective pacing with appropriate tension building'
    ],
    weaknesses: [
      'Some dialogue feels generic or repetitive',
      'Voice descriptors could be more unique and varied',
      'Cliffhanger could be more impactful'
    ],
    suggestions: [
      'Use more unconventional voice descriptors that combine texture and emotion',
      'Vary dialogue patterns between characters for distinct voices',
      'Strengthen the final scene to increase stakes and reader investment'
    ],
    overallFeedback: 'Solid story with good fundamentals. The pacing works well and sensory details are effective. Main area for improvement is making character voices more distinct and memorable.',
    heuristicReport: buildStoryQualityHeuristicReport(request)
  };
}

function buildEvaluationPrompt(request: NormalizedEvaluationRequest): string {
  return `Evaluate this spicy supernatural romance story:

STORY CONTENT:
${request.storyContent}

CONFIGURATION:
- Creature: ${request.configuration.creature}
- Themes: ${request.configuration.themes.join(', ')}
- Spice Level: ${request.configuration.spicyLevel}/5
- Target Word Count: ${request.configuration.wordCount}

Provide a detailed evaluation covering:
1. Overall quality score (0-100)
2. Top 3-5 strengths
3. Top 3-5 weaknesses or areas for improvement
4. 3-5 specific, actionable suggestions
5. Brief overall feedback (2-3 sentences)

Return only valid JSON with keys score, strengths, weaknesses, suggestions, and overallFeedback.`;
}

const DEFAULT_EVALUATION_SCORE = 75;
const MIN_EVALUATION_SCORE = 0;
const MAX_EVALUATION_SCORE = 100;

/**
 * Read the model's overall score onto the scale the response promises.
 *
 * The prompt asks for 0-100 and the field was taken on the strength of
 * `typeof === 'number'` alone, which is not the same thing. A model answering
 * `8` — these criteria are written against a 1-10 scale about as often as a
 * percentage — or overshooting to `120` was passed through literally, and the
 * frontend renders the field as `{{ score }}/100` and colours it by threshold:
 * a story the model called excellent out of ten was shown to the reader as
 * `8/100` in the red band, and one it called `120` as better than perfect.
 *
 * The `heuristicReport` travelling in the same payload clamps every one of its
 * dimensions to this range already, so without the clamp here the two halves of
 * one response disagreed about what the scale is. Clamping cannot recover the
 * scale the model meant, but it does keep the number inside the one the field
 * is documented and rendered as.
 *
 * A non-finite value cannot come out of `JSON.parse` — JSON has no spelling for
 * one — so the finite check is only here to keep `Math.min`/`Math.max` total;
 * it is the range that a real response gets wrong. Falling back to the same
 * default the missing field uses keeps a usable evaluation — the strengths and
 * suggestions are the substance of it — rather than discarding the whole
 * response over the one number.
 */
function readEvaluationScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_EVALUATION_SCORE;
  }

  return Math.max(MIN_EVALUATION_SCORE, Math.min(MAX_EVALUATION_SCORE, value));
}

/**
 * Exported so the reading of a model response can be asserted on directly. The
 * alternative is driving the route with a configured provider, which would
 * prove nothing about the payload either way.
 */
export function parseEvaluation(content: string): EvaluationCriteria {
  const evaluation = JSON.parse(stripMarkdownJsonFence(content)) as Partial<EvaluationCriteria>;

  return {
    score: readEvaluationScore(evaluation.score),
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
    weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
    suggestions: Array.isArray(evaluation.suggestions) ? evaluation.suggestions : [],
    overallFeedback: typeof evaluation.overallFeedback === 'string'
      ? evaluation.overallFeedback
      : 'Evaluation completed.'
  };
}

/**
 * Turn a request body into the shape the evaluator and the heuristic scan read,
 * or say which field the caller has to fix.
 *
 * Every field was taken on trust. `storyContent` was read as
 * `input.storyContent?.trim()`, which throws for every non-string a JSON body
 * can carry; `themes` was defaulted with `?? []`, which passes a number
 * straight through to the `for (const theme of ...)` in the continuity scan;
 * and `creature` reached `configuration.creature.toLowerCase()` the same way.
 * None of those three throws is inside the route's try block — it wraps the
 * provider call, not the body — so a malformed request became an unhandled
 * rejection the runtime reports as 500, telling the caller the evaluator had
 * failed and that retrying might help. The request is what is malformed and
 * only the caller can fix it, so each field is checked and named.
 *
 * `spicyLevel` and `wordCount` only reach a prompt string, but a caller that
 * sends `"very"` for a level the contract types as a number has made the same
 * mistake and is better told so than quietly evaluated against
 * `Spice Level: very/5`.
 */
function optionalFieldError(
  field: string,
  value: unknown,
  isValid: (value: unknown) => boolean,
  requirement: string
): string | null {
  return value === undefined || isValid(value)
    ? null
    : `configuration.${field} must be ${requirement} when provided.`;
}

function isString(value: unknown): boolean {
  return typeof value === 'string';
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isString);
}

function isFiniteNumber(value: unknown): boolean {
  return Number.isFinite(value);
}

/**
 * The largest story this route will evaluate.
 *
 * `storyContent` was read with no upper bound at all. Everything downstream is
 * sized by it: it is pasted whole into `buildEvaluationPrompt` and sent to xAI
 * as a paid request that no `maxOutputTokens` bounds on the way *in*, and
 * `buildStoryQualityHeuristicReport` runs seven scans over it first. The Express
 * body limit is 10MB and Vercel's is larger still, so a single request could
 * spend the deployment's provider budget and hold a function for its whole
 * timeout — for a story roughly twenty times longer than the 1,500-word batches
 * this app generates.
 *
 * The cap is the one `/api/export/save` already enforces on the same story text,
 * measured the same way. `String.length` counts UTF-16 code units, which
 * undercounts every non-ASCII character, so the measurement is in bytes: a story
 * in a non-Latin script is up to three bytes per unit, and a code-unit cap would
 * admit roughly three times the limit it names.
 */
const MAX_EVALUATION_CONTENT_BYTES = FILE_SIZE.MAX_CONTENT_LENGTH_KB * FILE_SIZE.BYTES_PER_KB;

interface EvaluationRequestError {
  message: string;
  code: string;
}

/**
 * The code every malformed-request answer carried before the size cap gave one
 * of them a code of its own. Named here so the two callers cannot drift.
 */
function invalidRequest(message: string): EvaluationRequestError {
  return { code: 'INVALID_EVALUATION_REQUEST', message };
}

function normalizeEvaluationRequest(
  body: unknown
): { request: NormalizedEvaluationRequest } | EvaluationRequestError {
  const input = readJsonObjectBody<Partial<EvaluationRequest> & {
    configuration?: Partial<EvaluationRequest['configuration']>;
  }>(body);
  if (!input) {
    return invalidRequest('A JSON object body is required.');
  }

  if (typeof input.storyContent !== 'string' || !input.storyContent.trim()) {
    return invalidRequest('storyContent is required and must be a non-empty string.');
  }

  const storyContentBytes = Buffer.byteLength(input.storyContent, 'utf8');
  if (storyContentBytes > MAX_EVALUATION_CONTENT_BYTES) {
    return {
      code: ERROR_CODES.CONTENT_TOO_LARGE,
      message: `storyContent exceeds the maximum size of ${FILE_SIZE.MAX_CONTENT_LENGTH_KB}KB.`
    };
  }

  // A `null` configuration reads as an absent one, which is what `?.` did
  // before and what a serializer that writes absent optionals as `null` means
  // by it. An array is not that: it carries none of the fields and would
  // silently evaluate against every default.
  const configuration = input.configuration ?? undefined;
  if (configuration !== undefined && (typeof configuration !== 'object' || Array.isArray(configuration))) {
    return invalidRequest('configuration must be an object when provided.');
  }

  const creature = configuration?.creature;
  const themes = configuration?.themes;
  const spicyLevel = configuration?.spicyLevel;
  const wordCount = configuration?.wordCount;
  const fieldError =
    optionalFieldError('creature', creature, isString, 'a string') ??
    optionalFieldError('themes', themes, isStringArray, 'an array of strings') ??
    optionalFieldError('spicyLevel', spicyLevel, isFiniteNumber, 'a number') ??
    optionalFieldError('wordCount', wordCount, isFiniteNumber, 'a number');
  if (fieldError) {
    return invalidRequest(fieldError);
  }

  return {
    request: {
      storyContent: input.storyContent,
      configuration: {
        creature: creature ?? 'unknown',
        themes: themes ?? [],
        spicyLevel: spicyLevel ?? 3,
        wordCount: wordCount ?? 900
      }
    }
  };
}

export default async function handler(req: any, res: any) {
  const cors = applyCorsPolicy(req, res, {
    methods: ['POST', 'OPTIONS'],
    credentials: true
  });
  if (cors.handled) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are supported.'
      }
    });
    return;
  }

  const normalized = normalizeEvaluationRequest(req.body);
  if ('message' in normalized) {
    // `CONTENT_TOO_LARGE` stays a 400 rather than a 413, the same reading
    // `getApiResponseStatus` and the export route already use for that code.
    res.status(400).json({
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message
      }
    });
    return;
  }

  const request = normalized.request;

  const xaiClient = new XaiTextClient();
  if (!xaiClient.hasApiKey()) {
    const payload: ApiResponse<EvaluationCriteria> = {
      success: true,
      data: getMockEvaluation(request)
    };
    res.status(200).json(payload);
    return;
  }

  try {
    const evaluationResponse = await xaiClient.generateText({
      operation: 'evaluation',
      system: 'You evaluate spicy supernatural romance stories for craft quality. Return only valid JSON.',
      user: buildEvaluationPrompt(request),
      maxOutputTokens: 1500,
      temperature: 0.3,
      topP: 0.9,
      timeoutMs: getXaiFastTimeoutMs(),
      modelPreference: 'fast',
      allowFallback: false
    });

    const responsePayload: ApiResponse<EvaluationCriteria> = {
      success: true,
      data: {
        ...parseEvaluation(evaluationResponse.text),
        heuristicReport: buildStoryQualityHeuristicReport(request)
      }
    };
    res.status(200).json(responsePayload);
  } catch (error) {
    console.warn('Story Lab evaluation failed.', error);
    const failurePayload: ApiResponse<never> = {
      success: false,
      error: {
        code: 'EVALUATION_FAILED',
        message: 'Grok evaluation is temporarily unavailable.'
      }
    };
    res.status(502).json(failurePayload);
  }
}
