// Created: 2026-09-10 UTC
//
// Every response this app sends — API JSON envelope or rendered page — set
// nothing but a bare `X-Content-Type-Options: nosniff` on the JSON error
// paths (`expressApiRoutes.ts`'s `sendApiEnvelope`,
// `withUnhandledRouteFailureLogging.ts`'s `sendGenericFailureEnvelope`, each
// with its own hardcoded copy of the same string). No `Content-Security-Policy`,
// `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, or
// `Permissions-Policy` existed anywhere, on either real deployment target.
//
// That mattered specifically here: the app renders AI-generated HTML straight
// into the DOM (`[innerHTML]="getSafeHtml(chapter.htmlContent)"` in
// `app.html`), with Angular's `DomSanitizer` as the only thing standing
// between a sanitizer bypass and script execution. A CSP is the defense in
// depth that was missing behind it, and the page had no clickjacking or
// downgrade protection either.
//
// One shared list, so the two deployment targets (the Express/Docker server
// this README calls the recommended one, and the legacy static+serverless
// Vercel deployment, whose static assets never run this or any other Node
// code) and every API response can't drift the way the two `nosniff` string
// literals already had.

/** One header/value pair to set on every response this app sends. */
export interface SecurityResponseHeader {
  key: string;
  value: string;
}

/**
 * No external script or font CDN is loaded anywhere in this app (see
 * `index.html`/`styles.scss`). `script-src 'self'` covers `auth.service.ts`'s
 * dynamic `import('@clerk/clerk-js')` too — that import is bundled as one of
 * this app's own same-origin chunks, not fetched from a Clerk-owned CDN — but
 * it is a **known, deliberate gap**: `AuthService` only ever performs that
 * import once `/account/auth-config` reports a configured Clerk
 * `publishableKey` (see that file's own comment), and no deployment today —
 * including this repo's own `.do/app.yaml`, which sets no `CLERK_*` env var —
 * configures one. If an operator ever does, the loaded Clerk client will call
 * out to that Clerk application's own Frontend API host (and may open a
 * hidden iframe for cross-subdomain session sync), which a `connect-src`/
 * `frame-src` of `'self'` would then block. Not solved here: that host is
 * derivable from the publishable key at runtime but varies per Clerk
 * application, and adding it would mean computing this policy per-deployment
 * instead of the one static list every response shares today. Flagged so the
 * day Clerk is actually configured, this is the first thing to check rather
 * than a silent, hard-to-diagnose network failure in the sign-in flow.
 *
 * `style-src` needs `'unsafe-inline'`: Angular's emulated view encapsulation
 * injects component `<style>` tags into the document at runtime, and a
 * nonce/hash-based CSP would need per-request nonce plumbing through the
 * Express SSR path that the static-only Vercel deployment has no way to do at
 * all (no per-request code runs there). Narrowing script/object/frame
 * instead is judged the better trade for the same reason `redactBearerTokens`
 * already documents for a different rule: a deliberate, recorded gap beats an
 * heuristic that reaches further than it can be trusted to.
 *
 * `img-src` allows any `https:` origin plus `data:`: real chapter
 * illustrations come back from `ImageService.callGrokImageAI` as opaque xAI
 * URLs this app does not control and cannot pin to one host, and the mock
 * fallback serves `picsum.photos`. `media-src` needs `data:` for the same
 * reason `AudioService` ships every narration as an inline `data:` WAV rather
 * than a stored file.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "media-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export const SECURITY_RESPONSE_HEADERS: readonly SecurityResponseHeader[] = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // The header form of `frame-ancestors 'none'` above, for browsers that
  // predate CSP's framing control or ignore it.
  { key: 'X-Frame-Options', value: 'DENY' },
  // A response is never sniffed into a different content type than it
  // declares — the same reasoning `sendApiEnvelope` already carried for JSON
  // envelopes, now applied uniformly instead of set twice by hand.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Same-origin isolation for `window.opener`/cross-origin `postMessage`
  // reads; nothing this app does depends on being embeddable or embedding.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Full URLs (which can carry a story id or a job id) are not sent to a
  // cross-origin destination; same-origin navigations keep the full path.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Denies the browser-permission APIs this app has no use for, rather than
  // leaving them at the browser's own default (which is "ask the user").
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Both deployments terminate TLS themselves; a plain-HTTP response ignores
  // this header, so setting it unconditionally is harmless in local dev and
  // correct in production.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
];

/**
 * Set every header above on a Vercel/Express-compatible response, in one
 * call. Safe to call more than once per response (each header is simply
 * overwritten with the same value) and safe on a response double that has no
 * `setHeader` at all.
 */
export function applySecurityResponseHeaders(res: any): void {
  for (const header of SECURITY_RESPONSE_HEADERS) {
    res?.setHeader?.(header.key, header.value);
  }
}
