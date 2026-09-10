import { InjectionToken, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Single source of truth for whether Proving Grounds and the debug panel are
 * reachable at all. Defaults to `false` (fail closed) for any injector that
 * doesn't explicitly wire this up — `app.config.ts` provides the real
 * `isDevMode` check for the actual running app, so tests that don't override
 * this token render/route exactly as if dev tooling were off.
 */
export const PROVING_GROUNDS_DEV_MODE_CHECK = new InjectionToken<() => boolean>(
  'PROVING_GROUNDS_DEV_MODE_CHECK',
  { providedIn: 'root', factory: () => () => false }
);

/**
 * Both surfaces that reach Proving Grounds/debug tooling trigger real,
 * presumably-billed AI generation (debug panel's sample genesis, Proving
 * Grounds' own generateStory). Before this guard, `/proving-grounds` had no
 * `canActivate` at all — the only thing that looked like a gate was a
 * cosmetic `?debug=1` query param that merely toggled the nav link and the
 * `@defer` block in the main shell, never the route itself.
 *
 * This is a client-side UI/cost-safety gate, not an API authorization
 * boundary: it controls whether a casual visitor reaches the page through
 * the app's own UI, not whether the `/api/story-lab/stories` endpoint it
 * calls accepts a direct request. That endpoint's own authorization is the
 * app's existing, independent `API_KEYS` opt-in mechanism
 * (`authenticateRequest` in `api/_lib/middleware/security.ts`), which
 * applies uniformly to every Story Lab route — not just this one — and is
 * unrelated to and unaffected by this guard either way.
 */
export const provingGroundsDevOnlyGuard: CanActivateFn = () => {
  const isDevModeCheck = inject(PROVING_GROUNDS_DEV_MODE_CHECK);
  if (isDevModeCheck()) {
    return true;
  }
  return inject(Router).createUrlTree(['/']);
};
