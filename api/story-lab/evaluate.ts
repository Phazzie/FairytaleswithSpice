import type { ApiResponse, EvaluationCriteria, EvaluationRequest } from '../_lib/story-lab/contracts';
import { applyCorsPolicy } from '../_lib/http/corsPolicy';
import { XaiTextClient } from '../_lib/services/xaiTextClient';
import { getXaiFastTimeoutMs } from '../_lib/config/xaiConfig';
import { buildStoryQualityHeuristicReport } from '../_lib/story-lab/evaluation/storyQualityHeuristics';
import { readJsonObjectBody } from '../_lib/http/jsonRequestBody';
import { stripMarkdownJsonFence } from '../_lib/utils/modelJsonPayload';

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

function parseEvaluation(content: string): EvaluationCriteria {
  const evaluation = JSON.parse(stripMarkdownJsonFence(content)) as Partial<EvaluationCriteria>;

  return {
    score: typeof evaluation.score === 'number' ? evaluation.score : 75,
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

  // A `null` configuration reads as an absent one, which is what `?.` did
  // before and what a serializer that writes absent optionals as `null` means
  // by it. An array is not that: it carries none of the fields and would
  // silently evaluate against every default.
  const configuration = input.configuration ?? undefined;
  if (configuration !== undefined && (typeof configuration !== 'object' || Array.isArray(configuration))) {
    return { message: 'configuration must be an object when provided.' };
  }

  const creature = configuration?.creature;
  if (creature !== undefined && typeof creature !== 'string') {
    return { message: 'configuration.creature must be a string when provided.' };
  }

  const themes = configuration?.themes;
  if (themes !== undefined && (!Array.isArray(themes) || !themes.every(theme => typeof theme === 'string'))) {
    return { message: 'configuration.themes must be an array of strings when provided.' };
  }

  const spicyLevel = configuration?.spicyLevel;
  if (spicyLevel !== undefined && !Number.isFinite(spicyLevel)) {
    return { message: 'configuration.spicyLevel must be a number when provided.' };
  }

  const wordCount = configuration?.wordCount;
  if (wordCount !== undefined && !Number.isFinite(wordCount)) {
    return { message: 'configuration.wordCount must be a number when provided.' };
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
