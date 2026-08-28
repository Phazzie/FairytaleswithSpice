#!/usr/bin/env tsx
// Created: 2026-08-28 UTC

/**
 * The chapter-generation loops never checked the invocation's own function
 * budget before starting another chapter.
 *
 * `xaiConfig.ts` built `getRemainingRequestBudgetMs` against the 60-second
 * ceiling Vercel kills a function at, and it was wired into exactly two
 * places: `XaiTextClient`'s fast-profile retry and continuity extraction. The
 * chapter loops in `generateChaptersForStory` (genesis) and `continueChapter`
 * called the AI for up to three chapters with a fixed `EXTRA_BATCH_CHAPTER_TIMEOUT_MS`
 * on every chapter after the first, whatever the invocation had already spent.
 * If the first chapter needed its own fallback retry — realistic for a live
 * provider — it alone could burn most of the 60-second window, and the loop
 * started the next chapter anyway with a fresh timeout the platform would
 * never let finish. That is not a catchable failure: a platform-level
 * termination kills the process mid-await, so the job-completion path never
 * runs and a durable job is left at `status: 'running'` forever.
 *
 * These tests drive a fake clock through `Date.now` so the "chapter 1 spent
 * most of the budget" scenario does not require an actual 55-second wait, and
 * assert that the loop now stops itself before a doomed chapter rather than
 * attempting one.
 */

import assert from 'node:assert/strict';
import { StoryService } from '../api/_lib/services/storyService';
import { XaiTextClient, type XaiTextRequest, type XaiTextResponse } from '../api/_lib/services/xaiTextClient';
import { continueStoryLab, generateStoryLabGenesis } from '../api/_lib/story-lab/storyLabEngine';
import type { StoryGenerationSeam as LabGenerationSeam } from '../api/_lib/story-lab/contracts';

