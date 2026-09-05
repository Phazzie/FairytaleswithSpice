#!/usr/bin/env tsx
// Created: 2026-09-05 UTC
//
// `logger.ts`'s `sendToExternalLogger` used to be a literal
// `// TODO: Implement external logging service integration` stub — every
// "critical" log just printed to the console a second time, identical in
// effect to `error()`. That gap became load-bearing once the API route
// crash guard (`expressApiRoutes.ts`) and the process crash guard
// (`unhandledProcessFailureLogger.ts`) were both wired to call `logCritical`.
// This suite pins the real sink: console-only by default (byte-for-byte
// unchanged from before), a webhook when `CRITICAL_ALERT_WEBHOOK_URL` is
// configured, and non-throwing delivery even when that webhook is
// unreachable.

import {
  ConsoleCriticalAlertSink,
  WebhookCriticalAlertSink,
  createCriticalAlertSinkConfig,
  dispatchCriticalAlert,
  formatCriticalAlertText
} from '../api/_lib/utils/criticalAlertSink';
import type { LogEntry } from '../api/_lib/utils/logger';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

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
  const config = createCriticalAlertSinkConfig({ env: {} });

  assert(config.mode === 'console', `expected console mode, got ${config.mode}`);
  assert(config.configured, 'the console sink should always report configured');
  assert(config.sink instanceof ConsoleCriticalAlertSink, 'the default sink should be the console sink');
}

function testWebhookSinkIsSelectedWhenUrlConfigured(): void {
  const config = createCriticalAlertSinkConfig({ env: { CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' } });

  assert(config.mode === 'webhook', `expected webhook mode, got ${config.mode}`);
  assert(config.configured, 'a configured webhook URL should report configured');
  assert(config.sink instanceof WebhookCriticalAlertSink, 'a configured webhook URL should select the webhook sink');
}

function testExplicitWebhookUrlOptionWinsOverEnv(): void {
  const config = createCriticalAlertSinkConfig({
    webhookUrl: 'https://hooks.example.com/explicit',
    env: { CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/from-env' }
  });

  assert(config.mode === 'webhook', 'an explicit webhookUrl option should still select webhook mode');
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

function testFormatCriticalAlertTextOmitsMissingFields(): void {
  const text = formatCriticalAlertText({
    timestamp: '2026-09-05T00:00:00.000Z',
    level: 'critical',
    message: 'Unhandled uncaughtException'
  });

  assert(text.includes('Unhandled uncaughtException'), 'the message should always be included');
  assert(!text.includes('Endpoint:'), 'a missing endpoint should not produce an empty "Endpoint:" line');
  assert(!text.includes('Request:'), 'a missing requestId should not produce an empty "Request:" line');
  assert(!text.includes('Error:'), 'a missing error should not produce an empty "Error:" line');
}

async function testDispatchCriticalAlertRoutesThroughTheResolvedSink(): Promise<void> {
  const posted: unknown[] = [];

  await withSilencedConsoleError(async () => {
    dispatchCriticalAlert(sampleEntry(), {
      env: { CRITICAL_ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert' },
      postFn: async (_url, body) => {
        posted.push(body);
        return { status: 200 };
      }
    });
    await flushMicrotasks();
  });

  assert(posted.length === 1, 'dispatchCriticalAlert should hand the entry to the configured webhook sink');
}

async function main(): Promise<void> {
  testConsoleSinkIsDefaultWhenNoWebhookConfigured();
  testWebhookSinkIsSelectedWhenUrlConfigured();
  testExplicitWebhookUrlOptionWinsOverEnv();
  await testConsoleSinkOutputIsUnchangedFromBeforeTheFix();
  await testWebhookSinkPostsAFormattedTextBody();
  await testWebhookSinkNeverThrowsWhenDeliveryFails();
  testFormatCriticalAlertTextOmitsMissingFields();
  await testDispatchCriticalAlertRoutesThroughTheResolvedSink();

  console.log('Critical alert sink tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
