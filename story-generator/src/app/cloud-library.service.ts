// Created: 2026-09-05 UTC

import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CloudLibrarySyncState, CloudStoryProjectListItem } from './contracts';
import { StoryService } from './story.service';
import { AuthService } from './auth.service';
import { ErrorLoggingService } from './error-logging';
import { NotificationService } from './notification.service';

/** See `CloudLibraryService.captureRequestIdentity`'s own comment. */
type CloudRequestIdentity = {
  signedIn: boolean;
  accountId: string | null;
  sessionEpoch: number;
};

/**
 * The cloud-library domain split out of the `App` god-component: sign-in/
 * sign-out driven sync, the four list/save/load/delete requests' shared
 * busy lock and in-flight cancellation, and the request-staleness guard
 * that keeps a response authenticated under an account that has since
 * signed out (or switched, in another tab) from repopulating the UI with
 * the wrong account's data.
 *
 * Split out a second time, in fact — this is the same concern `App`'s own
 * "god-component" fix (#324) was supposed to end. Between that fix and this
 * one, `app.ts` grew back past its original size, almost entirely from this
 * exact surface (`***WORST TO BEST*** Story Lab Cloud Account/Auth`, #326,
 * plus its immediate follow-up) landing directly on the component instead
 * of a service — even though `App` already demonstrated the pattern via
 * `MemoryCardService`. This file, plus the line-count regression guard in
 * `tests/story-generator-app-line-budget.test.ts`, is what's meant to keep
 * it from happening a third time: the guard fails CI on the next silent
 * regrowth instead of relying on a future contributor noticing.
 *
 * `saveActiveProjectToCloud`/`loadCloudProject`/`deleteCloudProject`
 * themselves stay on `App`: unlike a plain list refresh, they read and
 * write the active editing session (`workbench`/`blueprint`, via
 * `buildSavedProjectFromSession`/`hydrateCloudProject`/`upsertCloudProject`)
 * — state this service is deliberately unaware of, the same way
 * `MemoryCardService` leaves `App` in charge of that story's other state.
 * They call into this service for the shared guard/lifecycle plumbing
 * (`isRequestBlocked`, `captureRequestIdentity`, `guardStaleResponse`,
 * `guardStaleError`, `trackSubscription`, `reportError`) instead of
 * reimplementing it.
 *
 * Component-scoped rather than root-provided — see `MemoryCardService`'s
 * own doc comment for why a root singleton would leak this state (an
 * in-flight subscription, `wasSignedIn`/`previousAccountId`, the last-synced
 * project list) across navigations away from and back to `App`.
 */
