import type { ApiEnvelope } from './contracts';

interface EvaluationCriteria {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overallFeedback: string;
}

interface EvaluationRequest {
  storyContent?: string;
  configuration?: {
    creature?: string;
    themes?: string[];
    spicyLevel?: number;
    wordCount?: number;
  };
}

interface NormalizedEvaluationRequest {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

function getMockEvaluation(): EvaluationCriteria {
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
    overallFeedback: 'Solid story with good fundamentals. The pacing works well and sensory details are effective. Main area for improvement is making character voices more distinct and memorable.'
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
  const jsonText = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const evaluation = JSON.parse(jsonText) as Partial<EvaluationCriteria>;

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

export default async function handler(req: any, res: any) {
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
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

  const input = req.body as EvaluationRequest;
  if (!input.storyContent?.trim()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_EVALUATION_REQUEST',
        message: 'storyContent is required.'
      }
    });
    return;
  }

  const request: NormalizedEvaluationRequest = {
    storyContent: input.storyContent,
    configuration: {
      creature: input.configuration?.creature ?? 'unknown',
      themes: input.configuration?.themes ?? [],
      spicyLevel: input.configuration?.spicyLevel ?? 3,
      wordCount: input.configuration?.wordCount ?? 900
    }
  };

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      success: true,
      data: getMockEvaluation()
    });
    return;
  }

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-4-fast-reasoning',
        messages: [
          {
            role: 'system',
            content: 'You evaluate spicy supernatural romance stories for craft quality. Return only valid JSON.'
          },
          {
            role: 'user',
            content: buildEvaluationPrompt(request)
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      throw new Error(`xAI evaluation failed with ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('xAI evaluation response did not include content.');
    }

    res.status(200).json({
      success: true,
      data: parseEvaluation(content)
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: getMockEvaluation(),
      error: {
        code: 'EVALUATION_FALLBACK',
        message: error instanceof Error ? error.message : 'Evaluation failed; returned mock feedback.'
      }
    });
  }
}
