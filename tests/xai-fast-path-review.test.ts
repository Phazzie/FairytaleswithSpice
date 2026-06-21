#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axios from 'axios';
import {
  getXaiFastReasoningEffort,
  getXaiReasoningEffortForModel,
  supportsXaiReasoningParameter
} from '../api/_lib/config/xaiConfig';
import { StoryService } from '../api/_lib/services/storyService';
import { XaiTextClient, type XaiTextRequest } from '../api/_lib/services/xaiTextClient';

type CapturedPost = {
  payload: Record<string, unknown>;
  config: {
    timeout?: number;
  };
};

function buildRequest(modelPreference: XaiTextRequest['modelPreference'], allowFallback = false): XaiTextRequest {
  return {
    operation: 'continuity_extraction',
    system: 'Return compact JSON.',
    user: '{"chapters":[]}',
    maxOutputTokens: 64,
    temperature: 0.2,
    topP: 0.9,
    timeoutMs: 1234,
    modelPreference,
    fallbackTimeoutMs: 5678,
    allowFallback
  };
}

function assertContinuityFastTimeoutUsesConfiguredBudget(): void {
  const source = readFileSync(join(process.cwd(), 'api/_lib/story-lab/continuityExtractor.ts'), 'utf-8');

  assert(source.includes('timeoutMs: getXaiFastTimeoutMs()'), 'continuity extraction should use the configured fast timeout budget');
  assert(!source.includes('Math.min(getXaiFastTimeoutMs(), 5000)'), 'continuity extraction should not cap the fast timeout to 5 seconds');
}

function assertReasoningConfig(): void {
  const originalEffort = process.env['XAI_STORY_REASONING_EFFORT'];
  try {
    delete process.env['XAI_STORY_REASONING_EFFORT'];
    assert.equal(supportsXaiReasoningParameter('grok-4.3'), true, 'grok-4.3 should accept reasoning.effort');
    assert.equal(getXaiFastReasoningEffort(), 'none', 'fast Grok requests should disable reasoning');
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'fast'), 'none', 'grok-4.3 fast path should send none reasoning');
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'primary'), 'medium', 'grok-4.3 primary path should keep the configured default reasoning');

    process.env['XAI_STORY_REASONING_EFFORT'] = 'xhigh';
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'primary'), 'high', 'grok-4.3 should not receive multi-agent-only xhigh effort');
    assert.equal(getXaiReasoningEffortForModel('grok-4.20-multi-agent', 'primary'), 'xhigh', 'multi-agent models should keep xhigh effort');
  } finally {
    if (originalEffort === undefined) {
      delete process.env['XAI_STORY_REASONING_EFFORT'];
    } else {
      process.env['XAI_STORY_REASONING_EFFORT'] = originalEffort;
    }
  }
}

