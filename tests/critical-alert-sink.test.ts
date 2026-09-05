#!/usr/bin/env tsx
// Created: 2026-09-05 UTC
// Revised: 2026-09-05 UTC — Codex's review of the initial push on PR #339
// found five real issues (four P1, one P2); this suite was extended to pin
// each fix rather than just the original console/webhook selection:
//   1. arbitrary error text no longer reaches the webhook payload
//   2. a malformed `CRITICAL_ALERT_WEBHOOK_URL` is reported as unconfigured
//   3. webhook mode is only ever reported (and only ever dispatches) in an
//      environment where `Logger.critical()` actually sends beyond the
//      console — see `logger.ts`
//   4. `sendAndWait` gives a caller (the process-crash guard in
//      `story-generator/src/server.ts`) a way to await delivery before
//      exiting, instead of a fire-and-forget call with no such guarantee
//
// `logger.ts`'s `sendToExternalLogger` used to be a literal
// `// TODO: Implement external logging service integration` stub — every
// "critical" log just printed to the console a second time, identical in
// effect to `error()`. That gap became load-bearing once the API route
// crash guard (`expressApiRoutes.ts`) and the process crash guard
// (`unhandledProcessFailureLogger.ts`) were both wired to call `logCritical`.

import {
  ConsoleCriticalAlertSink,
  WebhookCriticalAlertSink,
  createCriticalAlertSinkConfig,
  dispatchCriticalAlert,
  dispatchCriticalAlertAndWait,
  formatCriticalAlertText
} from '../api/_lib/utils/criticalAlertSink';
import type { LogEntry } from '../api/_lib/utils/logger';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const PRODUCTION_ENV = { NODE_ENV: 'production' };

function sampleEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-09-05T00:00:00.000Z',
    level: 'critical',
    message: 'Unhandled API route failure',
    context: { endpoint: '/api/story/generate', requestId: 'req_123' },
    error: { name: 'TypeError', message: 'Cannot read properties of undefined' },
    ...overrides
  };
}

async function withSilencedConsoleError<T>(run: (calls: unknown[][]) => T | Promise<T>): Promise<T> {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    return await run(calls);
  } finally {
    console.error = original;
  }
}

