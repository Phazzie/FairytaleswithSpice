import { StoryContinuationSeam, ApiEnvelope, StoryIterationPayload } from '../../contracts';
import { buildContinuationResponse } from '../../mockData';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

  const input: StoryContinuationSeam['input'] = req.body;

  if (!input.storyId || !input.storyState) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Continuation requests require storyId and storyState.'
      }
    });
    return;
  }

  const payload: ApiEnvelope<StoryIterationPayload & { appendedChapterNumbers: number[] }> = buildContinuationResponse(input);
  res.status(200).json(payload);
}
