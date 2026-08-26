#!/usr/bin/env tsx
// Created: 2026-08-24 22:15 UTC
//
// HTTP-contract regressions for the routes real traffic goes through:
//
// 1. `/api/story-lab/stories`, `/api/story-lab/stories/:storyId/continue`,
//    `/api/export/save`, and `/api/image/generate` answer a missing or
//    non-object body with a 400 (each route's own client-error code) rather
//    than crashing into their catch block and reporting 500 INTERNAL_ERROR —
//    and each stamps an `X-Request-ID` on the way.
// 2. Caller-supplied text (a prose story id, an unrecognized field name) does
//    not leak into request logs, on either the buffered sink or the console.
// 3. The export size cap is measured in bytes, not UTF-16 code units.
//
// `/api/story/generate` and `/api/story/continue` — the classic, non-Story-Lab
// handlers this file used to drive directly — are gone: nothing ever called
// them (the Angular app talks only to `/api/story-lab/...`), and they have
// been deleted along with their entries in `expressApiRoutes.ts` and the
// Vercel function-count guard. The coverage that mattered moves with the
// infrastructure it was protecting: the malformed-body and request-id checks
// now drive the Story Lab genesis and continuation handlers those routes were
// missing, and the prose-story-id check drives the Story Lab continuation
// route. The one exception is `verifyRejectedStoryInputDoesNotRepeatCallerText`,
// which protects `StoryService.generateStory`'s `validateStoryInput` rejection
// shape — a service-level contract with no equivalent coverage elsewhere in
// this suite — so it now calls the service directly rather than through the
// deleted HTTP handler.

import { FILE_SIZE } from '../api/_lib/constants';
import { logger } from '../api/_lib/utils/logger';
import { resetRateLimitsForTests } from '../api/_lib/middleware/security';
import { StoryService } from '../api/_lib/services/storyService';
import exportHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import storyLabGenesisHandler from '../api/story-lab/stories';
import storyLabContinuationHandler from '../api/story-lab/stories/[storyId]/continue';
import { createSavedStoryProjectFixture } from './story-lab-test-fixtures';

interface FakeRequest {
  method: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers: Record<string, string>;
}

class FakeResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown = null;
  ended = false;
  written = '';
  headersSent = false;

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

  writeHead(code: number, headers?: Record<string, string>): this {
    this.statusCode = code;
    Object.assign(this.headers, headers ?? {});
    this.headersSent = true;
    return this;
  }

  write(chunk: string): boolean {
    this.written += chunk;
    return true;
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

async function expectMissingBodyRejected(
  name: string,
  handler: (req: any, res: any) => Promise<void> | void,
  body: unknown
): Promise<void> {
  const req: FakeRequest = { method: 'POST', headers: {}, body };
  const res = new FakeResponse();

  await handler(req, res);

  assert(
    res.statusCode === 400,
    `${name} should answer a ${describeBody(body)} body with 400, got ${res.statusCode}`
  );

  const payload = res.body as { success?: boolean; error?: { code?: string } };
  assert(payload?.success === false, `${name} should report failure for a ${describeBody(body)} body`);
  assert(
    payload?.error?.code === 'INVALID_INPUT',
    `${name} should report INVALID_INPUT for a ${describeBody(body)} body, got ${payload?.error?.code}`
  );
}

function describeBody(body: unknown): string {
  if (body === undefined) {
    return 'missing';
  }
  if (Array.isArray(body)) {
    return 'array';
  }
  return typeof body;
}

async function verifyMalformedBodiesAreClientErrors(): Promise<void> {
  // `undefined` and `null` are the regression: reading a field off either threw
  // into the handler's catch block, which answers 500 INTERNAL_ERROR.
  const throwingBodies: unknown[] = [undefined, null];
  // A string and an array never threw — JavaScript allows property access on
  // both, and so did `Object.keys` — so these two already answered 400 before
  // the guard existed. They are here to hold that behaviour, not to prove it
  // was broken.
  const alreadyRejectedBodies: unknown[] = ['creature=vampire', []];

  for (const body of [...throwingBodies, ...alreadyRejectedBodies]) {
    await expectMissingBodyRejected('/api/export/save', exportHandler, body);
    await expectMissingBodyRejected('/api/image/generate', imageGenerateHandler, body);
  }
}

/**
 * The Story Lab genesis and continuation routes answer the same family of
 * malformed bodies with a 400 rather than a crash — but through their own
 * parsers, so their own error codes: the blueprint parser refuses everything
 * that is not a plain object with `INVALID_BLUEPRINT`, and the continuation
 * route's body check refuses the same shapes with `INVALID_REQUEST`. Neither
 * is `INVALID_INPUT`, which is why this is a separate check from
 * `expectMissingBodyRejected` above rather than a third call added to its loop.
 *
 * Every one of these also proves the new correlation-id behaviour this change
 * adds: `beginPostRoute` stamps `X-Request-ID` before either route reads its
 * body, so it is present even on the requests that go on to be refused.
 */
async function verifyStoryLabRoutesRejectMalformedBodies(): Promise<void> {
  const bodies: unknown[] = [undefined, null, 'creature=vampire', []];

  const routes = [
    ['/api/story-lab/stories', storyLabGenesisHandler, 'INVALID_BLUEPRINT'],
    ['/api/story-lab/stories/:storyId/continue', storyLabContinuationHandler, 'INVALID_REQUEST']
  ] as const;

  for (const [name, handler, expectedCode] of routes) {
    for (const body of bodies) {
      const req: FakeRequest = { method: 'POST', headers: {}, query: {}, body };
      const res = new FakeResponse();

      await handler(req, res);

      assert(
        res.statusCode === 400,
        `${name} should answer a ${describeBody(body)} body with 400, got ${res.statusCode}`
      );

      const payload = res.body as { success?: boolean; error?: { code?: string } };
      assert(payload?.success === false, `${name} should report failure for a ${describeBody(body)} body`);
      assert(
        payload?.error?.code === expectedCode,
        `${name} should report ${expectedCode} for a ${describeBody(body)} body, got ${payload?.error?.code}`
      );

      const requestId = res.headers['X-Request-ID'];
      assert(
        typeof requestId === 'string' && requestId.length > 0,
        `${name} should stamp a non-empty X-Request-ID even on a ${describeBody(body)} body (got ${JSON.stringify(requestId)})`
      );
    }
  }
}

/**
 * `storyId` is caller text too, and a length cap was not a filter for it: most
 * prose is shorter than any cap worth having, so a sentence sent as an id went
 * into the log whole. The shape check is what rejects it, and this drives the
 * real continuation route to prove the route uses it.
 */
async function verifyContinueDoesNotLogProseStoryIds(): Promise<void> {
  logger.clearLogs();

  // Underscore-separated and carrying a real UUID, so it passes every rule this
  // check went through before the minted form: it is shorter than any cap,
  // every character in it is one an id may contain, and the id-shaped tail is
  // genuine. Only pinning the whole form rejects it. Sent identically as both
  // the route segment and the body field, so the route's own conflict check
  // does not intercept it before the request-received line is written.
  const proseStoryId = 'Dana_at_the_clinic_on_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';
  const proseProject = createSavedStoryProjectFixture({ storyId: proseStoryId });

  const { consoleOutput } = await captureConsole(async () => {
    const res = new FakeResponse();
    await storyLabContinuationHandler({
      method: 'POST',
      headers: {},
      query: { storyId: proseStoryId },
      body: {
        storyId: proseStoryId,
        chapterBatchSize: 1,
        storyState: proseProject.state,
        previouslyGeneratedChapters: proseProject.chapters
      }
    }, res);
    return res;
  });

  const started = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story-lab/stories/continue');

  assert(started, 'the continuation route should log the request it started');
  assert(
    consoleOutput.includes('/api/story-lab/stories/continue'),
    `the console capture should hold the request line (got ${consoleOutput.slice(0, 200)}…)`
  );

  for (const [sink, written] of [
    ['buffer', JSON.stringify(started.context)],
    ['console', consoleOutput]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `prose sent as a story id must not reach the ${sink} (got ${written})`
    );
  }

  assert(
    started.context?.requestParameters?.['storyId'] === '[UNRECOGNIZED]',
    `a story id that is not shaped like one should be reported (got ${JSON.stringify(started.context?.requestParameters)})`
  );

  // The ordinary case still logs the id, which is what makes it worth keeping.
  logger.clearLogs();
  const realStoryId = 'story-9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';
  const realProject = createSavedStoryProjectFixture({ storyId: realStoryId });
  await captureConsole(async () => {
    const res = new FakeResponse();
    await storyLabContinuationHandler({
      method: 'POST',
      headers: {},
      query: { storyId: realStoryId },
      body: {
        storyId: realStoryId,
        chapterBatchSize: 1,
        storyState: realProject.state,
        previouslyGeneratedChapters: realProject.chapters
      }
    }, res);
    return res;
  });

  const realEntry = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story-lab/stories/continue');
  assert(
    realEntry?.context?.requestParameters?.['storyId'] === realStoryId,
    `a real story id should still be logged (got ${JSON.stringify(realEntry?.context?.requestParameters)})`
  );

  logger.clearLogs();
}

/**
 * A JSON object's keys are written by whoever wrote the body, so `receivedFields:
 * Object.keys(input)` was caller text reaching the log through the one door that
 * had not been checked — and it is the malformed requests, the hand-written
 * ones, that take this path.
 *
 * The Story Lab genesis route does not have this bug shape to regress-test:
 * its 400 already reports `invalidFields`, the blueprint parser's own list of
 * known field names, not `Object.keys(body)`. So only `/api/image/generate`
 * remains here; the two classic story routes this test used to cover are gone
 * along with the handlers that carried the bug.
 */
async function verifyRejectedBodiesDoNotLogCallerFieldNames(): Promise<void> {
  const routes = [
    ['/api/image/generate', imageGenerateHandler, 'style']
  ] as const;

  for (const [endpoint, handler, knownField] of routes) {
    logger.clearLogs();

    // A body that fails the route's required-field check, carrying prose as a
    // field name beside a real field the contract does name.
    const { consoleOutput } = await captureConsole(async () => {
      const res = new FakeResponse();
      await handler({
        method: 'POST',
        headers: {},
        body: {
          'Dana is in treatment at the clinic on Rosewood': 1,
          [knownField]: 'ignored'
        }
      }, res);
      assert(res.statusCode === 400, `${endpoint} should refuse the malformed body, got ${res.statusCode}`);
      return res;
    });

    const rejected = logger
      .getRecentLogs(50, 'warn')
      .find(entry => entry.context?.endpoint === endpoint);

    assert(rejected, `${endpoint} should log the request it refused`);

    for (const [sink, written] of [
      ['buffer', JSON.stringify(rejected.metadata)],
      ['console', consoleOutput]
    ] as const) {
      assert(
        !written.includes('Dana') && !written.includes('Rosewood'),
        `prose sent as a field name must not reach the ${sink} of ${endpoint} (got ${written})`
      );
    }

    const receivedFields = rejected.metadata?.['receivedFields'];
    assert(
      Array.isArray(receivedFields) && receivedFields.includes(knownField),
      `${endpoint} should still name the contract fields the caller sent (got ${JSON.stringify(rejected.metadata)})`
    );
    assert(
      rejected.metadata?.['unrecognizedFieldCount'] === 1,
      `${endpoint} should count the fields it did not recognise (got ${JSON.stringify(rejected.metadata)})`
    );
  }

  logger.clearLogs();
}

/**
 * A rejected story request must not repeat what the caller sent.
 *
 * `validateStoryInput` answered every rule with `providedValue: input.<field>`,
 * the raw value. That object is returned to the caller as the response `error`
 * *and* handed to `logWarn`, so it reached the console, the buffer the debug
 * panel reads, and any sink behind the logger — through `providedValue`, a key
 * `redactSensitiveLogData` has no reason to blank.
 *
 * Three fields carry caller text. `creature` and `themes` are closed sets in the
 * contract and caller text at run time, which is the whole reason
 * `toLoggableCreature` and `toLoggableThemes` exist for the request line these
 * rejections sit beside. `userInput` is the reader's prose, and its rule fires
 * *because* the prose is long: the rejection that exists to keep an oversized
 * brief out of the request was the one that copied all of it into the log.
 *
 * This is a `StoryService` contract, not a routing one — `validateStoryInput`
 * runs the same way no matter which route calls `generateStory` — and Story
 * Lab genesis does not call this service at all (it calls
 * `generateStoryLabGenesis`, a different code path with its own parser, already
 * covered end-to-end by `tests/story-lab-blueprint-parser.test.ts`). With the
 * classic `/api/story/generate` route gone, this now drives `StoryService`
 * directly rather than through an HTTP handler.
 */
async function verifyRejectedStoryInputDoesNotRepeatCallerText(): Promise<void> {
  const prose = 'Dana is in treatment at the clinic on Rosewood';
  const validBody = {
    creature: 'vampire',
    themes: ['forbidden_love'],
    spicyLevel: 3,
    wordCount: 900,
    requestedChapterCount: 1
  };

  const cases = [
    {
      name: 'userInput',
      // Past the documented cap, so the length rule is what refuses it.
      body: { ...validBody, userInput: `${prose}. `.repeat(60) },
      expectedProvidedValue: (body: any) => `${body.userInput.length} characters`
    },
    {
      name: 'creature',
      body: { ...validBody, creature: prose },
      expectedProvidedValue: () => '[UNRECOGNIZED]'
    },
    {
      name: 'themes',
      // Six entries: past `VALIDATION_RULES.themes.maxCount`, so the rule fires
      // with an array of caller text in hand.
      body: { ...validBody, themes: Array.from({ length: 6 }, (_item, index) => `${prose} ${index}`) },
      expectedProvidedValue: () => ({ themes: [], unrecognizedThemeCount: 6 })
    }
  ];

  for (const testCase of cases) {
    logger.clearLogs();

    const { response: result, consoleOutput } = await captureConsole(async () => {
      const service = new StoryService();
      return service.generateStory(testCase.body as any);
    });

    assert(result.success === false, `an invalid ${testCase.name} should be refused, got success=${result.success}`);

    const payload = result as { error?: { code?: string; providedValue?: unknown } };
    assert(
      payload.error?.code === 'INVALID_INPUT',
      `an invalid ${testCase.name} should be reported as INVALID_INPUT, got ${JSON.stringify(payload.error)}`
    );

    const rejected = logger
      .getRecentLogs(50, 'warn')
      .find(entry => entry.context?.endpoint === 'generateStory');
    assert(rejected, `the service should log the ${testCase.name} rejection it made`);

    for (const [sink, written] of [
      ['response', JSON.stringify(payload)],
      ['buffer', JSON.stringify(rejected.metadata)],
      ['console', consoleOutput]
    ] as const) {
      assert(
        !written.includes('Dana') && !written.includes('Rosewood'),
        `caller text sent as ${testCase.name} must not reach the ${sink} (got ${written.slice(0, 300)})`
      );
    }

    // The diagnostic survives: a rejection still says which field was wrong and
    // what was wrong with it, which is the reason to report anything at all.
    assert(
      JSON.stringify(payload.error?.providedValue) ===
        JSON.stringify(testCase.expectedProvidedValue(testCase.body)),
      `the ${testCase.name} rejection should still describe what was provided (got ${JSON.stringify(payload.error?.providedValue)})`
    );
  }

  // An array under `userInput` has a `length` of 0, so it passed the length rule
  // and reached the prompt, where it is interpolated as text.
  logger.clearLogs();
  const { response: arrayInputResult } = await captureConsole(async () => {
    const service = new StoryService();
    return service.generateStory({ ...validBody, userInput: [prose] } as any);
  });

  const arrayInputPayload = arrayInputResult as { error?: { code?: string; field?: string } };
  assert(
    arrayInputResult.success === false && arrayInputPayload.error?.field === 'userInput',
    `a non-string userInput should be refused as a caller error, got success=${arrayInputResult.success} ${JSON.stringify(arrayInputPayload.error)}`
  );

  logger.clearLogs();
}

/**
 * The export cap is a size in kilobytes, so it has to be measured in bytes.
 * Read with `String.length` it counted UTF-16 code units, and a story in a
 * non-Latin script is up to three bytes per unit — so a body well past the
 * documented 500KB was accepted, and the `contentLength` a refusal reported was
 * not a byte count either.
 */
async function verifyExportMeasuresItsSizeCapInBytes(): Promise<void> {
  const maxBytes = FILE_SIZE.MAX_CONTENT_LENGTH_KB * FILE_SIZE.BYTES_PER_KB;
  // Three bytes per character in UTF-8, one UTF-16 code unit each: just over
  // the cap in bytes, and comfortably under it when counted as characters.
  const overSizedContent = '雨'.repeat(Math.ceil(maxBytes / 3) + 1);

  assert(
    overSizedContent.length < maxBytes,
    'the fixture has to be under the cap by the old measure for this to prove anything'
  );

  const res = new FakeResponse();
  await exportHandler({
    method: 'POST',
    headers: {},
    body: {
      storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
      title: 'Rain',
      format: 'txt',
      content: overSizedContent
    }
  }, res);

  const body = res.body as { error?: { code?: string; contentLength?: number; maxLength?: number } };

  assert(res.statusCode === 400, `content past the byte cap should be refused, got ${res.statusCode}`);
  assert(
    body.error?.code === 'CONTENT_TOO_LARGE',
    `content past the byte cap should be refused as too large, got ${JSON.stringify(body.error)}`
  );
  assert(
    body.error?.contentLength === Buffer.byteLength(overSizedContent, 'utf8'),
    `the refusal should report the size it measured, got ${JSON.stringify(body.error)}`
  );
  assert(
    body.error?.maxLength === maxBytes,
    `the refusal should report the cap in bytes, got ${JSON.stringify(body.error)}`
  );

  // A story that fits is still exported, which is what keeps the cap worth
  // having rather than merely strict.
  const accepted = new FakeResponse();
  await exportHandler({
    method: 'POST',
    headers: {},
    body: {
      storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
      title: 'Rain',
      format: 'txt',
      content: '<p>雨が降っていた。</p>'
    }
  }, accepted);

  assert(accepted.statusCode === 200, `an ordinary non-ASCII story should still export, got ${accepted.statusCode}`);

  // `content` and `title` are read as text by every export branch. A number is
  // truthy, so the presence check let it through and the renderer threw a
  // `TypeError` that `saveAndExport` reports as EXPORT_FAILED — the caller was
  // told the export had failed rather than that the request was malformed.
  for (const malformed of [
    { field: 'content', body: { content: 12345, title: 'Rain' } },
    { field: 'title', body: { content: '<p>Rain.</p>', title: { text: 'Rain' } } }
  ]) {
    const rejected = new FakeResponse();
    await exportHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
        format: 'txt',
        ...malformed.body
      }
    }, rejected);

    assert(
      rejected.statusCode === 400,
      `a non-string ${malformed.field} is a client error, got ${rejected.statusCode}`
    );
    assert(
      (rejected.body as { error?: { code?: string } }).error?.code === 'INVALID_INPUT',
      `a non-string ${malformed.field} should be named as invalid input, got ${JSON.stringify(rejected.body)}`
    );
  }
}

