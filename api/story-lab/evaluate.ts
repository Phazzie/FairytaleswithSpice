import type { ApiResponse, EvaluationCriteria, EvaluationRequest } from '../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { XaiTextClient } from '../_lib/services/xaiTextClient';
import { getXaiFastTimeoutMs } from '../_lib/config/xaiConfig';
import { buildStoryQualityHeuristicReport } from '../_lib/story-lab/evaluation/storyQualityHeuristics';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { stripMarkdownJsonFence } from '../_lib/utils/modelJsonPayload';
import { STORY_EVALUATION_LIMITS } from '../../shared/storyBlueprintLimits';

interface NormalizedEvaluationRequest {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

/**
 * The evaluation a deployment with no Grok key can honestly offer.
 *
 * Every field but `heuristicReport` is canned: a fixed `score: 75` and a fixed
 * set of strengths, weaknesses, and suggestions, written about a story this
 * route never read. That went out as a plain `success: true` with nothing
 * marking it, so the Proving Grounds page — whose entire purpose is A/B
 * comparison of prompts by their scores — showed it exactly as it shows a real
 * Grok evaluation. A reader comparing two variants on a deployment without a key
 * was comparing 75 against 75 and reading the tie as a result.
 *
 * `isMockEvaluation` is the marker the frontend already understands: the client
 * fallback in `PromptEvaluationService` sets it, and `proving-grounds.html`
 * renders the "⚠️ Offline mock evaluation" notice, tags the score in the history
 * and comparison views, and offers "🔁 Retry Evaluation" instead of locking into
 * a false "✅ Evaluated" whenever it is set. The server side had the same
 * fallback and never set it, so the one path that reaches every reader of a
 * keyless deployment was the one path with no warning on it.
 *
 * `heuristicReport` is real either way — it is a deterministic scan of the
 * submitted story, and the successful path attaches the same one beside the
 * model's answer — so it cannot be what tells the two apart.
 */
function getMockEvaluation(request: NormalizedEvaluationRequest): EvaluationCriteria {
  return {
    isMockEvaluation: true,
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
 * Whether every entry of an already-validated string array is short enough to
 * be a theme id rather than prose smuggled in under the field's name.
 */
function isShortStringArray(value: unknown): boolean {
  return isStringArray(value)
    && (value as string[]).length <= STORY_EVALUATION_LIMITS.maxThemes
    && (value as string[]).every(entry => entry.length <= STORY_EVALUATION_LIMITS.maxConfigurationValueLength);
}

function isShortString(value: unknown): boolean {
  return isString(value) && (value as string).length <= STORY_EVALUATION_LIMITS.maxConfigurationValueLength;
}

function normalizeEvaluationRequest(
  body: unknown
): { request: NormalizedEvaluationRequest } | { message: string } {
  const input = readJsonObjectBody<Partial<EvaluationRequest> & {
    configuration?: Partial<EvaluationRequest['configuration']>;
  }>(body);
  if (!input) {
    return { message: 'A JSON object body is required.' };
  }

  if (typeof input.storyContent !== 'string' || !input.storyContent.trim()) {
    return { message: 'storyContent is required and must be a non-empty string.' };
  }

  // The whole of this field is interpolated into the Grok prompt, so an
  // unbounded one is an unbounded paid request: billed by the token, and given
  // the function's entire time budget to send. The caller is the only party who
  // can shorten it, so the answer is 400 rather than a truncation that silently
  // evaluates a story the caller did not send.
  if (input.storyContent.length > STORY_EVALUATION_LIMITS.maxStoryContentLength) {
    return {
      message: `storyContent must be ${STORY_EVALUATION_LIMITS.maxStoryContentLength} characters or fewer.`
    };
  }

  // A `null` configuration reads as an absent one, which is what `?.` did
  // before and what a serializer that writes absent optionals as `null` means
  // by it. An array is not that: it carries none of the fields and would
  // silently evaluate against every default.
  const configuration = input.configuration ?? undefined;
  if (configuration !== undefined && (typeof configuration !== 'object' || Array.isArray(configuration))) {
    return { message: 'configuration must be an object when provided.' };
  }

  const creature = configuration?.creature;
  const themes = configuration?.themes;
  const spicyLevel = configuration?.spicyLevel;
  const wordCount = configuration?.wordCount;
  const fieldError =
    optionalFieldError('creature', creature, isString, 'a string') ??
    optionalFieldError(
      'creature',
      creature,
      isShortString,
      `${STORY_EVALUATION_LIMITS.maxConfigurationValueLength} characters or fewer`
    ) ??
    optionalFieldError('themes', themes, isStringArray, 'an array of strings') ??
    optionalFieldError(
      'themes',
      themes,
      isShortStringArray,
      `no more than ${STORY_EVALUATION_LIMITS.maxThemes} entries of ${STORY_EVALUATION_LIMITS.maxConfigurationValueLength} characters or fewer`
    ) ??
    optionalFieldError('spicyLevel', spicyLevel, isFiniteNumber, 'a number') ??
    optionalFieldError('wordCount', wordCount, isFiniteNumber, 'a number');
  if (fieldError) {
    return { message: fieldError };
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
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_EVALUATION_REQUEST',
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