function withFakeClock<T>(fn: (advance: (ms: number) => void) => Promise<T>): Promise<T> {
  const originalDateNow = Date.now;
  let fakeNow = 1_700_000_000_000;
  Date.now = () => fakeNow;

  const advance = (ms: number) => {
    fakeNow += ms;
  };

  return fn(advance).finally(() => {
    Date.now = originalDateNow;
  });
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const originals = Object.fromEntries(Object.keys(overrides).map(name => [name, process.env[name]]));

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  return fn().finally(() => {
    for (const [name, value] of Object.entries(originals)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });
}

function storyInput(requestedChapterCount: 1 | 2 | 3) {
  return {
    creature: 'vampire' as const,
    themes: ['forbidden_love'],
    userInput: '',
    spicyLevel: 3 as const,
    wordCount: 700 as const,
    requestedChapterCount
  };
}

function continuationInput(requestedChapterCount: 1 | 2 | 3) {
  return {
    storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
    currentChapterCount: 1,
    existingContent: '<p>She opened the door.</p>',
    maintainTone: true,
    requestedChapterCount
  };
}

async function assertGenesisSkipsChaptersItCannotFinish(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;
  const capturedTimeouts: number[] = [];

  await withEnv({
    XAI_API_KEY: 'test-xai-key',
    STORY_LAB_FUNCTION_BUDGET_MS: undefined,
    FUNCTION_BUDGET_MS: undefined
  }, () =>
    withFakeClock(async advance => {
      let calls = 0;
      XaiTextClient.prototype.generateText = async function (request: XaiTextRequest): Promise<XaiTextResponse> {
        calls += 1;
        capturedTimeouts.push(request.timeoutMs);
        if (calls === 1) {
          // Chapter 1 needing its fallback retry is what actually burns the
          // budget in production; advancing the fake clock stands in for that
          // without a real 56-second wait.
          advance(56000);
        }
        return { text: `Chapter ${calls}\n\nSomething happened.`, model: 'grok-4.3', latencyMs: 0 };
      };

      try {
        const result = await new StoryService().generateStory(storyInput(3));

        assert.equal(result.success, true, 'a batch with one working chapter should still succeed overall');
        assert.equal(calls, 1, 'only the first chapter should have been attempted once its budget was gone');
        assert.equal(result.data?.chapters?.length, 1, 'only the first chapter should be in the result');
        assert.equal(
          result.metadata.partialFailures?.length,
          2,
          `chapters 2 and 3 should be recorded as skipped (got ${JSON.stringify(result.metadata.partialFailures)})`
        );
        assert.deepEqual(
          result.metadata.partialFailures?.map(failure => failure.chapterNumber),
          [2, 3],
          'the skipped failures should name exactly the chapters that were never attempted'
        );
        assert(
          result.metadata.partialFailures?.every(failure => failure.message.toLowerCase().includes('skipped')),
          'a chapter stopped for want of budget should say so, not report a generic failure'
        );
      } finally {
        XaiTextClient.prototype.generateText = originalGenerateText;
      }
    })
  );
}

async function assertContinuationSkipsChaptersItCannotFinish(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;

  await withEnv({
    XAI_API_KEY: 'test-xai-key',
    STORY_LAB_FUNCTION_BUDGET_MS: undefined,
    FUNCTION_BUDGET_MS: undefined
  }, () =>
    withFakeClock(async advance => {
      let calls = 0;
      XaiTextClient.prototype.generateText = async function (): Promise<XaiTextResponse> {
        calls += 1;
        if (calls === 1) {
          advance(56000);
        }
        return { text: `Continuation ${calls}\n\nSomething else happened.`, model: 'grok-4.3', latencyMs: 0 };
      };

      try {
        const result = await new StoryService().continueChapter(continuationInput(3));

        assert.equal(result.success, true, 'a continuation batch with one working chapter should still succeed overall');
        assert.equal(calls, 1, 'only the first continuation chapter should have been attempted');
        assert.equal(result.data?.chapters?.length, 1, 'only the first continuation chapter should be in the result');
        assert.deepEqual(
          result.metadata.partialFailures?.map(failure => failure.chapterNumber),
          [3, 4],
          `the skipped continuation chapters keep numbering from where the batch left off (got ${JSON.stringify(result.metadata.partialFailures)})`
        );
      } finally {
        XaiTextClient.prototype.generateText = originalGenerateText;
      }
    })
  );
}

/**
 * A chapter that still has room to run should have that room reflected in its
 * own timeout rather than always spending the static
 * `EXTRA_BATCH_CHAPTER_TIMEOUT_MS` ceiling, so a chapter given, say, 7 seconds
 * of remaining budget is not handed a 9-second timeout the platform will cut
 * off from underneath it.
 */
async function assertBatchChapterTimeoutIsCappedByRemainingBudget(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;
  const capturedTimeouts: number[] = [];

  await withEnv({
    XAI_API_KEY: 'test-xai-key',
    STORY_LAB_FUNCTION_BUDGET_MS: undefined,
    FUNCTION_BUDGET_MS: undefined,
    XAI_STORY_FAST_TIMEOUT_MS: undefined,
    XAI_FAST_TIMEOUT_MS: undefined
  }, () =>
    withFakeClock(async advance => {
      let calls = 0;
      XaiTextClient.prototype.generateText = async function (request: XaiTextRequest): Promise<XaiTextResponse> {
        calls += 1;
        capturedTimeouts.push(request.timeoutMs);
        if (calls === 1) {
          // Leaves 60000 - 48000 - 5000 (reserve) = 7000ms of budget, less
          // than the static 9000ms ceiling but well above the floor needed to
          // attempt another chapter at all.
          advance(48000);
        }
        return { text: `Chapter ${calls}\n\nSomething happened.`, model: 'grok-4.3', latencyMs: 0 };
      };

      try {
        const result = await new StoryService().generateStory(storyInput(2));

        assert.equal(result.success, true, 'both chapters should still fit inside the remaining budget');
        assert.equal(calls, 2, 'the second chapter should still be attempted with a shortened timeout');
        assert(
          capturedTimeouts[1] > 0 && capturedTimeouts[1] <= 7000,
          `the second chapter's timeout should be capped to the ~7000ms remaining budget (got ${capturedTimeouts[1]})`
        );
      } finally {
        XaiTextClient.prototype.generateText = originalGenerateText;
      }
    })
  );
}

/**
 * The batch-chapter guard above only ever ran for chapters after the first —
 * the first chapter's own primary call was handed `getXaiPrimaryTimeoutMs()`
 * unconditionally, with no check that the invocation actually had that much
 * window left. A deployment configuring a smaller function budget (or any
 * meaningful delay before this call, such as validation or trope selection)
 * left that first call exposed to the exact platform SIGKILL this whole fix
 * exists to prevent. Below the floor needed to attempt any call at all, the
 * request should refuse cleanly rather than ever reaching the provider with a
 * timeout of `0` — which axios reads as "no timeout" rather than "expired".
 */
async function assertFirstChapterRefusesWhenBudgetIsAlreadyExhausted(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;
  let calls = 0;

  await withEnv({
    XAI_API_KEY: 'test-xai-key',
    // Leaves max(0, 4000 - 0 - 5000) = 0ms of budget: below the floor needed
    // to attempt even the first chapter.
    STORY_LAB_FUNCTION_BUDGET_MS: '4000',
    FUNCTION_BUDGET_MS: undefined
  }, async () => {
    XaiTextClient.prototype.generateText = async function (): Promise<XaiTextResponse> {
      calls += 1;
      return { text: 'should never be reached', model: 'grok-4.3', latencyMs: 0 };
    };

    try {
      const result = await new StoryService().generateStory(storyInput(1));

      assert.equal(calls, 0, 'the provider should never be called once the request budget is already gone');
      assert.equal(result.success, false, 'a request with no safe window left should fail cleanly');
      assert.equal(result.data, undefined, 'a refused request should carry no story data');
    } finally {
      XaiTextClient.prototype.generateText = originalGenerateText;
    }
  });
}

/**
 * Between the floor and the full default, the first chapter's timeout should
 * track the actual remaining budget rather than always spending the static
 * 40-second default the invocation cannot necessarily afford.
 */
async function assertFirstChapterTimeoutIsCappedByTightBudget(): Promise<void> {
  const originalGenerateText = XaiTextClient.prototype.generateText;
  const capturedTimeouts: number[] = [];

  await withEnv({
    XAI_API_KEY: 'test-xai-key',
    // Leaves max(0, 20000 - 0 - 5000) = 15000ms: above the floor, but well
    // below the 40000ms default primary timeout.
    STORY_LAB_FUNCTION_BUDGET_MS: '20000',
    FUNCTION_BUDGET_MS: undefined
  }, async () => {
    XaiTextClient.prototype.generateText = async function (request: XaiTextRequest): Promise<XaiTextResponse> {
      capturedTimeouts.push(request.timeoutMs);
      return { text: 'Chapter 1\n\nSomething happened.', model: 'grok-4.3', latencyMs: 0 };
    };

    try {
      const result = await new StoryService().generateStory(storyInput(1));

      assert.equal(result.success, true, 'a tight but sufficient budget should still let the first chapter run');
      assert.equal(capturedTimeouts.length, 1, 'the first chapter should be attempted exactly once');
      assert(
        capturedTimeouts[0] > 5000 && capturedTimeouts[0] <= 15000,
        `the first chapter's timeout should be capped to the ~15000ms remaining budget rather than the 40000ms default (got ${capturedTimeouts[0]})`
      );
    } finally {
      XaiTextClient.prototype.generateText = originalGenerateText;
    }
  });
}

const storyLabBlueprint: LabGenerationSeam['input'] = {
  creature: 'siren',
  themes: [
    { id: 'forbidden_love', label: 'Forbidden Love', description: 'A relationship that breaks supernatural law.' }
  ],
  logline: 'A siren diplomat must betray her court to save a forbidden lover.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 700,
  chapterBatchSize: 1,
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'dangerous_proximity',
    intimacyBoundary: 'fade_to_black',
    noGoContent: 'No coercion and no humiliation.'
  },
  protagonistName: 'Mira',
  antagonistName: 'Lord Brine',
  worldDetails: 'A moonlit reef court ruled by vow-binding songs.',
  narrativeDirectives: 'Keep the prose lush but tense.'
};

