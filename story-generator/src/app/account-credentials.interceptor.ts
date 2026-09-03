// Created: 2026-09-03 05:20 EDT

import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Story Lab's cloud account session lives in Clerk's `__session` cookie
 * (see `AuthService`), not an `Authorization` header - so the one thing an
 * account request needs that the rest of the app's requests don't is
 * `withCredentials`, to actually send that cookie cross-origin.
 *
 * Scoped to `/api/story-lab/account/*` only: every other route on this app
 * is unauthenticated, and sending cookies to routes that never look at them
 * is needless surface for no benefit.
 */
const ACCOUNT_ROUTE_PREFIX = '/api/story-lab/account';

function isAccountRoute(url: string): boolean {
  return url === ACCOUNT_ROUTE_PREFIX || url.startsWith(`${ACCOUNT_ROUTE_PREFIX}/`) || url.startsWith(`${ACCOUNT_ROUTE_PREFIX}?`);
}

export const accountCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isAccountRoute(req.url)) {
    return next(req);
  }

  return next(req.clone({ withCredentials: true }));
};