/**
 * The route measured `content` and left `title` unmeasured, though both are
 * caller text and both are rendered into the same document. The title is the
 * more expensive of the two to leave open: the `.txt` renderer writes it once
 * as a heading and again as the `=` rule under it, the `.epub` renderer writes
 * it into four XML parts, and the finished document comes back as a base64
 * `data:` URI. So a one-byte story with a large title turned a rate-limited
 * paid route into an amplifier.
 */
async function verifyExportBoundsItsTitleAsWellAsItsContent(): Promise<void> {
  const maxBytes = FILE_SIZE.MAX_TITLE_LENGTH_BYTES;
  // Measured in bytes for the same reason the content cap is: three bytes per
  // character in UTF-8, one UTF-16 code unit each, so this is past the cap by
  // the measure that counts and under it by the one that does not.
  const overSizedTitle = '雨'.repeat(Math.ceil(maxBytes / 3) + 1);

  assert(
    overSizedTitle.length < maxBytes,
    'the fixture has to be under the cap by code-unit count for this to prove anything'
  );

  const rejected = new FakeResponse();
  await exportHandler({
    method: 'POST',
    headers: {},
    body: {
      storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
      title: overSizedTitle,
      format: 'txt',
      content: '<p>Rain.</p>'
    }
  }, rejected);

  const body = rejected.body as { error?: { code?: string; field?: string; contentLength?: number; maxLength?: number } };

  assert(rejected.statusCode === 400, `a title past the byte cap should be refused, got ${rejected.statusCode}`);
  assert(
    body.error?.code === 'CONTENT_TOO_LARGE',
    `a title past the byte cap should be refused as too large, got ${JSON.stringify(body.error)}`
  );
  assert(
    body.error?.field === 'title',
    `the refusal should name the field that overran, got ${JSON.stringify(body.error)}`
  );
  assert(
    body.error?.contentLength === Buffer.byteLength(overSizedTitle, 'utf8')
      && body.error?.maxLength === maxBytes,
    `the refusal should report the size it measured and the cap, got ${JSON.stringify(body.error)}`
  );

  // A title at the cap is still exported, so this refuses the abuse rather than
  // the ordinary case: no real story title comes near a kilobyte.
  const accepted = new FakeResponse();
  await exportHandler({
    method: 'POST',
    headers: {},
    body: {
      storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
      title: '雨'.repeat(Math.floor(maxBytes / 3)),
      format: 'txt',
      content: '<p>雨が降っていた。</p>'
    }
  }, accepted);

  assert(accepted.statusCode === 200, `a title at the cap should still export, got ${accepted.statusCode}`);
}

