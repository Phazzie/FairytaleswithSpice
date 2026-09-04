// Created: 2026-09-02 21:00 EDT

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Only the two resources `requireAccountUser` actually gates on the backend
 * (`accountRouteHandlers.ts`) — `profile` and `project`/`projects`.
 * `auth-config` is deliberately excluded: it is the one account resource that
 * must be reachable with no session at all, and it never reads this header.
 */
const ACCOUNT_AUTH_ROUTE_PATTERN = /\/api\/story-lab\/account\/(profile|projects)(\/|\?|$)/;

/**
 * The direct genesis/continuation routes (`api/story-lab/stories.ts`,
 * `api/story-lab/stories/[storyId]/continue.ts`, called by the Proving
 * Grounds/debug-panel UI) and the job routes (`api/story-lab/jobs*`, called
 * by `App.startGenesis()`/`continueSaga()` via `StoryService.createStoryLabJob()`
 * — the app's primary generation flow). None of these gate on auth the way
 * the account routes above do — they call `getCurrentUser`, never
 * `requireUser`, unless a deployment turns on durable job storage, and serve
 * an anonymous caller exactly as they always have either way. The token is
 * only useful here, never required: without it, a signed-in reader's stored
 * content boundaries fold into the request the same way a signed-out
 * caller's would — silently absent, rather than refused. Before this pattern
 * existed, that was the only outcome possible on every one of these routes,
 * no matter what the backend was prepared to verify: the interceptor never
 * sent it a token to check.
 *
 * Every one of these routes also runs `enforceApiAccessControl`
 * (`beginPostRoute`), which is why `attachSessionToken` below sends the
 * dedicated `X-Story-Lab-Session` header here rather than `Authorization`.
 */
const GENERATION_ROUTE_PATTERN = /\/api\/story-lab\/(stories|jobs)(\/|\?|$)/;

/**
 * Whether `url` is a same-document-relative path — the only shape every real
 * caller in this app ever sends (`StoryService.apiUrl` is the hardcoded
 * relative `/api/story-lab`, never an absolute URL). Both route patterns
 * above test only a path substring, with no anchor to the start of the
 * string and no notion of origin — `ACCOUNT_AUTH_ROUTE_PATTERN.test(url)` is
 * `true` for `https://attacker.example/api/story-lab/account/profile` just
 * as much as for `/api/story-lab/account/profile`. Without this guard, a
 * request to *any* absolute URL that happens to contain one of these paths
 * as a substring — from a future bug, a compromised dependency, or injected
 * script reusing this app's `HttpClient` — would have the signed-in reader's
 * session token attached and sent wherever that URL points, and the
 * attacker's own server can freely approve the CORS preflight that makes
 * this fetchable. Rejecting every absolute and protocol-relative URL
 * outright — rather than trying to compare against this app's own origin —
 * needs no browser-only global, so it holds during server-side rendering
 * too, where `window`/`location` do not exist (`authInterceptor` runs there
 * as well: `app.config.server.ts` merges `app.config.ts`'s providers
 * unchanged).
 */
function isRelativeApiPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Attaches the signed-in Clerk session token to the Story Lab calls that can
 * use one. Before this existed, `StoryService`'s cloud methods had no code
 * path that could ever attach a session token — the backend verifier being
 * wired up would not have mattered, because nothing on the frontend would
 * ever send it one to verify.
 *
 * Fetches the token fresh through `getRequestToken()` for each request
 * rather than reading the cached `sessionToken` signal: Clerk's session
 * listener only updates that signal on sign-in/out/refresh *events*, not on
 * ordinary JWT expiry between them, so a stale cached read would keep
 * attaching an expired bearer to every request until the next event.
 *
 * `Authorization: Bearer` carries it on the account routes, matching what
 * `readClerkSessionToken` (`clerkAuthPort.ts`) has always read there. The
 * generation/job routes get a dedicated `X-Story-Lab-Session` header instead:
 * every one of them also runs `enforceApiAccessControl`, which reads
 * `Authorization: Bearer` as an `API_KEYS` candidate whenever a deployment
 * configures one — a Clerk JWT sent that way would be misread as an invalid
 * key and answered `401 INVALID_API_KEY` before ever reaching Clerk
 * verification, breaking every signed-in generation request in a deployment
 * that combines `API_KEYS` with Clerk auth. `readClerkSessionToken` reads
 * this header first, so either channel reaches the same verification.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isEligiblePath = isRelativeApiPath(req.url);
  const isAccountRoute = isEligiblePath && ACCOUNT_AUTH_ROUTE_PATTERN.test(req.url);
  const isGenerationRoute = isEligiblePath && GENERATION_ROUTE_PATTERN.test(req.url);
  if (!isAccountRoute && !isGenerationRoute) {
    return next(req);
  }

  const authService = inject(AuthService);
  return from(authService.getRequestToken()).pipe(
    switchMap(token => next(token
      ? req.clone({ setHeaders: isAccountRoute ? { Authorization: `Bearer ${token}` } : { 'X-Story-Lab-Session': token } })
      : req))
  );
};