async function assertXaiClientPayloads(): Promise<void> {
  const originalApiKey = process.env['XAI_API_KEY'];
  const originalApiUrl = process.env['XAI_RESPONSES_API_URL'];
  const originalStoryModel = process.env['XAI_STORY_MODEL'];
  const originalFastModel = process.env['XAI_FAST_MODEL'];
  const originalEffort = process.env['XAI_STORY_REASONING_EFFORT'];
  const originalPost = axios.post;
  const capturedPosts: CapturedPost[] = [];

  try {
    process.env['XAI_API_KEY'] = 'test-xai-key';
    process.env['XAI_RESPONSES_API_URL'] = 'https://example.invalid/v1/responses';
    process.env['XAI_STORY_MODEL'] = 'grok-4.3';
    process.env['XAI_FAST_MODEL'] = 'grok-4.3';
    delete process.env['XAI_STORY_REASONING_EFFORT'];

    (axios as unknown as { post: typeof axios.post }).post = (async (_url: string, payload: unknown, config: unknown) => {
      capturedPosts.push({
        payload: payload as Record<string, unknown>,
        config: config as CapturedPost['config']
      });

      return {
        data: {
          output_text: 'compact result',
          usage: {
            input_tokens: 4,
            output_tokens: 2,
            total_tokens: 6
          }
        }
      };
    }) as typeof axios.post;

    const client = new XaiTextClient();

    const fastResponse = await client.generateText(buildRequest('fast'));
    assert.equal(fastResponse.reasoningEffort, 'none', 'fast response metadata should report none reasoning');
    assert.equal((capturedPosts[0].payload['reasoning'] as { effort?: string }).effort, 'none', 'fast payload should send reasoning.effort none');
    assert.equal(capturedPosts[0].config.timeout, 1234, 'fast payload should preserve the request timeout');

    const primaryResponse = await client.generateText(buildRequest('primary'));
    assert.equal(primaryResponse.reasoningEffort, 'medium', 'primary response metadata should report configured default reasoning');
    assert.equal((capturedPosts[1].payload['reasoning'] as { effort?: string }).effort, 'medium', 'primary payload should send the configured default reasoning');

    capturedPosts.length = 0;
    process.env['XAI_STORY_MODEL'] = 'grok-4.20-multi-agent';
    process.env['XAI_FAST_MODEL'] = 'grok-4.3';

    let failPrimaryAttempt = true;
    (axios as unknown as { post: typeof axios.post }).post = (async (_url: string, payload: unknown, config: unknown) => {
      capturedPosts.push({
        payload: payload as Record<string, unknown>,
        config: config as CapturedPost['config']
      });

      if (failPrimaryAttempt) {
        failPrimaryAttempt = false;
        const error = new Error('timeout') as Error & { code?: string };
        error.code = 'ETIMEDOUT';
        throw error;
      }

      return {
        data: {
          output_text: 'fallback result',
          usage: {
            input_tokens: 5,
            output_tokens: 3,
            total_tokens: 8
          }
        }
      };
    }) as typeof axios.post;

    const fallbackClient = new XaiTextClient();
    const fallbackResponse = await fallbackClient.generateText(buildRequest(undefined, true));
    assert.equal((capturedPosts[0].payload['reasoning'] as { effort?: string }).effort, 'medium', 'primary multi-agent payload should use primary reasoning');
    assert.equal((capturedPosts[1].payload['reasoning'] as { effort?: string }).effort, 'none', 'retry fallback payload should treat grok-4.3 as the fast no-reasoning path');
    assert.equal(capturedPosts[1].config.timeout, 5678, 'retry fallback should use fallback timeout budget');
    assert.equal(fallbackResponse.reasoningEffort, 'none', 'retry fallback metadata should report fast none reasoning');
    assert.equal(fallbackResponse.fallbackFromModel, 'grok-4.20-multi-agent', 'retry fallback metadata should record the primary model');
  } finally {
    (axios as unknown as { post: typeof axios.post }).post = originalPost;

    if (originalApiKey === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = originalApiKey;
    }

    if (originalApiUrl === undefined) {
      delete process.env['XAI_RESPONSES_API_URL'];
    } else {
      process.env['XAI_RESPONSES_API_URL'] = originalApiUrl;
    }

    if (originalStoryModel === undefined) {
      delete process.env['XAI_STORY_MODEL'];
    } else {
      process.env['XAI_STORY_MODEL'] = originalStoryModel;
    }

    if (originalFastModel === undefined) {
      delete process.env['XAI_FAST_MODEL'];
    } else {
      process.env['XAI_FAST_MODEL'] = originalFastModel;
    }

    if (originalEffort === undefined) {
      delete process.env['XAI_STORY_REASONING_EFFORT'];
    } else {
      process.env['XAI_STORY_REASONING_EFFORT'] = originalEffort;
    }
  }
}

function assertAiMetadataMerge(): void {
  const service = new StoryService() as unknown as {
    mergeAiMetadata(existing: unknown, next: unknown): { model?: string; reasoningEffort?: string; fallbackFromModel?: string } | undefined;
  };

  const sameModel = service.mergeAiMetadata(
    { model: 'grok-4.3', reasoningEffort: 'medium' },
    { model: 'grok-4.3' }
  );
  assert.equal(sameModel?.reasoningEffort, 'medium', 'same model should keep existing reasoning when the next call omits it');

  const changedModel = service.mergeAiMetadata(
    { model: 'grok-4.20-multi-agent', reasoningEffort: 'medium' },
    { model: 'grok-4.3' }
  );
  assert.equal(changedModel?.reasoningEffort, undefined, 'changed model should not inherit stale reasoning metadata');

  const explicitFastReasoning = service.mergeAiMetadata(
    { model: 'grok-4.20-multi-agent', reasoningEffort: 'medium' },
    { model: 'grok-4.3', reasoningEffort: 'none', fallbackFromModel: 'grok-4.20-multi-agent' }
  );
  assert.equal(explicitFastReasoning?.reasoningEffort, 'none', 'explicit fast reasoning metadata should be preserved');
  assert.equal(explicitFastReasoning?.fallbackFromModel, 'grok-4.20-multi-agent', 'fallback metadata should still be preserved');
}

async function main(): Promise<void> {
  assertContinuityFastTimeoutUsesConfiguredBudget();
  assertReasoningConfig();
  await assertXaiClientPayloads();
  assertAiMetadataMerge();

  console.log('xAI fast path review regression tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
