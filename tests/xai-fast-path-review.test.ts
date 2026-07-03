#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import axios from 'axios';
import {
  getXaiFastTimeoutMs,
  getXaiFastReasoningEffort,
  getXaiReasoningEffortForModel,
  supportsXaiReasoningParameter
} from '../api/_lib/config/xaiConfig';
import { extractContinuity } from '../api/_lib/story-lab/continuityExtractor';
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

function buildContinuityInput(useAi = true) {
  return {
    storyId: 'test-story',
    currentState: {
      storyId: 'test-story',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      continuityWarnings: [],
      narrativeVoice: '',
      lastUpdatedAt: ''
    },
    chapters: [],
    summary: {
      storyId: 'test-story',
      title: 'Test Story',
      synopsis: '',
      tone: 'romance',
      spicyLevel: 3,
      createdAt: '',
      updatedAt: ''
    },
    useAi
  };
}

async function captureConsoleWarn<T>(fn: () => Promise<T>): Promise<{ result: T; calls: unknown[][] }> {
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    return {
      result: await fn(),
      calls
    };
  } finally {
    console.warn = originalWarn;
  }
}

async function assertContinuityFastTimeoutUsesConfiguredBudget(): Promise<void> {
  const originalApiKey = process.env['XAI_API_KEY'];
  const originalFastTimeout = process.env['XAI_STORY_FAST_TIMEOUT_MS'];
  const originalGenerateText = XaiTextClient.prototype.generateText;
  const capturedTimeouts: number[] = [];

  try {
    process.env['XAI_API_KEY'] = 'test-xai-key';
    process.env['XAI_STORY_FAST_TIMEOUT_MS'] = '2345';
    XaiTextClient.prototype.generateText = async function (request) {
      capturedTimeouts.push(request.timeoutMs);
      return { text: '{}', model: 'grok-4.3', latencyMs: 0 };
    };

    const continuityInput = buildContinuityInput(true);

    await extractContinuity(continuityInput);
    await extractContinuity({
      ...continuityInput,
      timeoutMs: 1234
    });
    const lowBudgetResult = await extractContinuity({
      ...continuityInput,
      timeoutMs: 999
    });

    assert.equal(capturedTimeouts[0], getXaiFastTimeoutMs(), 'continuity extraction should use the configured fast timeout by default');
    assert.equal(capturedTimeouts[1], 1234, 'continuity extraction should use the remaining request budget when provided');
    assert.equal(capturedTimeouts.length, 2, 'subsecond remaining budget should skip the xAI continuity request');
    assert.equal(lowBudgetResult.receipt.source, 'heuristic', 'subsecond remaining budget should fall back to heuristic continuity extraction');
    assert.equal(
      lowBudgetResult.receipt.warning,
      'AI continuity extraction skipped because the request budget was nearly exhausted.',
      'subsecond remaining budget should explain the budget skip'
    );
  } finally {
    XaiTextClient.prototype.generateText = originalGenerateText;

    if (originalApiKey === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = originalApiKey;
    }

    if (originalFastTimeout === undefined) {
      delete process.env['XAI_STORY_FAST_TIMEOUT_MS'];
    } else {
      process.env['XAI_STORY_FAST_TIMEOUT_MS'] = originalFastTimeout;
    }
  }
}

async function assertContinuityHeuristicWarningPriority(): Promise<void> {
  const originalApiKey = process.env['XAI_API_KEY'];

  try {
    delete process.env['XAI_API_KEY'];
    const result = await extractContinuity(buildContinuityInput(false));

    assert.equal(result.receipt.source, 'heuristic', 'disabled AI continuity should use heuristic extraction');
    assert.equal(
      result.receipt.warning,
      'AI continuity extraction disabled for this run.',
      'explicitly disabled AI should take warning priority over a missing API key'
    );
  } finally {
    if (originalApiKey === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = originalApiKey;
    }
  }
}

