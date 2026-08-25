#!/usr/bin/env tsx
// Created: 2026-08-24 22:15 UTC
//
// HTTP-contract regressions for the legacy story/export routes:
//
// 1. `/api/story/generate`, `/api/story/continue`, `/api/export/save`, and
//    `/api/image/generate` answer a missing or non-object body with 400
//    INVALID_INPUT rather than crashing into their catch block and reporting
//    500 INTERNAL_ERROR.
// 2. Caller-supplied text (a prose story id, an unrecognized field name) does
//    not leak into request logs, on either the buffered sink or the console.
// 3. The export size cap is measured in bytes, not UTF-16 code units.

import { FILE_SIZE } from '../api/_lib/constants';
import { logger } from '../api/_lib/utils/logger';
import exportHandler from '../api/export/save';
import imageGenerateHandler from '../api/image/generate';
import continueHandler from '../api/story/continue';
import generateHandler from '../api/story/generate';

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
    await expectMissingBodyRejected('/api/story/generate', generateHandler, body);
    await expectMissingBodyRejected('/api/story/continue', continueHandler, body);
    await expectMissingBodyRejected('/api/export/save', exportHandler, body);
    await expectMissingBodyRejected('/api/image/generate', imageGenerateHandler, body);
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
  // genuine. Only pinning the whole form rejects it.
  const storyIdProse = 'Dana_at_the_clinic_on_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';
  const { consoleOutput } = await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId: storyIdProse,
        existingContent: '<p>She opened the door.</p>',
        currentChapterCount: 1
      }
    }, res);
    return res;
  });

  const started = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story/continue');

  assert(started, 'the continuation route should log the request it started');
  assert(
    consoleOutput.includes('/api/story/continue'),
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

  // `maintainTone` is the scalar the route does not guard. `currentChapterCount`
  // it does — `typeof input.currentChapterCount !== 'number'` is answered with a
  // 400 before anything is logged — but nothing checks `maintainTone`, and the
  // *service* logs it on the way past. A prose value therefore reaches the
  // request line the service writes, one call below this route.
  logger.clearLogs();
  const scalarProse = 'Dana asked me not to tell anyone about Rosewood';
  const { consoleOutput: scalarConsole } = await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: {
        storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
        existingContent: '<p>She opened the door.</p>',
        currentChapterCount: 1,
        maintainTone: scalarProse
      }
    }, res);
    return res;
  });

  const serviceEntry = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === 'continueChapter');

  assert(serviceEntry, 'the continuation service should log the request it received');
  for (const [sink, written] of [
    ['buffer', JSON.stringify(serviceEntry.context)],
    ['console', scalarConsole]
  ] as const) {
    assert(
      !written.includes('Dana') && !written.includes('Rosewood'),
      `prose sent as a flag must not reach the ${sink} (got ${written})`
    );
  }
  assert(
    serviceEntry.context?.requestParameters?.['maintainTone'] === '[UNRECOGNIZED]',
    `a flag that is not a boolean should be reported (got ${JSON.stringify(serviceEntry.context?.requestParameters)})`
  );

  // The ordinary case still logs the id, which is what makes it worth keeping.
  logger.clearLogs();
  const realStoryId = 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f';
  await captureConsole(async () => {
    const res = new FakeResponse();
    await continueHandler({
      method: 'POST',
      headers: {},
      body: { storyId: realStoryId, existingContent: '<p>She opened the door.</p>', currentChapterCount: 1 }
    }, res);
    return res;
  });

  const realEntry = logger
    .getRecentLogs(50, 'info')
    .find(entry => entry.context?.endpoint === '/api/story/continue');
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
 * Both sinks are asserted on, with prose markers, exactly as the value-side
 * checks above do: reverting either call site fails this.
 */
async function verifyRejectedBodiesDoNotLogCallerFieldNames(): Promise<void> {
  // The third entry is a field name each route's own contract recognises, so
  // the fixture body below carries one real field alongside the prose one —
  // `userInput` is not part of `/api/image/generate`'s contract, so reusing it
  // there would fail for the wrong reason (the route correctly not recognising
  // a field it was never sent).
  const routes = [
    ['/api/story/generate', generateHandler, 'userInput'],
    ['/api/story/continue', continueHandler, 'userInput'],
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

    const { response, consoleOutput } = await captureConsole(async () => {
      const res = new FakeResponse();
      await generateHandler({ method: 'POST', headers: {}, body: testCase.body }, res);
      return res;
    });

    assert(
      response.statusCode === 400,
      `an invalid ${testCase.name} should be a caller error, got ${response.statusCode}`
    );

    const payload = response.body as { error?: { code?: string; providedValue?: unknown } };
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
  const arrayInputResponse = new FakeResponse();
  await captureConsole(async () => {
    await generateHandler(
      { method: 'POST', headers: {}, body: { ...validBody, userInput: [prose] } },
      arrayInputResponse
    );
    return arrayInputResponse;
  });

  const arrayInputPayload = arrayInputResponse.body as { error?: { code?: string; field?: string } };
  assert(
    arrayInputResponse.statusCode === 400 && arrayInputPayload.error?.field === 'userInput',
    `a non-string userInput should be refused as a caller error, got ${arrayInputResponse.statusCode} ${JSON.stringify(arrayInputPayload.error)}`
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

async function main(): Promise<void> {
  await verifyContinueDoesNotLogProseStoryIds();
  await verifyMalformedBodiesAreClientErrors();
  await verifyRejectedBodiesDoNotLogCallerFieldNames();
  await verifyRejectedStoryInputDoesNotRepeatCallerText();
  await verifyExportMeasuresItsSizeCapInBytes();

  console.log('Story route contract tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
