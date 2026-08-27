// Created: 2026-08-25 23:55 UTC

import { randomUUID } from 'node:crypto';

/**
 * Long enough for every correlation id a real client sends — a UUID, a Vercel
 * request id, an OpenTelemetry trace id, this app's own `req_<uuid>` — and short
 * enough that the value cannot become the bulk of a log line.
 */
export const MAX_REQUEST_CORRELATION_ID_LENGTH = 128;

/**
 * The characters a correlation id is written with. Deliberately not "whatever a
 * header can carry": the id is interpolated into log lines and echoed into a
 * response header, and neither is a place for arbitrary caller text.
 */
const REQUEST_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:+=/-]+$/;

/**
 * The header the settled id is echoed back on, named once.
 *
 * `corsPolicy` lists the same name twice — once as a request header a caller
 * may send, once as a response header a browser is allowed to read back — and
 * a route that spelled it a fourth time could disagree with all three.
 */
export const REQUEST_CORRELATION_ID_HEADER = 'X-Request-ID';

interface RequestWithHeaders {
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseWithHeaders {
  setHeader(name: string, value: string): void;
}

/**
 * Read the caller's correlation id, or mint one.
 *
 * `/api/story/generate`, `/api/image/generate`, and `/api/export/save` each took
 * `req.headers['x-request-id']` exactly as sent — `req.headers['x-request-id']
 * || \`req_${randomUUID()}\`` — and then did two things with it: wrote it back
 * as the `X-Request-ID` response header, and stamped it into every log line for
 * the request, including the structured `LogContext.requestId` that reaches the
 * thousand-entry log buffer. Nothing bounded its length or its shape, so a
 * caller decided how much of this service's log output their request was worth:
 * a kilobyte of header text is a kilobyte on every line the request writes, kept
 * in the buffer, and repeatable at the rate the route can be called. It is also
 * caller text landing in logs, which is the one thing the sibling
 * `loggableRequestParameters` exists to prevent in these same handlers — down to
 * reducing the request body's *field names* on the grounds that "a JSON object's
 * keys are whatever the body was written with".
 *
 * A supplied id is honoured when it is plausibly a correlation id, because
 * that is the entire value of the header: a caller tracing a request across
 * their own logs and this service's needs the id to survive. Anything else is
 * replaced rather than rejected — the id names the request, it is not part of
 * what was asked for, so a malformed one is no reason to refuse the work.
 *
 * A repeated header arrives as an array on some runtimes; the first value is the
 * one the client-facing hop sent, the same reading `corsPolicy` uses.
 */
export function readRequestCorrelationId(req: RequestWithHeaders | undefined): string {
  const header = req?.headers?.['x-request-id'];
  const supplied = Array.isArray(header) ? header[0] : header;

  if (typeof supplied === 'string') {
    const trimmed = supplied.trim();
    if (
      trimmed.length > 0
      && trimmed.length <= MAX_REQUEST_CORRELATION_ID_LENGTH
      && REQUEST_CORRELATION_ID_PATTERN.test(trimmed)
    ) {
      return trimmed;
    }
  }

  return `req_${randomUUID()}`;
}

/**
 * Settle this request's correlation id and echo it to the caller.
 *
 * Reading the id and writing it back are one step, not two: an id that is not
 * echoed names nothing the caller can quote, and a header written from a value
 * read anywhere but here is a header that does not obey the rules above. This
 * was the opening pair of lines inside `beginPostRoute` and reachable only
 * through it, which made a correlation id something a route could have *only*
 * by also adopting POST-only method dispatch — so `/api/story-lab/jobs` and
 * `/api/story-lab/account`, which each serve more than `POST`, had no id at
 * all. Splitting the id out of the method rules is what lets those two settle
 * one without pretending to be paid POST routes.
 *
 * Call it before anything else the route does, including its CORS branch, so
 * that a preflight answer carries the id too and every line the request writes
 * — the method refusal included — can be stamped with it.
 */
export function settleRequestCorrelationId(
  req: RequestWithHeaders | undefined,
  res: ResponseWithHeaders
): string {
  const requestId = readRequestCorrelationId(req);
  res.setHeader(REQUEST_CORRELATION_ID_HEADER, requestId);
  return requestId;
}
