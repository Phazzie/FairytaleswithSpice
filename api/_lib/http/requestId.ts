// Created: 2026-08-25 13:05 UTC

import { randomUUID } from 'node:crypto';

/**
 * The correlation id a route logs under and hands back to the caller.
 *
 * Three routes did three different things with it.
 *
 * `/api/story/generate` and `/api/export/save` read `req.headers['x-request-id']`
 * and used the value as-is: into `res.setHeader('X-Request-ID', …)` and into the
 * `[${requestId}]` prefix of every console line the request produced. The value
 * is whatever the caller sent. Node hands a repeated header over as `string[]`,
 * so two `X-Request-ID` headers made the log prefix read `a,b` and had
 * `setHeader` emit the header twice; and nothing bounded the length or the
 * characters, so a kilobyte of text sat in the response headers and at the front
 * of the log lines a human reads to find one request.
 *
 * `/api/story/continue` had the opposite problem: it generated an id, logged
 * under it, and never sent it. The caller of the one route most likely to be
 * reported as slow or failing could not name the id its failure was logged
 * under, and a caller that *did* send `X-Request-ID` had it silently ignored, so
 * the two sides of one request were recorded under different ids.
 *
 * One reading for all three: take the caller's id when it is a usable token,
 * generate one when it is not, and always answer with the id actually used so
 * the caller knows which one to quote.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Long enough for a UUID, a W3C `traceparent`, or a proxy's request id; short
 * enough that a rejected value cannot flood a log line or a response header.
 */
export const MAX_REQUEST_ID_LENGTH = 128;

/**
 * The characters request ids are actually built from — hex, base64url, and the
 * separators tracing formats use. Anything outside this is not sanitised into
 * shape, because a mutated echo is worse than an honest substitution: the caller
 * would be quoting an id that never appears in the logs. A value that does not
 * match is replaced, and the response header says so.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

/**
 * Read the caller's request id, or generate one. Never throws: the header bag
 * is whatever the runtime supplied, and a route cannot fail over its own
 * correlation id.
 */
export function readRequestId(req: unknown): string {
  const header = readHeaderValue(req, REQUEST_ID_HEADER);
  if (header === undefined) {
    return generateRequestId();
  }

  const candidate = header.trim();
  if (!candidate || candidate.length > MAX_REQUEST_ID_LENGTH || !REQUEST_ID_PATTERN.test(candidate)) {
    return generateRequestId();
  }

  return candidate;
}

/**
 * Settle the request id for this request and echo it, so the caller can quote
 * the id its request was logged under.
 */
export function applyRequestId(req: unknown, res: { setHeader?(name: string, value: string): void }): string {
  const requestId = readRequestId(req);
  res?.setHeader?.('X-Request-ID', requestId);

  return requestId;
}

/**
 * Read one request header, tolerating the `string[]` form a repeated header
 * arrives in and the casing a hand-built header bag may carry. Only the first
 * value of a repeated header is read — the same rule `corsPolicy` and the API
 * key middleware already use.
 */
function readHeaderValue(req: unknown, name: string): string | undefined {
  const headers = (req as { headers?: unknown } | null | undefined)?.headers;
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const bag = headers as Record<string, unknown>;
  const direct = bag[name];
  const raw = direct !== undefined
    ? direct
    : Object.entries(bag).find(([key]) => key.toLowerCase() === name)?.[1];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === 'string' ? value : undefined;
}
