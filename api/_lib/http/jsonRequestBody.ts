// Created: 2026-08-24 22:05 UTC

/**
 * Read a request body that is required to be a JSON object.
 *
 * The runtime hands `req.body` over as whatever it managed to parse: `undefined`
 * for an empty body or one whose content type it does not parse, a string when
 * the payload is not JSON, and an array for a JSON array. Routes that went
 * straight to `body.field` crashed on the first three of those, and the crash
 * was caught by the handler's own catch block, which reports 500
 * INTERNAL_ERROR — so a client that forgot the body, or sent it without
 * `Content-Type: application/json`, was told the service had failed and that
 * retrying might help. It is the request that is malformed, and only the caller
 * can fix it, so the caller has to be told 400.
 *
 * Returning `null` rather than throwing keeps that decision with the route,
 * which knows which fields its own INVALID_INPUT message should name.
 */
export function readJsonObjectBody<T>(body: unknown): T | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return body as T;
}
