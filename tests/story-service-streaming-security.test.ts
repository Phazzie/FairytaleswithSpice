#!/usr/bin/env tsx
// Created: 2026-06-05 01:02 EDT

import { StoryService } from '../api/_lib/services/storyService';
import type { StoryGenerationSeam } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function withEnvAsync<T>(updates: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
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
    return await fn();
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

const input: StoryGenerationSeam['input'] = {
  creature: 'vampire',
  themes: ['forbidden_love'],
  userInput: 'A dangerous pact at midnight.',
  spicyLevel: 3,
  wordCount: 600,
  requestedChapterCount: 1
};

async function main() {
  await withEnvAsync({ XAI_API_KEY: undefined, NODE_ENV: 'production', VERCEL_ENV: undefined }, async () => {
    const service = new StoryService();
    let chunkCount = 0;

    try {
      await service.generateStoryStreaming(input, () => {
        chunkCount++;
      });
      throw new Error('streaming generation should fail closed in production without XAI_API_KEY');
    } catch (error) {
      assert(error instanceof Error, 'streaming fail-closed error should be an Error');
      assert(error.message.includes('XAI_API_KEY'), 'streaming fail-closed error should name the missing provider key');
      assert(chunkCount === 0, 'streaming fail-closed path should not emit mock chunks');
    }
  });

  console.log('Story service streaming security tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
