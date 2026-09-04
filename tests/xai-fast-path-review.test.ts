#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import axios from 'axios';
import {
  FUNCTION_BUDGET_RESERVE_MS,
  getFunctionBudgetMs,
  getXaiFastTimeoutMs,
  getXaiFastReasoningEffort,
  getXaiPrimaryTimeoutMs,
  getXaiReasoningEffortForModel,
  supportsXaiReasoningParameter
} from '../api/_lib/config/xaiConfig';
import { extractContinuity } from '../api/_lib/story-lab/continuityExtractor';
import { StoryService } from '../api/_lib/services/storyService';
import {
  MIN_XAI_FALLBACK_TIMEOUT_MS,
  XaiTextClient,
  type XaiTextRequest
} from '../api/_lib/services/xaiTextClient';

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

type ContinuityInput = ReturnType<typeof buildContinuityInput>;
type ContinuityResult = Awaited<ReturnType<typeof extractContinuity>>;

async function withXaiApiKey<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const original = process.env['XAI_API_KEY'];

  try {
    if (value === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = value;
    }

    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = original;
    }
  }
}

/**
 * The shared shape every skip/failure branch of `extractContinuity` has to
 * satisfy: the given warning, zero confidence, and characters/threads/
 * artifacts left exactly as they were. Every branch below has its own way of
 * getting there (disabled AI, missing key, low budget, provider error), but
 * once there they all make the same "nothing was extracted" promise — this
 * is that promise checked in one place instead of re-typed per branch.
 */
function assertNoContinuityFactsExtracted(
  result: ContinuityResult,
  currentState: ContinuityInput['currentState'],
  expectedWarning: string,
  label: string
): void {
  assert.equal(result.receipt.warning, expectedWarning, `${label}: should explain that nothing was extracted`);
  assert.equal(result.receipt.confidence, 0, `${label}: has no facts to be confident about`);
  assert.deepEqual(result.state.characters, currentState.characters, `${label}: must leave the character list exactly as it was`);
  assert.deepEqual(result.state.threads, currentState.threads, `${label}: must leave the thread list exactly as it was`);
  assert.deepEqual(result.state.artifacts, currentState.artifacts, `${label}: must leave the artifact list exactly as it was`);
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
    const boundaryBudgetResult = await extractContinuity({
      ...continuityInput,
      timeoutMs: 1000
    });

    assert.equal(capturedTimeouts[0], getXaiFastTimeoutMs(), 'continuity extraction should use the configured fast timeout by default');
    assert.equal(capturedTimeouts[1], 1234, 'continuity extraction should use the remaining request budget when provided');
    assert.equal(capturedTimeouts[2], 1000, 'exactly 1000ms remaining budget should still call xAI continuity extraction');
    assert.equal(capturedTimeouts.length, 3, 'subsecond remaining budget should skip the xAI continuity request while the 1000ms boundary still calls xAI');
    assert.equal(lowBudgetResult.receipt.source, 'heuristic', 'subsecond remaining budget should fall back to heuristic continuity extraction');
    assertNoContinuityFactsExtracted(
      lowBudgetResult,
      continuityInput.currentState,
      'AI continuity extraction skipped because the request budget was nearly exhausted — the character, thread, and artifact list did not update this batch.',
      'a budget-exhausted skip'
    );
    assert.equal(boundaryBudgetResult.receipt.source, 'ai', '1000ms remaining budget should still use AI continuity extraction');
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
  await withXaiApiKey(undefined, async () => {
    const continuityInput = buildContinuityInput(false);
    const result = await extractContinuity(continuityInput);

    assert.equal(result.receipt.source, 'heuristic', 'disabled AI continuity should use heuristic extraction');
    assertNoContinuityFactsExtracted(
      result,
      continuityInput.currentState,
      'AI continuity extraction disabled for this run — the character, thread, and artifact list did not update this batch.',
      'an explicitly disabled run (which takes warning priority over a missing API key)'
    );
  });
}

