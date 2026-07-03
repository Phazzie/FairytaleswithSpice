#!/usr/bin/env tsx
// Created: 2026-06-21 20:57 UTC

import genesisHandler, { createStoryLabGenesisHandler } from '../api/story-lab/stories';
import continuationHandler, { createStoryLabContinuationHandler } from '../api/story-lab/stories/[storyId]/continue';
import { getStoryLabResponseStatus } from '../api/_lib/story-lab/routeStatus';

interface FakeRequest {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
    this.ended = true;
  }

  end(): void {
    this.ended = true;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function captureConsoleError(fn: () => Promise<void>): Promise<unknown[][]> {
  const originalError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  return fn()
    .then(() => calls)
    .finally(() => {
      console.error = originalError;
    });
}

async function withEnv(updates: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(updates)) {
    previous.set(key, process.env[key]);
    const value = updates[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createRequest(method: string, body?: unknown): FakeRequest {
  return {
    method,
    body,
    headers: {}
  };
}

function createBlueprint() {
  return {
    creature: 'siren',
    tone: 'dark_romance',
    logline: 'A siren diplomat risks exile for a forbidden lover.',
    spicyLevel: 3,
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    themes: [{
      id: 'forbidden_love',
      label: 'Forbidden Love',
      description: 'A relationship that breaks supernatural law.'
    }],
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'dangerous_proximity',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    }
  };
}

function createContinuationBody() {
  const now = new Date().toISOString();
  return {
    storyId: 'story-route-status',
    chapterBatchSize: 1,
    storyState: {
      storyId: 'story-route-status',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      narrativeVoice: 'tense romantic fantasy',
      continuityWarnings: [],
      lastUpdatedAt: now
    },
    previouslyGeneratedChapters: [{
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      htmlContent: '<h3>Chapter 1</h3><p>Mira entered the court.</p>',
      rawContent: 'Mira entered the court.',
      summary: 'Mira entered the court.',
      wordCount: 5,
      hasCliffhanger: true
    }],
    continuationBrief: 'Raise the danger.'
  };
}

async function main(): Promise<void> {
  assert(getStoryLabResponseStatus(null as never) === 500, 'null response payload should map to 500');
  assert(getStoryLabResponseStatus({} as never) === 500, 'malformed response payload should map to 500');
  assert(getStoryLabResponseStatus({ success: true } as never) === 500, 'success response without data should map to 500');
  assert(getStoryLabResponseStatus({ success: true, data: null } as never) === 500, 'success response with null data should map to 500');
  assert(
    getStoryLabResponseStatus({ success: false } as never) === 500,
    'missing error payload should map to 500'
  );

  await withEnv({ NODE_ENV: 'production', VERCEL_ENV: undefined, XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    await genesisHandler(createRequest('POST', createBlueprint()), response);

    assert(response.statusCode === 503, `missing provider genesis should return 503, got ${response.statusCode}`);
    assert((response.body as { success?: boolean }).success === false, 'missing provider genesis should return an error payload');
  });

  await withEnv({ NODE_ENV: 'production', VERCEL_ENV: undefined, XAI_API_KEY: undefined, STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    await continuationHandler(createRequest('POST', createContinuationBody()), response);

    assert(response.statusCode === 503, `missing provider continuation should return 503, got ${response.statusCode}`);
    assert((response.body as { success?: boolean }).success === false, 'missing provider continuation should return an error payload');
  });

  await withEnv({ NODE_ENV: undefined, VERCEL_ENV: undefined, XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    await genesisHandler(createRequest('POST', {
      ...createBlueprint(),
      heatContract: {
        ...createBlueprint().heatContract,
        adultOnlyConfirmed: false
      }
    }), response);

    assert(response.statusCode === 400, `content-policy genesis failure should return 400, got ${response.statusCode}`);
  });

  await withEnv({ NODE_ENV: undefined, VERCEL_ENV: undefined, XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    const handler = createStoryLabGenesisHandler(async () => {
      throw new Error('secret genesis payload');
    });

    const errorLogs = await captureConsoleError(async () => {
      await handler(createRequest('POST', createBlueprint()), response);
    });

    assert(response.statusCode === 500, `unexpected genesis throw should return 500, got ${response.statusCode}`);
    assert((response.body as { success?: boolean }).success === false, 'unexpected genesis throw should return an error payload');
    assert(errorLogs.length === 1, 'unexpected genesis throw should emit one redacted error log');
    assert(JSON.stringify(errorLogs).includes('generateGenesis'), 'genesis error log should include operation name');
    assert(JSON.stringify(errorLogs).includes('Error'), 'genesis error log should include error type');
    assert(!JSON.stringify(errorLogs).includes('secret genesis payload'), 'genesis error log should not include raw error message');
  });

  await withEnv({ NODE_ENV: undefined, VERCEL_ENV: undefined, XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    const handler = createStoryLabContinuationHandler(async () => {
      throw new Error('secret continuation payload');
    });

    const errorLogs = await captureConsoleError(async () => {
      await handler(createRequest('POST', createContinuationBody()), response);
    });

    assert(response.statusCode === 500, `unexpected continuation throw should return 500, got ${response.statusCode}`);
    assert((response.body as { success?: boolean }).success === false, 'unexpected continuation throw should return an error payload');
    assert(errorLogs.length === 1, 'unexpected continuation throw should emit one redacted error log');
    assert(JSON.stringify(errorLogs).includes('continueStory'), 'continuation error log should include operation name');
    assert(JSON.stringify(errorLogs).includes('Error'), 'continuation error log should include error type');
    assert(!JSON.stringify(errorLogs).includes('secret continuation payload'), 'continuation error log should not include raw error message');
  });

  console.log('Story Lab route status tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