/**
 * Run something with the console captured, so an assertion can read what the
 * logger actually printed rather than only what it buffered.
 */
async function captureConsole<T>(run: () => Promise<T>): Promise<{ response: T; consoleOutput: string }> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  let consoleOutput = '';
  const record = (...args: unknown[]) => {
    consoleOutput += args.map(argument => String(argument)).join(' ');
  };

  console.log = record;
  console.warn = record;
  console.error = record;

  try {
    return { response: await run(), consoleOutput };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

/**
 * `/api/image/generate`'s request line must not repeat what the caller sent —
 * and must still say what an ordinary request asked for.
 *
 * The line reports four caller-supplied fields. Three of them go through this
 * repository's allow-lists; `style` did not. The route's own guard tests the
 * field for truthiness and `ImageService.validateImageInput` holds the closed
 * set, but that runs after the line is written, so `style` was caller text at
 * the moment it was logged and a body carrying prose under that name put the
 * prose in the console and in the buffer the debug panel reads.
 *
 * The other half of the same line was failing in the opposite direction:
 * `themes` was filtered against the eighteen classic `ThemeType`s, and the only
 * client this route has sends Story Lab seed ids. An ordinary request logged
 * `themes: []` with an unrecognized count beside it — the caller-sent-garbage
 * marker, written about the picker's own values. Both readings are asserted
 * here, because a filter that blanks everything satisfies the first on its own.
 */
async function verifyImageRequestLineNeitherRepeatsNorBlanksItsParameters(): Promise<void> {
  const prose = 'Dana is in treatment at the clinic on Rosewood';
  const storyId = 'story_0f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';

  logger.clearLogs();
  const { consoleOutput } = await captureConsole(async () => {
    const res = new FakeResponse();
    await imageGenerateHandler({
      method: 'POST',
      headers: {},
      body: { storyId, content: 'A chapter.', creature: 'vampire', themes: ['court_intrigue'], style: prose }
    }, res);
    return res;
  });

  const proseLine = logger.getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/image/generate');
  assert(proseLine, 'the route should log the request it was called with');

  for (const [sink, written] of [
    ['buffer', JSON.stringify(proseLine)],
    ['console', consoleOutput]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `caller text sent as an image style must not reach the ${sink} (got ${written.slice(0, 300)})`
    );
  }

  logger.clearLogs();
  await captureConsole(async () => {
    const res = new FakeResponse();
    await imageGenerateHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId,
        content: 'A chapter.',
        creature: 'siren',
        // Two seeds straight off the picker `app.ts` builds.
        themes: ['blood_oaths', 'forced_proximity'],
        style: 'fantasy'
      }
    }, res);
    return res;
  });

  const ordinaryLine = logger.getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/image/generate');
  assert(ordinaryLine, 'the route should log an ordinary request too');

  const parameters = (ordinaryLine.context as any)?.requestParameters ?? {};
  assert(
    JSON.stringify(parameters.themes) === JSON.stringify(['blood_oaths', 'forced_proximity'])
      && parameters.unrecognizedThemeCount === undefined,
    `a request the app itself makes should have its themes logged intact (got ${JSON.stringify(parameters)})`
  );
  assert(
    parameters.style === 'fantasy' && parameters.creature === 'siren' && parameters.storyId === storyId,
    `the rest of the line should survive the allow-lists too (got ${JSON.stringify(parameters)})`
  );
}