/**
 * The missing-`XAI_API_KEY` skip branch is a third, distinct way into the
 * same no-op passthrough as the two tests above — `!input.useAi` takes
 * priority over it (covered above), and a low budget takes priority over it
 * too (covered in `assertContinuityFastTimeoutUsesConfiguredBudget`), but
 * nothing previously exercised useAi:true with a configured budget and no
 * key at all, which is its own reachable state with its own warning text.
 */
async function assertContinuityMissingApiKeySkipLeavesStateUnchanged(): Promise<void> {
  await withXaiApiKey(undefined, async () => {
    const continuityInput = buildContinuityInput(true);
    const result = await extractContinuity(continuityInput);

    assert.equal(result.receipt.source, 'heuristic', 'a missing API key should fall back to the heuristic receipt');
    assertNoContinuityFactsExtracted(
      result,
      continuityInput.currentState,
      'Continuity tracking is unavailable because XAI_API_KEY is not configured — the character, thread, and artifact list did not update this batch.',
      'a missing API key'
    );
  });
}

/**
 * `extractContinuity`'s catch block used to fabricate a `confidence: 0.45`
 * and call itself "fallback extraction" on a provider error, exactly like the
 * skip branches above — but nothing in this repository had ever asserted that
 * a provider failure actually leaves `characters`/`threads`/`artifacts`
 * unchanged. It does; this proves it, and proves the warning says so.
 */
