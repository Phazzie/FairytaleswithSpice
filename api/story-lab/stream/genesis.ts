// Created: 2025-10-29 08:27 UTC

import type {
  ApiEnvelope,
  StoryGenerationSeam,
  StoryIterationPayload,
  StreamingProgressChunk,
  ThemeSeed
} from '../../_lib/story-lab/contracts';
import { generateStoryLabGenesis } from '../../_lib/story-lab/storyLabEngine';

const ACCESS_CONTROL_METHODS = 'GET, OPTIONS';
const ACCESS_CONTROL_HEADERS = 'Content-Type';
const VALID_CREATURES: ReadonlyArray<StoryGenerationSeam['input']['creature']> = ['vampire', 'werewolf', 'fairy', 'siren', 'djinn'];
const VALID_TONES: ReadonlyArray<StoryGenerationSeam['input']['tone']> = ['romance', 'dark_romance', 'mystery', 'adventure', 'comedy', 'tragedy'];
const VALID_SPICY_LEVELS: ReadonlyArray<StoryGenerationSeam['input']['spicyLevel']> = [1, 2, 3, 4, 5];
const VALID_WORD_BUDGETS: ReadonlyArray<StoryGenerationSeam['input']['desiredWordBudget']> = [600, 900, 1200, 1500];
const VALID_BATCH_SIZES: ReadonlyArray<StoryGenerationSeam['input']['chapterBatchSize']> = [1, 2, 3];

type GenesisResponse = ApiEnvelope<StoryIterationPayload>;

type ParsedBlueprint = { blueprint: StoryGenerationSeam['input']; error?: undefined } | { blueprint?: undefined; error: string };

export default async function handler(req: any, res: any) {
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
    cleanup();
    res.end();
    return;
  }

  if (!genesis.success) {
    sendChunk({
      type: 'error',
      percentage: 100,
      error: genesis.error
    });
    cleanup();
    res.end();
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
    cleanup();
    res.end();
  }, (totalChapters + 1) * 500);

  timeouts.push(completionTimeout);
}

function parseBlueprint(req: any): ParsedBlueprint {
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

    if (!isOneOf(VALID_BATCH_SIZES, chapterBatchSize)) {
      return { error: 'chapterBatchSize must be 1, 2, or 3.' };
    }

    if (!isOneOf(VALID_WORD_BUDGETS, desiredWordBudget)) {
      return { error: 'desiredWordBudget must be 600, 900, 1200, or 1500.' };
    }

    if (!isOneOf(VALID_SPICY_LEVELS, spicyLevel)) {
      return { error: 'spicyLevel must be between 1 and 5.' };
    }

    const logline = getString(req.query.logline)?.trim();
    if (!logline) {
      return { error: 'logline is required.' };
    }

    const rawCreature = getString(req.query.creature);
    if (!isOneOf(VALID_CREATURES, rawCreature)) {
      return { error: 'creature must be vampire, werewolf, fairy, siren, or djinn.' };
    }

    const rawTone = getString(req.query.tone) ?? 'dark_romance';
    if (!isOneOf(VALID_TONES, rawTone)) {
      return { error: 'tone is not supported.' };
    }

    const blueprint: StoryGenerationSeam['input'] = {
      creature: rawCreature,
      tone: rawTone,
      logline,
      spicyLevel,
      desiredWordBudget,
      chapterBatchSize,
      themes: parseThemes(req.query.themes),
      narrativeDirectives: getString(req.query.narrativeDirectives) ?? undefined,
      protagonistName: getString(req.query.protagonistName) ?? undefined,
      antagonistName: getString(req.query.antagonistName) ?? undefined,
      worldDetails: getString(req.query.worldDetails) ?? undefined
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

function isOneOf<T extends string | number>(allowed: readonly T[], value: unknown): value is T {
  return allowed.includes(value as T);
}
