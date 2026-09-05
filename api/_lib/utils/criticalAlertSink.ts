// Created: 2026-09-05 UTC
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
// Slack-incoming-webhook-compatible endpoint. A full Sentry/Datadog SDK
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
   * Must never throw and must never leave a rejected promise for the caller
   * to handle: a dead or misconfigured alert destination cannot be allowed to
   * take down the crash guard reporting through it.
   */
  send(entry: LogEntry): void;
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
    const text = formatCriticalAlertText(entry);
    // Fire-and-forget: awaiting here would make every critical log call
    // async and change the signature every existing call site relies on. A
    // failed delivery falls back to the same console line the default sink
    // would have printed, so the entry is never silently lost either way.
    void this.postFn(this.webhookUrl, { text }, this.timeoutMs).catch(() => {
      console.error('🚨 CRITICAL ERROR (webhook alert delivery failed; entry follows):', entry);
    });
  }
}

/**
 * `entry` has already passed through the logger's own redaction (see
 * `logger.ts`'s `redactSensitiveLogData`) before this is ever called, so
 * nothing further needs to be stripped here — only formatted.
 */
export function formatCriticalAlertText(entry: LogEntry): string {
  const lines = [`🚨 *CRITICAL*: ${entry.message}`, `Time: ${entry.timestamp}`];

  if (entry.context?.endpoint) {
    lines.push(`Endpoint: ${entry.context.endpoint}`);
  }
  if (entry.context?.requestId) {
    lines.push(`Request: ${entry.context.requestId}`);
  }
  if (entry.error) {
    lines.push(`Error: ${entry.error.name}: ${entry.error.message}`);
  }

  return lines.join('\n');
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

export function createCriticalAlertSinkConfig(options: CriticalAlertSinkConfigOptions = {}): CriticalAlertSinkConfig {
  const env = options.env ?? process.env;
  const webhookUrl = options.webhookUrl ?? env[CRITICAL_ALERT_WEBHOOK_URL_ENV_VAR];

  if (webhookUrl) {
    return {
      mode: 'webhook',
      configured: true,
      sink: new WebhookCriticalAlertSink({ webhookUrl, postFn: options.postFn })
    };
  }

  return {
    mode: 'console',
    configured: true,
    sink: new ConsoleCriticalAlertSink()
  };
}

/**
 * The one entry point `logger.ts` calls. Resolves a fresh config from the
 * live environment on every call — the same cheap, no-network-until-actually-
 * sending pattern `api/health.ts` already uses for the rate-limit and Story
 * Lab job stores — rather than caching a sink the process can never
 * reconfigure without a restart.
 */
export function dispatchCriticalAlert(entry: LogEntry, options: CriticalAlertSinkConfigOptions = {}): void {
  createCriticalAlertSinkConfig(options).sink.send(entry);
}
