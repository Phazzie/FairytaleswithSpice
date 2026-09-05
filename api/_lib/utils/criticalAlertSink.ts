// Created: 2026-09-05 UTC
// Revised: 2026-09-05 UTC — Codex review on PR #339 found four P1s and a P2
// in the first cut of this module; all five are folded in below rather than
// left as follow-ups, since each one directly undermines the point of the
// fix (see the dated notes on each change for the finding it answers).
//
// `Logger.critical()`'s own doc comment says this tier is for "system
// failures, data corruption, security issues" — and `ERROR_LOGGING_IMPROVEMENTS.md`
// shows the intended usage as `logCritical('Security breach detected', ...)`.
// The method that was supposed to make "critical" mean something beyond
// another `console.error` (`sendToExternalLogger`) was a literal
// `// TODO: Implement external logging service integration` stub. That was
// inert but harmless until `expressApiRoutes.ts`'s route-failure crash guard
// and `unhandledProcessFailureLogger.ts`'s process-crash guard were both
// wired to call `logCritical` — the app's two last lines of defense funneled
// into a severity tier that did nothing more than the `error()` level below it.
//
// This gives `critical()` a real, pluggable destination. Unconfigured
// deployments keep the exact prior console-only behavior (byte-for-byte);
// setting `CRITICAL_ALERT_WEBHOOK_URL` posts a redacted summary to any
// Slack-incoming-webhook-compatible endpoint, but only once NODE_ENV is
// actually `production` — the one environment `critical()` ever dispatches
// beyond the console in (see `logger.ts`). A full Sentry/Datadog SDK
// integration is a bigger, credentialed dependency this environment has no
// way to verify end-to-end — flagged as a known follow-up rather than faked.
//
// Mirrors the `mode` / `isConfigured()` shape `rateLimitStoreConfig.ts` and
// `storyLabJobStoreConfig.ts` already use for other durable-dependency
// visibility, so `/api/health` can report this the same way.

import axios from 'axios';
import type { LogEntry } from './logger';

export type CriticalAlertSinkMode = 'console' | 'webhook';

const CRITICAL_ALERT_WEBHOOK_URL_ENV_VAR = 'CRITICAL_ALERT_WEBHOOK_URL';
const DEFAULT_WEBHOOK_TIMEOUT_MS = 3000;

export interface CriticalAlertSink {
  /**
   * Fire-and-forget entry point: must never throw and must never leave a
   * rejected promise for the caller to handle, since most call sites (the
   * API route crash guard, in particular) cannot afford to await delivery
   * before answering the request.
   */
  send(entry: LogEntry): void;
  /**
   * The same delivery, awaited. For the one call site that must not let the
   * process die before an alert has had a chance to leave it — the
   * `uncaughtException` handler in `story-generator/src/server.ts`, which
   * calls `process.exit(1)` right after logging (see `logCriticalAndFlush` in
   * `logger.ts`). Still never throws: a delivery failure resolves the same as
   * a success, after falling back to the console line `send` would have
   * printed.
   */
  sendAndWait(entry: LogEntry): Promise<void>;
}

/**
 * The original (pre-fix) behavior, kept as the default so an unconfigured
 * deployment sees zero change: log the entry to the console a second time,
 * tagged as critical.
 */
export class ConsoleCriticalAlertSink implements CriticalAlertSink {
  send(entry: LogEntry): void {
    console.error('🚨 CRITICAL ERROR (no external alert destination configured):', entry);
  }

  async sendAndWait(entry: LogEntry): Promise<void> {
    this.send(entry);
  }
}

export type CriticalAlertPostFn = (url: string, body: unknown, timeoutMs: number) => Promise<unknown>;

async function defaultCriticalAlertPostFn(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  return axios.post(url, body, { timeout: timeoutMs });
}

export interface WebhookCriticalAlertSinkOptions {
  webhookUrl: string;
  timeoutMs?: number;
  postFn?: CriticalAlertPostFn;
}

/**
 * Posts a Slack-incoming-webhook-compatible body (`{ text }`), so the same
 * env var can point at a Slack webhook, a generic alert relay, or anything
 * else that accepts that shape without further configuration here.
 */
export class WebhookCriticalAlertSink implements CriticalAlertSink {
  private readonly webhookUrl: string;
  private readonly timeoutMs: number;
  private readonly postFn: CriticalAlertPostFn;

  constructor(options: WebhookCriticalAlertSinkOptions) {
    this.webhookUrl = options.webhookUrl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
    this.postFn = options.postFn ?? defaultCriticalAlertPostFn;
  }

