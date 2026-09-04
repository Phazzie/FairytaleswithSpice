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
 * The direct genesis and continuation routes (`api/story-lab/stories.ts`,
 * `api/story-lab/stories/[storyId]/continue.ts`). Neither gates on auth the
 * way the account routes above do — both call `getCurrentUser`, never
 * `requireUser`, and serve an anonymous caller exactly as they always have.
 * The token is only useful here, never required: without it, a signed-in
 * reader's stored content boundaries fold into the request the same way a
 * signed-out caller's would — silently absent, rather than refused. Before
 * this pattern existed, that was the only outcome possible, no matter what
 * the backend was prepared to verify: the interceptor never sent it a token
 * to check.
 */
const GENERATION_ROUTE_PATTERN = /\/api\/story-lab\/stories(\/|\?|$)/;

/**
 * Attaches the signed-in Clerk session token to the Story Lab calls that can
 * use one. Before this existed, `StoryService`'s cloud methods had no code
 * path that could ever attach `Authorization` — the backend verifier being
 * wired up would not have mattered, because nothing on the frontend would
 * ever send it a token to verify.
 *
 * Fetches the token fresh through `getRequestToken()` for each request
 * rather than reading the cached `sessionToken` signal: Clerk's session
 * listener only updates that signal on sign-in/out/refresh *events*, not on
 * ordinary JWT expiry between them, so a stale cached read would keep
 * attaching an expired bearer to every request until the next event.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!ACCOUNT_AUTH_ROUTE_PATTERN.test(req.url) && !GENERATION_ROUTE_PATTERN.test(req.url)) {
    return next(req);
  }

  const authService = inject(AuthService);
  return from(authService.getRequestToken()).pipe(
    switchMap(token => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req))
  );
};
