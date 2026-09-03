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
 * Attaches the signed-in Clerk session token to the Story Lab account calls
 * that need one. Before this existed, `StoryService`'s cloud methods had no
 * code path that could ever attach `Authorization` — the backend verifier
 * being wired up would not have mattered, because nothing on the frontend
 * would ever send it a token to verify.
 *
 * Fetches the token fresh through `getRequestToken()` for each request
 * rather than reading the cached `sessionToken` signal: Clerk's session
 * listener only updates that signal on sign-in/out/refresh *events*, not on
 * ordinary JWT expiry between them, so a stale cached read would keep
 * attaching an expired bearer to every request until the next event.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!ACCOUNT_AUTH_ROUTE_PATTERN.test(req.url)) {
    return next(req);
  }

  const authService = inject(AuthService);
  return from(authService.getRequestToken()).pipe(
    switchMap(token => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req))
  );
};
