#!/usr/bin/env tsx
// Created: 2026-06-21 20:57 UTC

import genesisHandler, { createStoryLabGenesisHandler } from '../api/story-lab/stories';
import continuationHandler, { createStoryLabContinuationHandler } from '../api/story-lab/stories/[storyId]/continue';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { withMemoryRateLimitStore } from './helpers/withMemoryRateLimitStore';
import { getStoryLabResponseStatus } from '../api/_lib/story-lab/routeStatus';
import type { AuthPort, AuthUser } from '../api/_lib/story-lab/auth/authPort';
import { AuthError } from '../api/_lib/story-lab/auth/authPort';
import type { StoryLabUserProfile } from '../api/_lib/story-lab/contracts';
import type { StoryLabProfileStore } from '../api/_lib/story-lab/profile/storyLabProfileStore';
import { createDefaultStoryLabUserProfile } from '../api/_lib/story-lab/profile/storyLabProfileStore';

interface FakeRequest {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
  /**
   * Where the story id in `/api/story-lab/stories/:storyId/continue` arrives:
   * Vercel puts a `[storyId]` segment here, and the Express route table bridges
   * `req.params` into the same place.
   */
  query?: Record<string, string | string[] | undefined>;
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

function createRequest(
  method: string,
  body?: unknown,
  query?: Record<string, string | string[] | undefined>
): FakeRequest {
  // This file drives the same route handlers many times over to exercise
  // unrelated status-mapping behaviour, sharing the process-wide rate limit
  // store with every other call. Reset it per request rather than let an
  // earlier scenario's budget carry over and fail a later one with 429.
  resetRateLimitsForTests();

  return {
    method,
    body,
    headers: {},
    ...(query ? { query } : {})
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

const owner: AuthUser = {
  userId: 'user_route_owner',
  email: 'owner@example.com'
};

function createStaticAuthPort(user: AuthUser): AuthPort {
  return {
    async getCurrentUser() {
      return user;
    },
    async requireUser() {
      return user;
    }
  };
}

function createRejectingAuthPort(): AuthPort {
  return {
    async getCurrentUser() {
      return null;
    },
    async requireUser() {
      throw new AuthError('Account authentication is required.');
    }
  };
}

function createStubProfileStore(profile: StoryLabUserProfile | null): StoryLabProfileStore {
  return {
    mode: 'non_durable_memory',
    durable: false,
    isConfigured: () => true,
    async saveProfile(user, savedProfile) {
      return {
        success: true,
        data: {
          userId: user.userId,
          profile: savedProfile,
          createdAt: savedProfile.createdAt,
          updatedAt: savedProfile.updatedAt,
          storageMode: 'non_durable_memory'
        }
      };
    },
    async loadProfile(user) {
      return {
        success: true,
        data: profile
          ? {
              userId: user.userId,
              profile,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
              storageMode: 'non_durable_memory'
            }
          : null
      };
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

  // The Story Lab engine forwards the classic `StoryService`'s error code
  // verbatim, and that service is what generates the story behind both of these
  // routes. Its vocabulary was mapped by neither the Story Lab table nor
  // anything else on the way out, so every one of these was served as 500 —
  // "the service broke" — over a refusal the caller could act on, a rate limit
  // that should be backed off, and an outage a probe should read as one.
  const forwardedClassicStatuses: Array<[string, number]> = [
    ['INVALID_INPUT', 400],
    ['CONTENT_TOO_LARGE', 400],
    ['MAX_CHAPTERS_REACHED', 400],
    ['UNAUTHORIZED', 401],
    ['RATE_LIMITED', 429],
    ['QUOTA_EXCEEDED', 429],
    ['AI_SERVICE_UNAVAILABLE', 503]
  ];
  for (const [code, expectedStatus] of forwardedClassicStatuses) {
    const status = getStoryLabResponseStatus({ success: false, error: { code, message: 'x' } } as never);
    assert(
      status === expectedStatus,
      `${code} should map to ${expectedStatus} on a Story Lab route, got ${status}`
    );
  }

  // The three codes the Story Lab engine raises for itself keep the statuses
  // they had, now read from the shared table rather than a second one.
  for (const [code, expectedStatus] of [
    ['CONTENT_POLICY_VIOLATION', 400],
    ['INVALID_BLUEPRINT', 400],
    ['INVALID_REQUEST', 400],
    ['AI_UNAVAILABLE', 503],
    ['GENERATION_FAILED', 500],
    ['CONTINUATION_FAILED', 500]
  ] as Array<[string, number]>) {
    const status = getStoryLabResponseStatus({ success: false, error: { code, message: 'x' } } as never);
    assert(
      status === expectedStatus,
      `${code} should map to ${expectedStatus} on a Story Lab route, got ${status}`
    );
  }

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

  // Both routes now report an unexpected throw through the shared `logError`
  // helper the other paid routes already use (`api/story/generate.ts`'s catch
  // block, before it was deleted, was the pattern this mirrors) rather than the
  // route-local `console.error('Story Lab route failed unexpectedly', …)` this
  // file used to drive here. That trades a single opaque console line for the
  // structured, multi-line entry `logError` writes — timestamp/level line,
  // context, and error detail — stamped with the request's own correlation id,
  // which is the property worth proving now: the response the caller sees stays
  // generic, and the detailed failure is findable by the id the caller was
  // handed back.
  await withEnv({ NODE_ENV: undefined, VERCEL_ENV: undefined, XAI_API_KEY: 'test-key', STORY_LAB_FORCE_MOCK: undefined }, async () => {
    const response = new FakeResponse();
    const handler = createStoryLabGenesisHandler(async () => {
      throw new Error('secret genesis payload');
    });

    const errorLogs = await captureConsoleError(async () => {
      await handler(createRequest('POST', createBlueprint()), response);
    });

    assert(response.statusCode === 500, `unexpected genesis throw should return 500, got ${response.statusCode}`);
    const body = response.body as { success?: boolean; error?: { message?: string } };
    assert(body.success === false, 'unexpected genesis throw should return an error payload');
    assert(
      body.error?.message === 'Story Lab request failed unexpectedly.',
      `the response the caller sees should stay generic, got ${JSON.stringify(body.error)}`
    );

    const requestId = response.headers['X-Request-ID'];
    assert(typeof requestId === 'string' && requestId.length > 0, 'the response should carry the correlation id even on a 500');

    assert(errorLogs.length > 0, 'unexpected genesis throw should emit at least one console error log');
    const combined = JSON.stringify(errorLogs);
    assert(combined.includes(requestId), 'genesis error log should be findable by the request\'s own correlation id');
    assert(combined.includes('/api/story-lab/stories'), 'genesis error log should include the endpoint');
    assert(combined.includes('Error'), 'genesis error log should include error type');
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
    const body = response.body as { success?: boolean; error?: { message?: string } };
    assert(body.success === false, 'unexpected continuation throw should return an error payload');
    assert(
      body.error?.message === 'Story Lab request failed unexpectedly.',
      `the response the caller sees should stay generic, got ${JSON.stringify(body.error)}`
    );

    const requestId = response.headers['X-Request-ID'];
    assert(typeof requestId === 'string' && requestId.length > 0, 'the response should carry the correlation id even on a 500');

    assert(errorLogs.length > 0, 'unexpected continuation throw should emit at least one console error log');
    const combined = JSON.stringify(errorLogs);
    assert(combined.includes(requestId), 'continuation error log should be findable by the request\'s own correlation id');
    assert(combined.includes('/api/story-lab/stories/continue'), 'continuation error log should include the endpoint');
    assert(combined.includes('Error'), 'continuation error log should include error type');
  });

  // `storyId` was read as `input.storyId?.trim()`, which throws for every
  // non-string a caller can put in a JSON body. Nothing in the route catches
  // it, so the request that the field check exists to answer with 400 became
  // an unhandled rejection instead.
  for (const storyId of [123, true, {}, ['story-route-status'], null]) {
    const response = new FakeResponse();
    await continuationHandler(
      createRequest('POST', { ...createContinuationBody(), storyId }),
      response
    );

    assert(
      response.statusCode === 400,
      `storyId=${JSON.stringify(storyId)} should be answered with 400, got ${response.statusCode}`
    );
    assert(
      (response.body as { error?: { code?: string } })?.error?.code === 'INVALID_REQUEST',
      `storyId=${JSON.stringify(storyId)} is a caller error, not a service failure`
    );
  }

  // The blueprint parser collects every invalid field rather than returning at
  // the first one, and `INVALID_BLUEPRINT` is declared as carrying that list.
  // This route sent the joined prose alone, so a caller that wanted to mark the
  // fields a reader has to fix had to parse the message back apart.
  {
    const response = new FakeResponse();
    const { creature, ...blueprintWithoutCreature } = createBlueprint();
    await genesisHandler(
      createRequest('POST', { ...blueprintWithoutCreature, spicyLevel: 9 }),
      response
    );

    const payload = response.body as {
      error?: { code?: string; details?: { invalidFields?: string[] } };
    };

    assert(response.statusCode === 400, `an invalid blueprint should return 400, got ${response.statusCode}`);
    assert(
      payload.error?.code === 'INVALID_BLUEPRINT',
      `an invalid blueprint should be reported as INVALID_BLUEPRINT, got ${JSON.stringify(payload.error)}`
    );
    assert(
      Array.isArray(payload.error?.details?.invalidFields)
        && payload.error.details.invalidFields.includes('creature')
        && payload.error.details.invalidFields.includes('spicyLevel'),
      `every invalid field should be named, got ${JSON.stringify(payload.error?.details)}`
    );
  }

  // ==================== the story id in the URL ====================
  //
  // This route is `/api/story-lab/stories/:storyId/continue` on both
  // deployments, and read the segment on neither: `storyId` came only from the
  // body. A caller that named the story in the path and not again in the body
  // was told `storyId` is required, and a body id that disagreed with the path
  // silently won — so `POST /stories/A/continue` with `{"storyId": "B"}`
  // continued story B while every log line and proxy rule saw a request
  // against A.
  {
    const continuationBody = createContinuationBody();
    const pathStoryId = continuationBody.storyId;

    function createRecordingHandler(): {
      handler: ReturnType<typeof createStoryLabContinuationHandler>;
      seen: { storyId?: string };
    } {
      const seen: { storyId?: string } = {};
      const handler = createStoryLabContinuationHandler(async input => {
        seen.storyId = input.storyId;
        return { success: true, data: { continued: true } as never };
      });

      return { handler, seen };
    }

    // The path names the story and the body does not repeat it.
    {
      const { handler, seen } = createRecordingHandler();
      const response = new FakeResponse();
      const { storyId: _omitted, ...bodyWithoutStoryId } = continuationBody;
      await handler(createRequest('POST', bodyWithoutStoryId, { storyId: pathStoryId }), response);

      assert(
        response.statusCode === 200,
        `a story id in the path should be enough, got ${response.statusCode} ${JSON.stringify(response.body)}`
      );
      assert(
        seen.storyId === pathStoryId,
        `the continuation should run against the story the path names, got ${seen.storyId}`
      );
    }

    // Both name the same story, which is what the Angular app sends.
    {
      const { handler, seen } = createRecordingHandler();
      const response = new FakeResponse();
      await handler(createRequest('POST', continuationBody, { storyId: pathStoryId }), response);

      assert(response.statusCode === 200, `agreeing ids should be served, got ${response.statusCode}`);
      assert(seen.storyId === pathStoryId, `the agreed id should be used, got ${seen.storyId}`);
    }

    // They disagree. Either one could be the mistake, so neither is guessed at.
    {
      const { handler, seen } = createRecordingHandler();
      const response = new FakeResponse();
      await handler(
        createRequest('POST', { ...continuationBody, storyId: 'story-someone-elses' }, { storyId: pathStoryId }),
        response
      );

      assert(
        response.statusCode === 400,
        `a body id that contradicts the path should be refused, got ${response.statusCode}`
      );
      assert(
        (response.body as { error?: { code?: string } })?.error?.code === 'INVALID_REQUEST',
        'contradicting story ids are a caller error'
      );
      assert(seen.storyId === undefined, 'a refused request should not reach the engine');
    }

    // A body id that is not a string is still a claim about which story this
    // is, and one the route cannot read — not something to fall back from
    // because the path happens to carry an id.
    {
      const { handler, seen } = createRecordingHandler();
      const response = new FakeResponse();
      await handler(
        createRequest('POST', { ...continuationBody, storyId: 123 }, { storyId: pathStoryId }),
        response
      );

      assert(
        response.statusCode === 400,
        `a non-string body storyId should be refused even when the path carries one, got ${response.statusCode}`
      );
      assert(seen.storyId === undefined, 'a refused request should not reach the engine');
    }

    // No path segment at all — a direct call to the serverless handler — still
    // reads the body, which is how every existing caller works.
    {
      const { handler, seen } = createRecordingHandler();
      const response = new FakeResponse();
      await handler(createRequest('POST', continuationBody), response);

      assert(response.statusCode === 200, `a body-only request should still be served, got ${response.statusCode}`);
      assert(seen.storyId === pathStoryId, `the body id should still be used, got ${seen.storyId}`);
    }
  }

  // ==================== content boundaries ====================
  //
  // The Story Lab job route already folds a signed-in reader's stored
  // `contentBoundaries` preference into generation; these two direct routes —
  // the ones the Proving Grounds UI actually calls — never did. Same fixture
  // shape and same assertions as the job route's own tests
  // (`tests/story-lab-job-routes.test.ts`), proving the shared
  // `contentBoundaries` module reaches both seams identically.
  {
    let capturedNoGoContent: string | undefined;
    const handler = createStoryLabGenesisHandler({
      authPort: createStaticAuthPort(owner),
      profileStore: createStubProfileStore(
        createDefaultStoryLabUserProfile(owner, { preferences: { contentBoundaries: 'No humiliation.' } })
      ),
      generateGenesis: async input => {
        capturedNoGoContent = input.heatContract.noGoContent;
        return { success: true, data: { story: {} } as never };
      }
    });

    const response = new FakeResponse();
    await handler(createRequest('POST', createBlueprint()), response);

    assert(response.statusCode === 200, `genesis with a profile should still succeed, got ${response.statusCode}`);
    assert(
      capturedNoGoContent === 'No humiliation.',
      `profile content boundaries should reach the engine when the request's own noGoContent is empty, got ${JSON.stringify(capturedNoGoContent)}`
    );
  }

  {
    let capturedNoGoContent: string | undefined;
    const handler = createStoryLabGenesisHandler({
      authPort: createRejectingAuthPort(),
      profileStore: createStubProfileStore(
        createDefaultStoryLabUserProfile(owner, { preferences: { contentBoundaries: 'Should never be read.' } })
      ),
      generateGenesis: async input => {
        capturedNoGoContent = input.heatContract.noGoContent;
        return { success: true, data: { story: {} } as never };
      }
    });

    const response = new FakeResponse();
    await handler(createRequest('POST', createBlueprint()), response);

    assert(response.statusCode === 200, `genesis with no authenticated user should still succeed, got ${response.statusCode}`);
    assert(
      capturedNoGoContent === '',
      `with no authenticated caller, the request heat contract should reach the engine unchanged, got ${JSON.stringify(capturedNoGoContent)}`
    );
  }

  {
    let capturedNoGoContent: string | undefined;
    const handler = createStoryLabContinuationHandler({
      authPort: createStaticAuthPort(owner),
      profileStore: createStubProfileStore(
        createDefaultStoryLabUserProfile(owner, { preferences: { contentBoundaries: 'Keep the danger emotional.' } })
      ),
      continueStory: async input => {
        capturedNoGoContent = input.heatContract?.noGoContent;
        return { success: true, data: { continued: true } as never };
      }
    });

    const response = new FakeResponse();
    await handler(createRequest('POST', {
      ...createContinuationBody(),
      heatContract: {
        adultOnlyConfirmed: true,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door',
        noGoContent: 'No permanent injury.'
      }
    }), response);

    assert(response.statusCode === 200, `continuation with a profile should still succeed, got ${response.statusCode}`);
    assert(
      capturedNoGoContent === 'No permanent injury.\nKeep the danger emotional.',
      `profile content boundaries should be appended to the continuation's own noGoContent, got ${JSON.stringify(capturedNoGoContent)}`
    );
  }

  // A continuation with no Heat Contract on the request must stay that way
  // even when a profile has boundaries to offer: `heatContractPolicyError`
  // treats any *present* contract as needing `adultOnlyConfirmed: true`, so
  // manufacturing one here (to carry nothing but the boundary text) would
  // reject a continuation that used to succeed.
  {
    let capturedHeatContract: unknown;
    let sawHeatContractField = false;
    const handler = createStoryLabContinuationHandler({
      authPort: createStaticAuthPort(owner),
      profileStore: createStubProfileStore(
        createDefaultStoryLabUserProfile(owner, { preferences: { contentBoundaries: 'Keep the danger emotional.' } })
      ),
      continueStory: async input => {
        sawHeatContractField = true;
        capturedHeatContract = input.heatContract;
        return { success: true, data: { continued: true } as never };
      }
    });

    const response = new FakeResponse();
    await handler(createRequest('POST', createContinuationBody()), response);

    assert(response.statusCode === 200, `continuation with no request heat contract should still succeed, got ${response.statusCode}`);
    assert(sawHeatContractField, 'the engine should have been called');
    assert(
      capturedHeatContract === undefined,
      `with no request heat contract, none should be manufactured just to carry a profile boundary, got ${JSON.stringify(capturedHeatContract)}`
    );
  }

  console.log('Story Lab route status tests passed');
}

withMemoryRateLimitStore(main).catch(error => {
  console.error(error);
  process.exit(1);
});