function assertReasoningConfig(): void {
  const originalEffort = process.env['XAI_STORY_REASONING_EFFORT'];
  try {
    delete process.env['XAI_STORY_REASONING_EFFORT'];
    assert.equal(supportsXaiReasoningParameter(undefined as never), false, 'missing model should not throw while checking reasoning support');
    assert.equal(supportsXaiReasoningParameter(null as never), false, 'null model should not throw while checking reasoning support');
    assert.equal(supportsXaiReasoningParameter('grok-4.3'), true, 'grok-4.3 should accept reasoning.effort');
    assert.equal(getXaiFastReasoningEffort(), 'none', 'fast Grok requests should disable reasoning');
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'fast'), 'none', 'grok-4.3 fast path should send none reasoning');
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'primary'), 'medium', 'grok-4.3 primary path should keep the configured default reasoning');

    process.env['XAI_STORY_REASONING_EFFORT'] = 'none';
    assert.equal(getXaiReasoningEffortForModel('grok-4.3', 'primary'), 'none', 'grok-4.3 primary path should allow configured none reasoning');
    assert.equal(getXaiReasoningEffortForModel('grok-4.20-multi-agent', 'primary'), 'medium', 'multi-agent primary path should reject none reasoning');

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
    let failSameModelPrimaryAttempt = true;
    (axios as unknown as { post: typeof axios.post }).post = (async (_url: string, payload: unknown, config: unknown) => {
      capturedPosts.push({
        payload: payload as Record<string, unknown>,
        config: config as CapturedPost['config']
      });

      if (failSameModelPrimaryAttempt) {
        failSameModelPrimaryAttempt = false;
        const error = new Error('timeout') as Error & { code?: string };
        error.code = 'ETIMEDOUT';
        throw error;
      }

      return {
        data: {
          output_text: 'same model fallback result',
          usage: {
            input_tokens: 6,
            output_tokens: 4,
            total_tokens: 10
          }
        }
      };
    }) as typeof axios.post;

    const sameModelFallbackClient = new XaiTextClient();
    const sameModelFallback = await captureConsoleWarn(() =>
      sameModelFallbackClient.generateText(buildRequest(undefined, true))
    );
    const sameModelFallbackResponse = sameModelFallback.result;
    const sameModelFallbackWarnings = JSON.stringify(sameModelFallback.calls);
    assert.equal(capturedPosts.length, 2, 'same model fallback should retry when the fast reasoning profile differs');
    assert.equal((capturedPosts[0].payload['reasoning'] as { effort?: string }).effort, 'medium', 'same model primary attempt should use primary reasoning');
    assert.equal((capturedPosts[1].payload['reasoning'] as { effort?: string }).effort, 'none', 'same model retry should use fast no-reasoning profile');
    assert.equal(capturedPosts[1].config.timeout, 5678, 'same model retry should use fallback timeout budget');
    assert.equal(sameModelFallbackResponse.reasoningEffort, 'none', 'same model fallback metadata should report fast none reasoning');
    assert.equal(sameModelFallbackResponse.fallbackFromModel, 'grok-4.3', 'same model fallback metadata should record the primary model');
    assert(sameModelFallbackWarnings.includes('fast profile'), 'same model fallback warning should describe a fast profile retry');
    assert(sameModelFallbackWarnings.includes('primaryReasoningEffort'), 'same model fallback warning should include primary reasoning effort');
    assert(sameModelFallbackWarnings.includes('fastReasoningEffort'), 'same model fallback warning should include fast reasoning effort');

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

async function assertStoryLabContinuityBudgetUsesRemainingRequestWindow(): Promise<void> {
  const { getStoryLabContinuityTimeoutMs } = await import('../api/_lib/story-lab/storyLabEngine') as {
    getStoryLabContinuityTimeoutMs?: (requestStartedAtMs: number, nowMs?: number) => number;
  };
  const originalFastTimeout = process.env['XAI_STORY_FAST_TIMEOUT_MS'];
  const originalFunctionBudget = process.env['STORY_LAB_FUNCTION_BUDGET_MS'];
  const originalFallbackFunctionBudget = process.env['FUNCTION_BUDGET_MS'];

  try {
    process.env['XAI_STORY_FAST_TIMEOUT_MS'] = '40000';
    delete process.env['STORY_LAB_FUNCTION_BUDGET_MS'];
    delete process.env['FUNCTION_BUDGET_MS'];
    assert.equal(typeof getStoryLabContinuityTimeoutMs, 'function', 'Story Lab engine should expose its continuity timeout budget calculation');
    assert.equal(getStoryLabContinuityTimeoutMs(0, 10000), 40000, 'early requests should keep the configured fast timeout');
    assert.equal(getStoryLabContinuityTimeoutMs(0, 30000), 25000, 'late requests should cap continuity extraction to remaining function budget');
    assert.equal(getStoryLabContinuityTimeoutMs(0, 59500), 0, 'nearly exhausted requests should skip AI continuity extraction');

    process.env['STORY_LAB_FUNCTION_BUDGET_MS'] = '15000';
    assert.equal(getStoryLabContinuityTimeoutMs(0, 9000), 1000, 'configured Story Lab budget should cap continuity extraction');

    delete process.env['STORY_LAB_FUNCTION_BUDGET_MS'];
    process.env['FUNCTION_BUDGET_MS'] = '20000';
    assert.equal(getStoryLabContinuityTimeoutMs(0, 10000), 5000, 'generic function budget fallback should cap continuity extraction');
  } finally {
    if (originalFastTimeout === undefined) {
      delete process.env['XAI_STORY_FAST_TIMEOUT_MS'];
    } else {
      process.env['XAI_STORY_FAST_TIMEOUT_MS'] = originalFastTimeout;
    }

    if (originalFunctionBudget === undefined) {
      delete process.env['STORY_LAB_FUNCTION_BUDGET_MS'];
    } else {
      process.env['STORY_LAB_FUNCTION_BUDGET_MS'] = originalFunctionBudget;
    }

    if (originalFallbackFunctionBudget === undefined) {
      delete process.env['FUNCTION_BUDGET_MS'];
    } else {
      process.env['FUNCTION_BUDGET_MS'] = originalFallbackFunctionBudget;
    }
  }
}

async function main(): Promise<void> {
  await assertContinuityFastTimeoutUsesConfiguredBudget();
  await assertContinuityHeuristicWarningPriority();
  assertReasoningConfig();
  await assertXaiClientPayloads();
  assertAiMetadataMerge();
  await assertStoryLabContinuityBudgetUsesRemainingRequestWindow();

  console.log('xAI fast path review regression tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
