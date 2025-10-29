import { StoryGenerationSeam, ApiEnvelope, StoryIterationPayload } from './contracts';
import { buildGenesisResponse } from './mockData';

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

  const input: StoryGenerationSeam['input'] = req.body;

  if (!input.logline || !input.chapterBatchSize) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BLUEPRINT',
        message: 'Blueprint requires a logline and chapter batch size.'
      }
    });
    return;
  }

  const payload: ApiEnvelope<StoryIterationPayload> = buildGenesisResponse(input);
  res.status(200).json(payload);
}