/**
 * `creature` and `themes` are caller text the route did not type-check.
 *
 * Both are optional and both are rendered when they are sent, and the renderers
 * disagreed about what a non-string one means: `escapeHtml` reduces over the
 * value, so an HTML export of `themes: [123]` threw a `TypeError` into
 * `saveAndExport`'s catch and came back `EXPORT_FAILED` — the service reporting
 * its own failure for the caller's malformed body — while the text export of
 * the same body wrote `123` and answered 200. One body, two answers, neither of
 * them the `INVALID_INPUT` it is.
 *
 * The two fields now go through the same shape check `content` and `title`
 * already had, which is what `ImageService.validateImageInput` does with these
 * same two field names.
 */
async function verifyExportTypeChecksItsOptionalDescriptiveFields(): Promise<void> {
  // This check drives the route more times than its own rate-limit budget
  // allows, and `rateLimitStore` is one process-wide map shared with every
  // other check in this file — so a 429 would arrive here for a reason the
  // check is not about.
  resetRateLimitsForTests();

  const validBody = {
    storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
    title: 'Midnight Bargain',
    content: '<p>Rain.</p>'
  };

  const malformed: Array<[string, Record<string, unknown>]> = [
    ['a numeric theme entry', { themes: [123] }],
    ['an object theme entry', { themes: [{ id: 'forbidden_love' }] }],
    ['a themes value that is not an array', { themes: 'forbidden_love' }],
    ['an empty-string theme entry', { themes: [''] }],
    ['a numeric creature', { creature: 7 }],
    ['an empty-string creature', { creature: '' }]
  ];

  // Both renderers, because the pair used to disagree: the HTML one threw where
  // the text one succeeded, so a check driven through only one of them would
  // have proved nothing about the other.
  for (const format of ['txt', 'html'] as const) {
    for (const [description, overrides] of malformed) {
      resetRateLimitsForTests();
      const res = new FakeResponse();
      await exportHandler({
        method: 'POST',
        headers: {},
        body: { ...validBody, format, ...overrides }
      }, res);

      const payload = res.body as { success?: boolean; error?: { code?: string } };
      assert(
        res.statusCode === 400,
        `${format}: ${description} should be refused with 400, got ${res.statusCode}`
      );
      assert(
        payload?.error?.code === 'INVALID_INPUT',
        `${format}: ${description} is the caller's mistake, not the service's, got ${JSON.stringify(payload?.error)}`
      );
    }

    // The ordinary request still exports, and so does one that omits both
    // fields: these are optional, so "not sent" and "malformed" are different
    // answers.
    for (const [description, overrides] of [
      ['a well-formed creature and themes', { creature: 'vampire', themes: ['forbidden_love'] }],
      ['neither field', {}],
      ['an empty themes array', { themes: [] }]
    ] as Array<[string, Record<string, unknown>]>) {
      resetRateLimitsForTests();
      const res = new FakeResponse();
      await exportHandler({
        method: 'POST',
        headers: {},
        body: { ...validBody, format, ...overrides }
      }, res);

      assert(
        res.statusCode === 200,
        `${format}: ${description} should still export, got ${res.statusCode} ${JSON.stringify(res.body)}`
      );
    }
  }
}

async function main(): Promise<void> {
  await verifyContinueDoesNotLogProseStoryIds();
  await verifyMalformedBodiesAreClientErrors();
  await verifyStoryLabRoutesRejectMalformedBodies();
  await verifyRejectedBodiesDoNotLogCallerFieldNames();
  await verifyRejectedStoryInputDoesNotRepeatCallerText();
  await verifyImageRequestLineNeitherRepeatsNorBlanksItsParameters();
  await verifyExportMeasuresItsSizeCapInBytes();
  await verifyExportBoundsItsTitleAsWellAsItsContent();
  await verifyExportTypeChecksItsOptionalDescriptiveFields();

  console.log('Story route contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
