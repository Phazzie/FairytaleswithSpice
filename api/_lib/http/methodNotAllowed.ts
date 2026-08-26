// Created: 2026-08-26 UTC

/**
 * Answer a request whose method the route does not serve, and say which
 * methods it does.
 *
 * Every `405` in this repository was written the same way — a `METHOD_NOT_
 * ALLOWED` envelope whose `message` names the supported methods in prose
 * ("Only POST requests are supported.", "Profile routes support GET and PUT.")
 * — and none of them sent the `Allow` header. RFC 9110 §15.5.6 does not treat
 * that as optional: "The origin server MUST generate an Allow header field in
 * a 405 response containing a list of the target resource's currently
 * supported methods." It is the one part of the answer a caller can act on
 * without knowing this API's envelope, which is the same reason `Retry-After`
 * was added beside the `429` in `apiAccessControl` — a message that spells the
 * methods out in English is readable by a person reading a log and by nothing
 * else. An HTTP client, an API explorer, a generated SDK, and a cache all look
 * for `Allow`; a proxy is entitled to treat a 405 without one as malformed.
 *
 * `Access-Control-Allow-Methods` is not that header and does not stand in for
 * it. Every route here already emits one through `applyCorsPolicy`, but it is
 * the CORS preflight answer — a browser reads it before it sends the real
 * request, and only for a cross-origin one — so a same-origin fetch, a `curl`,
 * or a server-to-server caller never sees it at all.
 *
 * The methods are passed in rather than taken from the CORS options, because
 * the two lists are not always the same list and `Allow` is about the narrower
 * one. `/api/story-lab/account` declares `GET, PUT, POST, DELETE, OPTIONS` to
 * CORS for the whole route file, while the profile resource behind it serves
 * `GET` and `PUT`, the project collection `GET` and `POST`, and a single
 * project `GET` and `DELETE`. `Allow` names the target *resource*'s methods,
 * so each of those answers its own three.
 */

export interface MethodNotAllowedResponseLike {
  /**
   * Optional so a hand-built response double that models only `status().json()`
   * still works: the header is the improvement, not a new requirement on every
   * caller's response object. `sendApiEnvelope` in `expressApiRoutes` takes the
   * same reading of the same problem.
   */
  setHeader?(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

/**
 * `OPTIONS` is included by every caller here because every one of these routes
 * really does serve it — `applyCorsPolicy` answers the preflight before the
 * method check is reached — and `Allow` is a list of what the resource
 * supports, not of what would have been accepted instead of the method that
 * was sent.
 */
export function formatAllowedMethods(methods: readonly string[]): string {
  const seen = new Set<string>();

  for (const method of methods) {
    const normalized = method.trim().toUpperCase();
    if (normalized) {
      seen.add(normalized);
    }
  }

  return [...seen].join(', ');
}

export function sendMethodNotAllowed(
  res: MethodNotAllowedResponseLike,
  methods: readonly string[],
  message: string
): void {
  res.setHeader?.('Allow', formatAllowedMethods(methods));
  res.status(405).json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message
    }
  });
}