async function flushMicrotasks(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

function testConsoleSinkIsDefaultWhenNoWebhookConfigured(): void {
  const config = createCriticalAlertSinkConfig({ env: { ...PRODUCTION_ENV } });

  assert(config.mode === 'console', `expected console mode, got ${config.mode}`);
  assert(config.configured, 'the console sink should always report configured');
  assert(config.sink instanceof ConsoleCriticalAlertSink, 'the default sink should be the console sink');
}

function testWebhookSinkIsSelectedWhenUrlConfiguredInProduction(): void {
  const config = createCriticalAlertSinkConfig({
    env: { ...PRODUCTION_ENV, CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' }
  });

  assert(config.mode === 'webhook', `expected webhook mode, got ${config.mode}`);
  assert(config.configured, 'a configured webhook URL should report configured');
  assert(config.sink instanceof WebhookCriticalAlertSink, 'a configured webhook URL should select the webhook sink');
}

function testExplicitWebhookUrlOptionWinsOverEnv(): void {
  const config = createCriticalAlertSinkConfig({
    webhookUrl: 'https://hooks.example.com/explicit',
    env: { ...PRODUCTION_ENV, CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/from-env' }
  });

  assert(config.mode === 'webhook', 'an explicit webhookUrl option should still select webhook mode');
}

// Finding #3 (P1): any truthy-but-invalid value used to report `configured:
// true` while every delivery attempt would fail. Malformed here regardless of
// environment, since a typo is worth catching before it ever reaches production.
function testMalformedWebhookUrlReportsUnconfigured(): void {
  for (const badUrl of ['not-a-url', '   ', 'ftp://hooks.example.com/alert', 'hooks.example.com/alert']) {
    const config = createCriticalAlertSinkConfig({ env: { ...PRODUCTION_ENV, CRITICAL_ALERT_WEBHOOK_URL: badUrl } });

    assert(config.mode === 'webhook', `a malformed URL (${badUrl}) should still report webhook mode, requested but broken`);
    assert(!config.configured, `a malformed URL (${badUrl}) should report configured: false`);
    assert(config.sink instanceof ConsoleCriticalAlertSink, `a malformed URL (${badUrl}) should fall back to the console sink`);
  }
}

// Finding #5 (P2): `Logger.critical()` only ever dispatches beyond the console
// when NODE_ENV is `production` (see `logger.ts`), so reporting `webhook` mode
// in any other environment — including the README's own documented
// `NODE_ENV=development` setup — would claim a destination nothing can reach.
function testValidWebhookUrlOutsideProductionReportsConsole(): void {
  for (const env of [{}, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }]) {
    const config = createCriticalAlertSinkConfig({
      env: { ...env, CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' }
    });

    assert(
      config.mode === 'console',
      `a valid webhook URL outside production (NODE_ENV=${env['NODE_ENV']}) should report console mode, got ${config.mode}`
    );
    assert(config.configured, 'console mode should always report configured');
  }
}

async function testConsoleSinkOutputIsUnchangedFromBeforeTheFix(): Promise<void> {
  await withSilencedConsoleError(calls => {
    new ConsoleCriticalAlertSink().send(sampleEntry());

    assert(calls.length === 1, `expected exactly one console.error call, got ${calls.length}`);
    const [firstArg, secondArg] = calls[0]!;
    assert(
      typeof firstArg === 'string' && firstArg.includes('CRITICAL ERROR'),
      'the console sink should still tag the line as a critical error'
    );
    assert(secondArg !== undefined, 'the console sink should still print the full entry for local debugging');
  });
}

async function testWebhookSinkPostsAFormattedTextBody(): Promise<void> {
  const posted: Array<{ url: string; body: unknown; timeoutMs: number }> = [];
  const sink = new WebhookCriticalAlertSink({
    webhookUrl: 'https://hooks.example.com/alert',
    postFn: async (url, body, timeoutMs) => {
      posted.push({ url, body, timeoutMs });
      return { status: 200 };
    }
  });

  sink.send(sampleEntry());
  await flushMicrotasks();

  assert(posted.length === 1, `expected exactly one webhook post, got ${posted.length}`);
  assert(posted[0]!.url === 'https://hooks.example.com/alert', 'the sink should post to the configured URL');
  const body = posted[0]!.body as { text: string };
  assert(typeof body.text === 'string' && body.text.length > 0, 'the posted body should carry a non-empty text field');
  assert(body.text.includes('Unhandled API route failure'), 'the posted text should include the log message');
  assert(body.text.includes('/api/story/generate'), 'the posted text should include the endpoint from context');
  assert(body.text.includes('TypeError'), 'the posted text should include the error name');
  assert(posted[0]!.timeoutMs > 0, 'the sink should pass a positive timeout to the post function');
}

// Finding #2 (P1): the raw error message can carry story prose, user input, or
// a raw provider payload — both crash guards this sink serves accept any
// error. Only the bounded, operational error name may leave this process.
function testWebhookSinkOmitsRawErrorMessage(): void {
  const posted: Array<{ body: unknown }> = [];
  const sink = new WebhookCriticalAlertSink({
    webhookUrl: 'https://hooks.example.com/alert',
    postFn: async (_url, body) => {
      posted.push({ body });
      return { status: 200 };
    }
  });

  sink.send(sampleEntry({
    error: { name: 'ValidationError', message: 'Once upon a time, the user typed something private here' }
  }));

  const body = posted[0]?.body as { text?: string } | undefined;
  assert(body?.text !== undefined, 'expected the sink to have posted a body');
  assert(body.text!.includes('ValidationError'), 'the error name should still be included');
  assert(
    !body.text!.includes('Once upon a time'),
    'the raw error message must never reach the external webhook payload'
  );
}

async function testWebhookSinkNeverThrowsWhenDeliveryFails(): Promise<void> {
  const sink = new WebhookCriticalAlertSink({
    webhookUrl: 'https://hooks.example.com/unreachable',
    postFn: async () => {
      throw new Error('network unreachable');
    }
  });

  await withSilencedConsoleError(async calls => {
    // The call itself must not throw synchronously, and the rejection it
    // schedules must not escape as an unhandled rejection either.
    sink.send(sampleEntry());
    await flushMicrotasks();

    assert(calls.length === 1, `a failed delivery should still fall back to a console line, got ${calls.length} calls`);
  });
}

// Finding #1 (P1): `sendAndWait` is what `logCriticalAndFlush` uses so the
// process-crash guard can await delivery before `process.exit(1)` — a
// fire-and-forget `send()` there has no guarantee of even starting the
// request before the process ends.
async function testWebhookSinkAndWaitResolvesAfterSuccessfulDelivery(): Promise<void> {
  let delivered = false;
  const sink = new WebhookCriticalAlertSink({
    webhookUrl: 'https://hooks.example.com/alert',
    postFn: async () => {
      await flushMicrotasks();
      delivered = true;
      return { status: 200 };
    }
  });

  await sink.sendAndWait(sampleEntry());
  assert(delivered, 'sendAndWait should not resolve until the post function itself resolves');
}

async function testWebhookSinkAndWaitResolvesEvenWhenDeliveryFails(): Promise<void> {
  const sink = new WebhookCriticalAlertSink({
    webhookUrl: 'https://hooks.example.com/unreachable',
    postFn: async () => {
      throw new Error('network unreachable');
    }
  });

  await withSilencedConsoleError(async calls => {
    // Must resolve, never reject: a rejection here would turn an alert
    // delivery failure into a second crash inside the crash guard itself.
    await sink.sendAndWait(sampleEntry());
    assert(calls.length === 1, 'a failed sendAndWait should still fall back to a console line');
  });
}

async function testConsoleSinkAndWaitResolvesImmediately(): Promise<void> {
  await withSilencedConsoleError(async calls => {
    await new ConsoleCriticalAlertSink().sendAndWait(sampleEntry());
    assert(calls.length === 1, 'the console sink\'s sendAndWait should still print exactly one line');
  });
}

// Finding #1 (P1, re-review): `api/story-lab/jobs.ts`'s SSE endpoint accepts
// its `API_KEYS` credential as an `apiKey` query-parameter fallback (its
// `EventSource` client cannot set custom headers). The redactor blanks a
// recognized *key*, not an arbitrary token sitting inside a URL's query
// string, so that credential could otherwise ride along into the webhook
// payload verbatim via `context.endpoint`.
function testFormatCriticalAlertTextStripsQueryStringFromEndpoint(): void {
  const text = formatCriticalAlertText(sampleEntry({
    context: { endpoint: '/api/story-lab/jobs?jobId=abc&apiKey=super-secret-token', requestId: 'req_1' }
  }));

  assert(text.includes('/api/story-lab/jobs'), 'the path itself should still be included');
  assert(!text.includes('super-secret-token'), 'a credential riding in the query string must never reach the webhook');
  assert(!text.includes('apiKey'), 'the query string should be stripped entirely, not just its value');
}

// Finding #2 (P2, re-review): `error.name` is an ordinary writable string —
// nothing stops a dependency or handler from setting it to arbitrary text,
// including text derived from user input. Only an identifier-shaped name is
// forwarded; anything else is replaced with a generic label.
function testFormatCriticalAlertTextSanitizesUnsafeErrorNames(): void {
  const safe = formatCriticalAlertText(sampleEntry({ error: { name: 'ValidationError', message: 'x' } }));
  assert(safe.includes('ValidationError'), 'an identifier-shaped error name should be forwarded as-is');

  const unsafe = formatCriticalAlertText(sampleEntry({
    error: { name: 'Once upon a time the reader typed: <script>alert(1)</script>', message: 'x' }
  }));
  assert(!unsafe.includes('Once upon a time'), 'an arbitrary error name must not reach the webhook verbatim');
  assert(unsafe.includes('Error type: Error'), 'an unsafe error name should fall back to a generic label');
}

function testFormatCriticalAlertTextOmitsMissingFields(): void {
  const text = formatCriticalAlertText({
    timestamp: '2026-09-05T00:00:00.000Z',
    level: 'critical',
    message: 'Unhandled uncaughtException'
  });

  assert(text.includes('Unhandled uncaughtException'), 'the message should always be included');
  assert(!text.includes('Endpoint:'), 'a missing endpoint should not produce an empty "Endpoint:" line');
  assert(!text.includes('Request:'), 'a missing requestId should not produce an empty "Request:" line');
  assert(!text.includes('Error type:'), 'a missing error should not produce an empty "Error type:" line');
}

async function testDispatchCriticalAlertRoutesThroughTheResolvedSink(): Promise<void> {
  const posted: unknown[] = [];

  await withSilencedConsoleError(async () => {
    dispatchCriticalAlert(sampleEntry(), {
      env: { ...PRODUCTION_ENV, CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' },
      postFn: async (_url, body) => {
        posted.push(body);
        return { status: 200 };
      }
    });
    await flushMicrotasks();
  });

  assert(posted.length === 1, 'dispatchCriticalAlert should hand the entry to the configured webhook sink');
}

async function testDispatchCriticalAlertAndWaitResolvesOnlyAfterDelivery(): Promise<void> {
  let delivered = false;

  await dispatchCriticalAlertAndWait(sampleEntry(), {
    env: { ...PRODUCTION_ENV, CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' },
    postFn: async () => {
      await flushMicrotasks();
      delivered = true;
      return { status: 200 };
    }
  });

  assert(delivered, 'dispatchCriticalAlertAndWait should await the resolved sink\'s delivery');
}

async function main(): Promise<void> {
  testConsoleSinkIsDefaultWhenNoWebhookConfigured();
  testWebhookSinkIsSelectedWhenUrlConfiguredInProduction();
  testExplicitWebhookUrlOptionWinsOverEnv();
  testMalformedWebhookUrlReportsUnconfigured();
  testValidWebhookUrlOutsideProductionReportsConsole();
  await testConsoleSinkOutputIsUnchangedFromBeforeTheFix();
  await testWebhookSinkPostsAFormattedTextBody();
  testWebhookSinkOmitsRawErrorMessage();
  await testWebhookSinkNeverThrowsWhenDeliveryFails();
  await testWebhookSinkAndWaitResolvesAfterSuccessfulDelivery();
  await testWebhookSinkAndWaitResolvesEvenWhenDeliveryFails();
  await testConsoleSinkAndWaitResolvesImmediately();
  testFormatCriticalAlertTextStripsQueryStringFromEndpoint();
  testFormatCriticalAlertTextSanitizesUnsafeErrorNames();
  testFormatCriticalAlertTextOmitsMissingFields();
  await testDispatchCriticalAlertRoutesThroughTheResolvedSink();
  await testDispatchCriticalAlertAndWaitResolvesOnlyAfterDelivery();

  console.log('Critical alert sink tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