@Injectable()
export class CloudLibraryService {
  private readonly authService = inject(AuthService);
  private readonly storyService = inject(StoryService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly notificationService = inject(NotificationService);

  readonly projects = signal<CloudStoryProjectListItem[]>([]);
  readonly syncState = signal<CloudLibrarySyncState>({
    mode: 'cloud_unavailable',
    message: 'Account sync is not connected yet.'
  });
  readonly isBusy = signal(false);

  readonly canUseCloudLibrary = computed(() => this.syncState().mode === 'cloud_synced');

  private subscription: Subscription | null = null;
  private wasSignedIn = false;
  private previousAccountId: string | null = null;

  /**
   * Whether a new list/save/load/delete request should start right now.
   *
   * `identityTransitionPending()` closes the window between a session-change
   * listener firing and its own token refresh settling, during which
   * `sessionEpoch` has already advanced but `accountId`/token state has not
   * — see that signal's own comment on `AuthService` for why a request that
   * starts in exactly that window is dangerous rather than merely stale.
   */
  isRequestBlocked(): boolean {
    return this.isBusy() || this.authService.identityTransitionPending();
  }

  reportError(
    mode: CloudLibrarySyncState['mode'],
    error: unknown,
    loggerContext: string,
    fallbackMessage: string
  ): void {
    this.errorLogging.logError(error, loggerContext);
    this.syncState.set({
      mode,
      message: this.formatHttpError(error, fallbackMessage)
    });
  }

  /**
   * Sign-in/sign-out/account-switch reaction, called from `App`'s
   * constructor effect with `authService.isSignedIn()`/`accountId()`.
   *
   * `wasSignedIn` (a plain field, not a signal) is what makes this a true→
   * false *transition* check rather than a standing condition: reading
   * `projects`/`syncState` here too would make them tracked dependencies of
   * that effect, so setting either one (including this method's own
   * clearing writes) would immediately re-trigger it.
   *
   * `accountId` is tracked alongside `signedIn` for the case `signedIn`
   * alone misses entirely: a multi-session Clerk client can replace one
   * signed-in account with another without an intermediate signed-out state
   * (an account switch in another tab, say), and `signedIn`'s boolean value
   * would not change across that swap — an effect keyed on it alone would
   * never rerun, so the outgoing account's in-flight request would never be
   * cancelled and its eventual response could populate the incoming
   * account's project list.
   */
  syncWithAuthState(signedIn: boolean, accountId: string | null): void {
    if (signedIn) {
      const accountChanged = this.wasSignedIn && this.previousAccountId !== null && accountId !== null
        && accountId !== this.previousAccountId;
      this.wasSignedIn = true;
      this.previousAccountId = accountId;

      if (accountChanged) {
        this.cancelInFlightRequest();
        this.projects.set([]);
      }
      this.refresh();
      return;
    }

    if (this.wasSignedIn) {
      this.wasSignedIn = false;
      this.previousAccountId = null;
      this.cancelInFlightRequest();
      this.projects.set([]);
      this.syncState.set({
        mode: 'cloud_unavailable',
        message: 'Signed out. Local browser saves are still available.'
      });
    }
  }

  refresh(): void {
    if (this.isRequestBlocked()) {
      return;
    }

    this.isBusy.set(true);
    const requestIdentity = this.captureRequestIdentity();
    const subscription = this.storyService.listCloudStoryProjects().subscribe({
      next: this.guardStaleResponse(requestIdentity, response => {
        if (!response.success || !response.data) {
          this.syncState.set({
            mode: 'sync_failed',
            message: this.formatApiError(response.error, 'Cloud library is unavailable.')
          });
          return;
        }

        this.projects.set(response.data.projects);
        // The listing is capped, so "12 cloud projects loaded" is only the
        // whole story while the reader has twelve. `totalProjectCount` is
        // what they actually have, and saying both is the difference
        // between a library that is short and one that has silently lost a
        // story.
        const loaded = this.describeProjectsLoaded(
          response.data.projects.length,
          response.data.totalProjectCount
        );
        if (response.data.storageMode === 'non_durable_memory') {
          this.syncState.set({
            mode: 'cloud_unavailable',
            message: `Cloud library is using non-durable account storage. ${loaded} loaded for inspection.`
          });
          return;
        }

        this.syncState.set({
          mode: 'cloud_synced',
          lastSyncedAt: new Date().toISOString(),
          message: `${loaded} loaded.`
        });
      }),
      error: this.guardStaleError(requestIdentity, error => {
        this.reportError(
          'cloud_unavailable',
          error,
          'CloudLibraryService.refresh',
          'Cloud library is unavailable until account sync is configured.'
        );
      }),
      complete: () => {
        this.isBusy.set(false);
      }
    });
    this.trackSubscription(subscription);
  }

  /**
   * Held so a sign-out that lands while a list/save/load/delete request is
   * still in flight (see `syncWithAuthState` and `signOut`) can unsubscribe
   * it — cancelling the underlying HTTP request rather than letting a
   * response authenticated under the old session arrive after sign-out and
   * repopulate `projects` with the previous account's data. `isBusy` gates
   * all four requests against each other, so at most one is ever in flight
   * and one field is enough to cancel whichever it is.
   */
  trackSubscription(subscription: Subscription): void {
    this.subscription = subscription.closed ? null : subscription;
  }

  cancelInFlightRequest(): void {
    if (!this.subscription) {
      return;
    }
    this.subscription.unsubscribe();
    this.subscription = null;
    this.isBusy.set(false);
  }

  /**
   * The signed-in identity a cloud-library request was made for, snapshotted
   * at the moment it starts, so its response callbacks can tell — no matter
   * when they run — whether they still belong to the account currently
   * signed in.
   *
   * Cancelling the subscription (`cancelInFlightRequest`) is not sufficient
   * on its own: Angular's constructor `effect()` is scheduled asynchronously,
   * so an external session change (Clerk revoking a session, or a
   * multi-session account switch in another tab) can leave a real window
   * where an already-in-flight response's callback runs *before* the effect
   * gets a chance to cancel it — cancelling afterward stops nothing that
   * already ran. Reading `authService.isSignedIn()`/`accountId()` here is
   * not subject to that same delay: a signal's current value is correct the
   * instant it's read, regardless of when any effect depending on it next
   * runs, so comparing against a live read inside each callback closes the
   * window cancellation alone cannot.
   *
   * `sessionEpoch` closes a narrower, related gap: `isSignedIn`/`accountId`
   * do not themselves update until `AuthService`'s `refreshSessionToken()`
   * finishes awaiting Clerk, so a response arriving in the window between a
   * session-change event firing and that `await` resolving would still
   * compare equal against the *outgoing* identity. `sessionEpoch` advances
   * synchronously the instant such an event is announced — see its own
   * comment on `AuthService` — closing that window too.
   */
  captureRequestIdentity(): CloudRequestIdentity {
    return {
      signedIn: this.authService.isSignedIn(),
      accountId: this.authService.accountId(),
      sessionEpoch: this.authService.sessionEpoch()
    };
  }

  private isStaleResponse(requestIdentity: CloudRequestIdentity): boolean {
    const current = this.captureRequestIdentity();
    return current.signedIn !== requestIdentity.signedIn
      || current.accountId !== requestIdentity.accountId
      || current.sessionEpoch !== requestIdentity.sessionEpoch;
  }

  /**
   * Wraps a `next` handler so the identity check above happens once, at the
   * call site each of `refresh`/`App.saveActiveProjectToCloud`/
   * `App.loadCloudProject`/`App.deleteCloudProject` already needs it, rather
   * than as a repeated three-line guard inlined into each of those
   * callbacks. A stale `next` payload is dropped entirely — it belongs to a
   * request no longer representing the live signed-in state, so applying it
   * would repopulate the UI with the wrong account's data.
   */
  guardStaleResponse<T>(
    requestIdentity: CloudRequestIdentity,
    handler: (value: T) => void
  ): (value: T) => void {
    return value => {
      if (this.isStaleResponse(requestIdentity)) {
        return;
      }
      handler(value);
    };
  }

  /**
   * Wraps an `error` handler the same way, except the busy lock always
   * releases even when the response is stale: `isBusy` is set once, at the
   * start of each request, and only `error`/`complete` ever clear it, so a
   * stale `error` that skipped clearing it — the same way a stale `next`
   * payload is dropped — would leave every cloud control disabled
   * permanently, since no later callback exists to release it. The error's
   * own state-mutating side effects (logging, `syncState`) still only apply
   * when the response isn't stale.
   */
  guardStaleError<T>(
    requestIdentity: CloudRequestIdentity,
    handler: (value: T) => void
  ): (value: T) => void {
    return value => {
      this.isBusy.set(false);
      if (this.isStaleResponse(requestIdentity)) {
        return;
      }
      handler(value);
    };
  }

  /**
   * How many cloud projects this listing carries, and — when the listing is
   * capped — how many the account holds.
   *
   * A total larger than the page is not an error state and does not get its
   * own banner: the reader has more stories than one listing shows, which is
   * ordinary. What it must not do is go unsaid, because a page that reports
   * only its own length reads exactly like a complete library.
   *
   * A total *smaller* than the page cannot happen, and is not asserted
   * against either: the count comes from the same request as the items, so
   * the honest thing for an unexpected pair is to report the items, which is
   * what the reader is looking at.
   *
   * The noun agrees with the last number before it — `totalCount` in the
   * "1 of 61" form, `loadedCount` otherwise — so a single project out of
   * sixty-one reads as "1 of 61 cloud projects" rather than "1 of 61 cloud
   * project".
   */
  private describeProjectsLoaded(loadedCount: number, totalCount: number): string {
    const isCapped = totalCount > loadedCount;
    const noun = `cloud project${(isCapped ? totalCount : loadedCount) === 1 ? '' : 's'}`;

    return isCapped
      ? `${loadedCount} of ${totalCount} ${noun}`
      : `${loadedCount} ${noun}`;
  }

  async showAccountSetupStatus(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    if (this.syncState().mode === 'cloud_synced') {
      this.syncState.update(state => ({
        ...state,
        message: state.message ?? 'Account is connected.'
      }));
      this.notificationService.info('Account connected', 'Cloud sync is available.');
      return;
    }

    // Always attempts sign-in rather than gating on the cached
    // `isConfigured()` read: `signIn()` awaits `initialize()` first, which
    // retries a prior transient auth-config/client-load failure (see
    // `AuthService.loadConfigAndClient`) instead of replaying it — without
    // this, a deployment that IS configured but hit one bad request would
    // show "not configured" forever with no way to retry short of a reload.
    // A genuinely unconfigured deployment, and one whose Clerk client failed
    // to actually load (the script blocked, a network error) even though the
    // deployment reports `provider: 'clerk'`, both still end here with
    // `isConfigured()` false — see that computed's own comment — so
    // `openSignIn()` no-ops and the message below shows either way, just
    // after the round trip resolves instead of synchronously.
    await this.authService.signIn();
    if (!this.authService.isConfigured()) {
      this.syncState.set({
        mode: 'cloud_unavailable',
        message: 'Sign-in setup is not configured yet. Local browser saves are still available.'
      });
      this.notificationService.info('Account setup pending', 'Sign-in setup is not configured yet.');
    }
  }

  /**
   * Ends the signed-in Clerk session. Before this existed there was no code
   * path back out of `cloud_synced` short of clearing cookies by hand — a
   * real gap on a shared device, since the next person to open the app would
   * keep the previous reader's authenticated cloud library.
   */
  async signOut(): Promise<void> {
    if (!this.authService.isSignedIn()) {
      return;
    }

    // Cancelled before the `await` below, not after: `client.signOut()` is a
    // network call, and a save/load/delete/refresh that was in flight when
    // sign-out started could otherwise complete *during* that wait and still
    // run its callback — hydrating or re-adding the previous account's data
    // even though nothing has awaited yet to race against. The user already
    // asked to sign out at this point, so cancelling here is correct even on
    // the (rare) path below where Clerk's own sign-out call then fails.
    this.cancelInFlightRequest();

    // `cancelInFlightRequest()` leaves `isBusy` false (there is nothing in
    // flight left to be busy with), which — before this — reopened every
    // cloud control (including "Sign out" itself, and the template gates
    // all of them on this same flag) for the whole remainder of this
    // `await`. A load or save started in that window could complete before
    // Clerk's sign-out did, hydrating or re-adding the outgoing account's
    // data — the cleanup below only clears `projects`, not whatever a
    // request begun after this point already wrote into `App`'s workbench.
    // Re-locking here, before the `await`, closes that window:
    // `App.saveActiveProjectToCloud`/`App.loadCloudProject`/
    // `App.deleteCloudProject`/`refresh` all bail immediately while this is
    // true, and so does the template.
    this.isBusy.set(true);

    // `AuthService.signOut()` deliberately does not clear its own session
    // state on failure — Clerk's session is the source of truth, and a
    // rejected call means it may still be active. Announcing "signed out"
    // regardless would be unsafe on a shared device, so this only clears
    // local state and reports success once Clerk has actually confirmed it.
    try {
      await this.authService.signOut();
    } catch (error) {
      this.errorLogging.logError(error, 'CloudLibraryService.signOut');
      this.notificationService.error('Sign out failed', 'Could not sign out — the session may still be active.');
      // Sign-out failed, so the account is (as far as this app can tell)
      // still active — unlock cloud controls again rather than leaving them
      // stuck disabled.
      this.isBusy.set(false);
      return;
    }

    // Clearing `projects` here, not just `syncState`, is the actual fix:
    // before this, the account panel moved off `cloud_synced` but the
    // previous account's project titles and metadata stayed rendered in the
    // list underneath it — a real privacy gap on a shared device.
    this.projects.set([]);
    this.syncState.set({
      mode: 'cloud_unavailable',
      message: 'Signed out. Local browser saves are still available.'
    });
    this.isBusy.set(false);
    this.notificationService.info('Signed out', 'Cloud sync is now disconnected on this device.');
  }

  /**
   * Shared with `App.formatApiError`/`formatHttpError` by copy, not
   * reference: those two are used across every other feature in `App`
   * (story generation, continuation, export, image, audio) and pulling them
   * into a shared module is a wider refactor than this one's scope. Both
   * copies are pure functions of their arguments, so keeping them in sync is
   * a compile-time-checkable no-op if either ever needs to change.
   */
  private formatApiError(error: { code?: string; message?: string; details?: unknown } | undefined, fallback: string): string {
    const code = error?.code ?? '';
    const message = error?.message ?? fallback;

    if (code === 'AI_UNAVAILABLE') {
      return message;
    }

    if (code.includes('TIMEOUT') || message.toLowerCase().includes('timeout')) {
      return 'Grok took too long to finish this story. Try a shorter chapter or try again in a minute.';
    }

    return message;
  }

  private formatHttpError(error: any, fallback: string): string {
    return this.formatApiError(error?.error?.error ?? error?.error, fallback);
  }
}

export type { CloudRequestIdentity };
