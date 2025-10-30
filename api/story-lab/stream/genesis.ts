// Created: 2025-10-29 08:27 UTC

import type { NextApiRequest, NextApiResponse } from 'next';

import type {
  ApiEnvelope,
  StoryGenerationSeam,
  StoryIterationPayload,
  StreamingProgressChunk,
  ThemeSeed
} from '../../contracts';
import { buildGenesisResponse } from '../../mockData';

const ACCESS_CONTROL_METHODS = 'GET, OPTIONS';
const ACCESS_CONTROL_HEADERS = 'Content-Type';

type GenesisResponse = ApiEnvelope<StoryIterationPayload>;

type ParsedBlueprint = { blueprint: StoryGenerationSeam['input']; error?: undefined } | { blueprint?: undefined; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:4200';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', ACCESS_CONTROL_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ACCESS_CONTROL_HEADERS);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
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
      error: { code: 'INVALID_BLUEPRINT', message: parsed.error }
    });
    return;
  }

  let genesis: GenesisResponse;
  try {
    genesis = buildGenesisResponse(parsed.blueprint);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate mock response.'
      }
    });
    return;
  }

  const storyId = genesis.data?.summary.storyId ?? `story-${Date.now()}`;
  const totalChapters = genesis.data?.batch.chapters.length ?? 0;

  res.writeHead(200, {
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

  req.socket.on('close', () => {
    cleanup();
  });

  const sendChunk = (chunk: StreamingProgressChunk | GenesisResponse) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  sendChunk({
    type: 'connected',
    storyId,
    percentage: 0,
    estimatedMsRemaining: totalChapters * 500
  });

  genesis.data?.batch.chapters.forEach((chapter, index) => {
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
    cleanup();
    res.end();
  }, (totalChapters + 1) * 500);

  timeouts.push(completionTimeout);
}

function parseBlueprint(req: NextApiRequest): ParsedBlueprint {
  try {
    const getString = (value: string | string[] | undefined): string | undefined => {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    };

    const parseNumber = (value: string | string[] | undefined): number | undefined => {
      const raw = getString(value);
      if (!raw) return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const parseThemes = (value: string | string[] | undefined): ThemeSeed[] => {
      const raw = getString(value);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(isThemeSeed);
        }
      } catch {
        // swallow parse errors and fall back to empty list
      }
      return [];
    };

    const chapterBatchSize = parseNumber(req.query.chapterBatchSize);
    const desiredWordBudget = parseNumber(req.query.desiredWordBudget);
    const spicyLevel = parseNumber(req.query.spicyLevel);

    if (!chapterBatchSize || ![1, 2, 3].includes(chapterBatchSize)) {
      return { error: 'chapterBatchSize must be 1, 2, or 3.' };
    }

    if (!desiredWordBudget) {
      return { error: 'desiredWordBudget is required.' };
    }

    if (!spicyLevel) {
      return { error: 'spicyLevel is required.' };
    }

    const logline = getString(req.query.logline)?.trim();
    if (!logline) {
      return { error: 'logline is required.' };
    }

    const creature = getString(req.query.creature) as StoryGenerationSeam['input']['creature'];
    const tone = (getString(req.query.tone) ?? 'dark_romance') as StoryGenerationSeam['input']['tone'];

    const blueprint: StoryGenerationSeam['input'] = {
      creature,
      tone,
      logline,
      spicyLevel: spicyLevel as StoryGenerationSeam['input']['spicyLevel'],
      desiredWordBudget: desiredWordBudget as StoryGenerationSeam['input']['desiredWordBudget'],
      chapterBatchSize: chapterBatchSize as StoryGenerationSeam['input']['chapterBatchSize'],
      themes: parseThemes(req.query.themes),
      narrativeDirectives: getString(req.query.narrativeDirectives) ?? undefined
    };

    return { blueprint };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to parse blueprint.'
    };
  }
}

function isThemeSeed(value: unknown): value is ThemeSeed {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.label === 'string' && typeof candidate.description === 'string';
}