  send(entry: LogEntry): void {
    // Fire-and-forget: awaiting here would make every critical log call
    // async and change the signature every existing call site relies on. A
    // failed delivery falls back to the same console line the default sink
    // would have printed, so the entry is never silently lost either way.
    void this.sendAndWait(entry);
  }

  async sendAndWait(entry: LogEntry): Promise<void> {
    const text = formatCriticalAlertText(entry);
    try {
      // `this.timeoutMs` bounds the default `postFn`'s own axios call, so this
      // await settles within that window even on an unreachable or slow host.
      await this.postFn(this.webhookUrl, { text }, this.timeoutMs);
    } catch {
      console.error('🚨 CRITICAL ERROR (webhook alert delivery failed; entry follows):', entry);
    }
  }
}

/**
 * `entry.message` is always one of this codebase's own log call sites (a
 * fixed string such as `'Unhandled API route failure'`), never caller text.
 * `entry.error.message`, in contrast, is whatever the thrown value's own
 * `message` happened to be — and both crash guards this sink serves
 * (`expressApiRoutes.ts`'s `apiErrorHandler`, `unhandledProcessFailureLogger.ts`)
 * deliberately accept *any* error, including one that stringifies a piece of
 * story prose, a user prompt, or a raw provider payload into its message.
 * `redactSensitiveLogData` only strips recognizable credentials, emails, and
 * URLs from that string — it does not remove arbitrary prose — so forwarding
 * `entry.error.message` verbatim to a third-party webhook would be a new
 * disclosure path that console-only logging never had. The error's name
 * (`TypeError`, `RangeError`, this app's own error classes) is bounded,
 * operational, and safe to send; the message is not, so it is left out here
 * even though it is still printed locally by `outputToConsole` in `logger.ts`.
 *
 * `entry.context.endpoint` and `entry.error.name` get the same treatment via
 * `sanitizeEndpointForAlert`/`sanitizeErrorNameForAlert` below — Codex's
 * re-review of this same PR found both were still uncontrolled disclosure
 * paths even after the message fix above.
 */
export function formatCriticalAlertText(entry: LogEntry): string {
  const lines = [`🚨 *CRITICAL*: ${entry.message}`, `Time: ${entry.timestamp}`];

  if (entry.context?.endpoint) {
    lines.push(`Endpoint: ${sanitizeEndpointForAlert(entry.context.endpoint)}`);
  }
  if (entry.context?.requestId) {
    lines.push(`Request: ${entry.context.requestId}`);
  }
  if (entry.error?.name) {
    lines.push(`Error type: ${sanitizeErrorNameForAlert(entry.error.name)}`);
  }

  return lines.join('\n');
}

/**
 * `entry.context.endpoint` is a request path, and at least one route
 * (`api/story-lab/jobs.ts`'s SSE endpoint, whose `EventSource` client cannot
 * set custom headers) accepts its `API_KEYS` credential as an `apiKey` query
 * parameter fallback — see `withEventStreamAuth`. `redactSensitiveLogData`
 * blanks a *key* it recognizes; it does not inspect an arbitrary token
 * sitting inside a URL's query string, so a caller's own credential could
 * otherwise ride along into this webhook's payload verbatim whenever that
 * route's escaped-failure path logged its own URL as the endpoint. Every
 * `logCritical` call site is trusted to keep the *path* itself free of
 * secrets (it names a route, not a resource id); only the query string —
 * where a fallback credential like this one lives — is stripped, once, here,
 * rather than trusting each caller to have done it already.
 */
function sanitizeEndpointForAlert(endpoint: string): string {
  const queryIndex = endpoint.indexOf('?');
  return queryIndex === -1 ? endpoint : endpoint.slice(0, queryIndex);
}