async function assertContinuityProviderErrorLeavesStateUnchanged(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;

  try {
    XaiTextClient.prototype.generateText = async function () {
      throw new Error('simulated provider failure');
    };

    await withXaiApiKey('test-xai-key', async () => {
      const continuityInput = buildContinuityInput(true);
      const result = await extractContinuity(continuityInput);
      const expectedWarning = 'Grok continuity extraction failed for this batch — the character, thread, and artifact list did not update.';

      assert.equal(result.receipt.source, 'mixed', 'a provider failure should be reported as a mixed/fallback receipt');
      assertNoContinuityFactsExtracted(result, continuityInput.currentState, expectedWarning, 'a provider failure');
      assert(
        result.state.continuityWarnings.includes(expectedWarning),
        'the failure warning should be recorded on the story state too, not just the receipt'
      );
    });
  } finally {
    XaiTextClient.prototype.generateText = originalGenerateText;
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
    const boundedSameModelFallbackRequest = {
      ...buildRequest(undefined, true),
      fallbackTimeoutMs: 678
    };
    const sameModelFallback = await captureConsoleWarn(() =>
      sameModelFallbackClient.generateText(boundedSameModelFallbackRequest)
    );
    const sameModelFallbackResponse = sameModelFallback.result;
    const sameModelFallbackWarnings = JSON.stringify(sameModelFallback.calls);
    assert.equal(capturedPosts.length, 2, 'same model fallback should retry when the fast reasoning profile differs');
    assert.equal((capturedPosts[0].payload['reasoning'] as { effort?: string }).effort, 'medium', 'same model primary attempt should use primary reasoning');
    assert.equal((capturedPosts[1].payload['reasoning'] as { effort?: string }).effort, 'none', 'same model retry should use fast no-reasoning profile');
    assert.equal(capturedPosts[1].config.timeout, 678, 'same model retry should use a bounded fallback timeout budget');
    assert.equal(sameModelFallbackResponse.reasoningEffort, 'none', 'same model fallback metadata should report fast none reasoning');
    assert.equal(sameModelFallbackResponse.fallbackFromModel, 'grok-4.3', 'same model fallback metadata should record the primary model');
    assert(sameModelFallbackWarnings.includes('fast profile'), 'same model fallback warning should describe a fast profile retry');
    assert(sameModelFallbackWarnings.includes('primaryReasoningEffort'), 'same model fallback warning should include primary reasoning effort');
    assert(sameModelFallbackWarnings.includes('fastReasoningEffort'), 'same model fallback warning should include fast reasoning effort');

    capturedPosts.length = 0;
    failSameModelPrimaryAttempt = true;
    process.env['XAI_STORY_MODEL'] = 'Grok-4.3';
    process.env['XAI_FAST_MODEL'] = 'grok-4.3';
    const unboundedSameModelFallbackClient = new XaiTextClient();
    await assert.rejects(
      () => unboundedSameModelFallbackClient.generateText({
        ...buildRequest(undefined, true),
        timeoutMs: 40000,
        fallbackTimeoutMs: 40000
      }),
      /xAI service temporarily unavailable/,
      'same model fallback should be skipped when the fallback timeout is not bounded'
    );
    assert.equal(capturedPosts.length, 1, 'unbounded same model fallback should not make a second provider call');

    capturedPosts.length = 0;
    (axios as unknown as { post: typeof axios.post }).post = (async (_url: string, payload: unknown, config: unknown) => {
      capturedPosts.push({
        payload: payload as Record<string, unknown>,
        config: config as CapturedPost['config']
      });
      throw 'primitive timeout';
    }) as typeof axios.post;

    const primitiveErrorClient = new XaiTextClient();
    await assert.rejects(
      () => primitiveErrorClient.generateText({
        ...buildRequest(undefined, true),
        timeoutMs: 40000,
        fallbackTimeoutMs: 1000
      }),
      /xAI service temporarily unavailable/,
      'primitive provider errors should be converted without crashing retry gating'
    );
    assert.equal(capturedPosts.length, 1, 'primitive provider errors should not make a fallback call');

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

/**
 * The fast-profile retry used to be given `fallbackTimeoutMs` whatever the
 * primary attempt had already spent, and both timeouts default to 40 seconds
 * against an invocation the platform kills at 60. So a deployment with a
 * distinct `XAI_FAST_MODEL` — the configuration the fallback exists for — could
 * spend 40 seconds on the primary attempt and start another 40-second call: the
 * function was terminated with the retry still in flight, and the caller got
 * the platform's timeout instead of the `AI_UNAVAILABLE` envelope this client
 * exists to produce.
 *
 * The budget is driven through the environment rather than through a clock,
 * because it is the same reading `getStoryLabContinuityTimeoutMs` uses and
 * `FUNCTION_BUDGET_MS` is how a deployment states it.
 */
async function assertFastProfileRetryFitsInsideTheInvocationBudget(): Promise<void> {
  const originalApiKey = process.env['XAI_API_KEY'];
  const originalApiUrl = process.env['XAI_RESPONSES_API_URL'];
  const originalStoryModel = process.env['XAI_STORY_MODEL'];
  const originalFastModel = process.env['XAI_FAST_MODEL'];
  const originalFunctionBudget = process.env['STORY_LAB_FUNCTION_BUDGET_MS'];
  const originalFallbackFunctionBudget = process.env['FUNCTION_BUDGET_MS'];
  const originalPost = axios.post;
  const capturedPosts: CapturedPost[] = [];

  try {
    process.env['XAI_API_KEY'] = 'test-xai-key';
    process.env['XAI_RESPONSES_API_URL'] = 'https://example.invalid/v1/responses';
    process.env['XAI_STORY_MODEL'] = 'grok-4.20-multi-agent';
    process.env['XAI_FAST_MODEL'] = 'grok-4.3';
    delete process.env['STORY_LAB_FUNCTION_BUDGET_MS'];

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

      return { data: { output_text: 'bounded fallback result' } };
    }) as typeof axios.post;

    // A window with room to spare leaves the requested fallback timeout alone.
    process.env['FUNCTION_BUDGET_MS'] = '60000';
    const roomyClient = new XaiTextClient();
    await captureConsoleWarn(() => roomyClient.generateText(buildRequest(undefined, true)));
    assert.equal(capturedPosts.length, 2, 'a request with budget to spare should still retry on the fast profile');
    assert.equal(capturedPosts[1].config.timeout, 5678, 'a retry that fits should keep the timeout it asked for');

    // A window smaller than the requested retry shortens it rather than
    // overrunning the invocation.
    capturedPosts.length = 0;
    failPrimaryAttempt = true;
    // 10500 leaves 5500ms once the finalization reserve is held back: room for
    // a retry, but less than the 5678 the request asks for.
    process.env['FUNCTION_BUDGET_MS'] = '10500';
    const tightClient = new XaiTextClient();
    await captureConsoleWarn(() => tightClient.generateText(buildRequest(undefined, true)));
    assert.equal(capturedPosts.length, 2, 'a shortened retry should still be attempted');
    const shortenedTimeout = capturedPosts[1].config.timeout;
    assert(
      shortenedTimeout !== undefined && shortenedTimeout > 5000 && shortenedTimeout <= 5500,
      `a retry should be cut to what the invocation has left (got ${shortenedTimeout})`
    );

    // A window with nothing usable left skips the retry and reports the failure
    // the caller can still be told about.
    capturedPosts.length = 0;
    failPrimaryAttempt = true;
    process.env['FUNCTION_BUDGET_MS'] = '5000';
    const exhaustedClient = new XaiTextClient();
    const exhausted = await captureConsoleWarn(async () => {
      await assert.rejects(
        () => exhaustedClient.generateText(buildRequest(undefined, true)),
        /xAI service temporarily unavailable/,
        'an exhausted invocation window should answer with the provider failure rather than starting a doomed retry'
      );
    });
    assert.equal(capturedPosts.length, 1, 'an exhausted invocation window should not make a second provider call');
    assert(
      JSON.stringify(exhausted.calls).includes('no room left'),
      'skipping the retry for want of budget should say so'
    );
  } finally {
    (axios as unknown as { post: typeof axios.post }).post = originalPost;

    for (const [name, value] of [
      ['XAI_API_KEY', originalApiKey],
      ['XAI_RESPONSES_API_URL', originalApiUrl],
      ['XAI_STORY_MODEL', originalStoryModel],
      ['XAI_FAST_MODEL', originalFastModel],
      ['STORY_LAB_FUNCTION_BUDGET_MS', originalFunctionBudget],
      ['FUNCTION_BUDGET_MS', originalFallbackFunctionBudget]
    ] as const) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

/**
 * The shipped defaults have to leave room for the retry they allow.
 *
 * The runtime clamp above makes an overrun impossible whatever the numbers say,
 * but it can only shorten a retry or refuse one — so a primary timeout raised
 * past what the window can hold would quietly turn the fallback off rather than
 * fail anywhere visible. Issue #167 asks for exactly this guard: that the two
 * defaults cannot drift beyond the configured max duration unnoticed. Stated as
 * the property rather than as the arithmetic, so it holds if any of the three
 * numbers moves.
 */
function assertShippedTimeoutDefaultsLeaveRoomForTheRetry(): void {
  const originalEnv = [
    'XAI_STORY_PRIMARY_TIMEOUT_MS',
    'XAI_PRIMARY_TIMEOUT_MS',
    'XAI_STORY_FAST_TIMEOUT_MS',
    'XAI_FAST_TIMEOUT_MS',
    'STORY_LAB_FUNCTION_BUDGET_MS',
    'FUNCTION_BUDGET_MS'
  ].map(name => [name, process.env[name]] as const);

  try {
    for (const [name] of originalEnv) {
      delete process.env[name];
    }

    const usableWindowMs = getFunctionBudgetMs() - FUNCTION_BUDGET_RESERVE_MS;

    assert(
      getXaiPrimaryTimeoutMs() + MIN_XAI_FALLBACK_TIMEOUT_MS <= usableWindowMs,
      `the default primary timeout (${getXaiPrimaryTimeoutMs()}ms) should leave room for a usable retry inside the ${usableWindowMs}ms window`
    );
    assert(
      getXaiFastTimeoutMs() <= usableWindowMs,
      `the default fast timeout (${getXaiFastTimeoutMs()}ms) should fit inside the ${usableWindowMs}ms window on its own, since a fast-preference request spends it as its only attempt`
    );
  } finally {
    for (const [name, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

async function main(): Promise<void> {
  await assertContinuityFastTimeoutUsesConfiguredBudget();
  await assertContinuityHeuristicWarningPriority();
  await assertContinuityMissingApiKeySkipLeavesStateUnchanged();
  await assertContinuityProviderErrorLeavesStateUnchanged();
  assertReasoningConfig();
  await assertXaiClientPayloads();
  assertAiMetadataMerge();
  await assertStoryLabContinuityBudgetUsesRemainingRequestWindow();
  await assertFastProfileRetryFitsInsideTheInvocationBudget();
  assertShippedTimeoutDefaultsLeaveRoomForTheRetry();

  console.log('xAI fast path review regression tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