/**
 * `generateStoryLabGenesis`/`continueStoryLab` capture their own
 * `requestStartedAtMs` before ever reaching `StoryService`, and it is that
 * timestamp — not one `StoryService` resets on its own — that has to drive the
 * budget check above, or a Story Lab job route's own pre-call overhead (job
 * creation, an owner lookup, content-boundary loading; see
 * `jobRouteHandlers.ts`) would be invisible to it. This proves the engine
 * actually passes its timestamp through rather than `StoryService` silently
 * keeping its own.
 */
async function assertEngineThreadsItsOwnStartTimeIntoStoryService(): Promise<void> {
  await withEnv({ XAI_API_KEY: 'test-xai-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const beforeCall = Date.now();
    let capturedGenesisStart: number | undefined;
    let capturedContinuationStart: number | undefined;

    const genesisResponse = await generateStoryLabGenesis(storyLabBlueprint, {
      serviceFactory: () => ({
        generateStory: async (_input: unknown, requestStartedAtMs?: number) => {
          capturedGenesisStart = requestStartedAtMs;
          return {
            success: false,
            error: { code: 'GENERATION_FAILED', message: 'stubbed for this test' }
          } as const;
        },
        continueChapter: async () => {
          throw new Error('continueChapter should not be called by the genesis path');
        }
      })
    });
    const afterCall = Date.now();

    assert.equal(genesisResponse.success, false, 'the stub deliberately fails so the test only checks what it was called with');
    assert.equal(typeof capturedGenesisStart, 'number', 'generateStoryLabGenesis should pass its own requestStartedAtMs to StoryService.generateStory');
    assert(
      capturedGenesisStart! >= beforeCall && capturedGenesisStart! <= afterCall,
      `the timestamp passed through should be the engine's own call-time clock, not left undefined (got ${capturedGenesisStart})`
    );

    const continuationResponse = await continueStoryLab({
      storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
      chapterBatchSize: 1,
      continuationBrief: 'Keep going.',
      previouslyGeneratedChapters: [{
        chapterNumber: 1,
        htmlContent: '<p>She opened the door.</p>',
        rawContent: '<p>She opened the door.</p>'
      }],
      storyState: {
        storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
        revision: 1,
        characters: [],
        threads: [],
        artifacts: [],
        continuityWarnings: [],
        narrativeVoice: '',
        lastUpdatedAt: new Date().toISOString()
      }
    }, {
      serviceFactory: () => ({
        generateStory: async () => {
          throw new Error('generateStory should not be called by the continuation path');
        },
        continueChapter: async (_input: unknown, requestStartedAtMs?: number) => {
          capturedContinuationStart = requestStartedAtMs;
          return {
            success: false,
            error: { code: 'CONTINUATION_FAILED', message: 'stubbed for this test' }
          } as const;
        }
      })
    });

    assert.equal(continuationResponse.success, false, 'the stub deliberately fails so the test only checks what it was called with');
    assert.equal(typeof capturedContinuationStart, 'number', 'continueStoryLab should pass its own requestStartedAtMs to StoryService.continueChapter');
  });
}

async function main(): Promise<void> {
  await assertGenesisSkipsChaptersItCannotFinish();
  await assertContinuationSkipsChaptersItCannotFinish();
  await assertBatchChapterTimeoutIsCappedByRemainingBudget();
  await assertFirstChapterRefusesWhenBudgetIsAlreadyExhausted();
  await assertFirstChapterTimeoutIsCappedByTightBudget();
  await assertEngineThreadsItsOwnStartTimeIntoStoryService();

  console.log('Story service batch chapter budget tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