/**
 * `Error.prototype.name` is an ordinary writable string property, not a
 * closed set of built-in names: `extractErrorDetails` in `logger.ts` accepts
 * whatever a thrown value's `name` happens to be, and nothing stops a
 * dependency (or a handler constructing its own error) from setting it to
 * arbitrary text — including text derived from user input. A short,
 * identifier-shaped value (`TypeError`, `ValidationError`, this app's own
 * error classes) is safe to forward; anything else is replaced with a
 * generic label rather than risking the same disclosure this function
 * already refuses for `error.message`.
 *
 * Takes `unknown`, not `string`, on purpose: `LogEntry['error'] .name` is
 * typed as `string`, but `extractErrorDetails` only guarantees that as of its
 * own latest fix — a caller further upstream that constructs a `LogEntry` by
 * hand, or a future regression there, could still hand this a non-string
 * value (a `Symbol`, say). `RegExp.test` coerces its argument with an
 * implicit `ToString` that *throws* for a `Symbol`, which previously meant a
 * single malformed error name could crash `formatCriticalAlertText` before
 * `WebhookCriticalAlertSink.sendAndWait` ever reached its own `try` block —
 * defeating this whole sink's "never throws" contract for the exact
 * unanticipated-bug case it exists to alert on. The explicit `typeof` guard
 * below means no input can ever reach the regex except a genuine string.
 */
const SAFE_ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

function sanitizeErrorNameForAlert(name: unknown): string {
  return typeof name === 'string' && SAFE_ERROR_NAME_PATTERN.test(name) ? name : 'Error';
}

/**
 * Accepts only a well-formed `http(s)` URL. Anything else — whitespace,
 * `not-a-url`, an `ftp:`/`mailto:` scheme, a bare hostname `new URL` cannot
 * parse — would report `configured: true` on `/api/health` while every
 * delivery attempt fails, making a deployment typo indistinguishable from
 * working alerting until the first real emergency.
 */
function isValidHttpWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface CriticalAlertSinkConfigOptions {
  webhookUrl?: string;
  env?: Record<string, string | undefined>;
  postFn?: CriticalAlertPostFn;
}

export interface CriticalAlertSinkConfig {
  mode: CriticalAlertSinkMode;
  configured: boolean;
  sink: CriticalAlertSink;
}

function consoleOnlyConfig(): CriticalAlertSinkConfig {
  return { mode: 'console', configured: true, sink: new ConsoleCriticalAlertSink() };
}

export function createCriticalAlertSinkConfig(options: CriticalAlertSinkConfigOptions = {}): CriticalAlertSinkConfig {
  const env = options.env ?? process.env;
  const webhookUrl = options.webhookUrl ?? env[CRITICAL_ALERT_WEBHOOK_URL_ENV_VAR];

  if (!webhookUrl) {
    return consoleOnlyConfig();
  }

  if (!isValidHttpWebhookUrl(webhookUrl)) {
    // Named the same way `rateLimitStoreConfig` reports a `postgres` mode it
    // can't reach: `mode` says what was requested, `configured` says whether
    // it actually works. Falls back to the console sink rather than a
    // destination guaranteed to fail on every delivery.
    return { mode: 'webhook', configured: false, sink: new ConsoleCriticalAlertSink() };
  }

  const isProductionEnvironment = (env['NODE_ENV'] ?? 'development') === 'production';
  if (!isProductionEnvironment) {
    // `Logger.critical()` only ever dispatches beyond the console when
    // `NODE_ENV` is `production` (see `logger.ts`'s `log()`). Reporting
    // `webhook` here for any other environment — including the README's own
    // documented `NODE_ENV=development` local setup — would claim a
    // destination that cannot actually receive anything right now, which is
    // the same false-positive this field exists to prevent.
    return consoleOnlyConfig();
  }

  return {
    mode: 'webhook',
    configured: true,
    sink: new WebhookCriticalAlertSink({ webhookUrl, postFn: options.postFn })
  };
}

/**
 * The one entry point `logger.ts`'s `log()` calls for a fire-and-forget
 * critical dispatch. Resolves a fresh config from the live environment on
 * every call — the same cheap, no-network-until-actually-sending pattern
 * `api/health.ts` already uses for the rate-limit and Story Lab job stores —
 * rather than caching a sink the process can never reconfigure without a
 * restart.
 */
export function dispatchCriticalAlert(entry: LogEntry, options: CriticalAlertSinkConfigOptions = {}): void {
  createCriticalAlertSinkConfig(options).sink.send(entry);
}

/**
 * The awaited counterpart, for `logger.ts`'s `criticalAndFlush` — used only
 * by the process-crash guard in `story-generator/src/server.ts`, which must
 * give delivery a bounded chance to leave the process before its
 * `uncaughtException` handler calls `process.exit(1)`. A fire-and-forget
 * `send()` there has no guarantee of even starting before the process ends.
 */
export async function dispatchCriticalAlertAndWait(entry: LogEntry, options: CriticalAlertSinkConfigOptions = {}): Promise<void> {
  await createCriticalAlertSinkConfig(options).sink.sendAndWait(entry);
}
