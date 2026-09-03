// Created: 2026-09-02 21:00 EDT

import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { StoryLabAuthConfig } from './contracts';

/**
 * The slice of `@clerk/clerk-js`'s `Clerk` class this service actually calls.
 * Narrow on purpose, the same reason `ClerkAuthPortOptions.verifySessionToken`
 * on the backend is a bare function rather than the whole Clerk backend SDK:
 * a test can inject a fake with this contract without pulling in Clerk's own
 * (large, network-touching) client library.
 */
export interface ClerkClient {
  load(): Promise<void>;
  openSignIn(): void;
  signOut(): Promise<void>;
  addListener(listener: () => void): () => void;
  readonly session: { getToken(): Promise<string | null> } | null | undefined;
}

export type ClerkClientFactory = (publishableKey: string) => Promise<ClerkClient>;

/**
 * Reads the `sub` claim out of a session token's payload, without verifying
 * its signature — this is only ever used client-side to notice *which*
 * account a token belongs to, never to authorize anything; every account
 * request is independently verified server-side by `clerkSessionVerifier.ts`
 * regardless of what this returns. A JWT's middle segment is base64url, not
 * base64 — `-`/`_` swapped in for `+`/`/`, padding stripped — so it is
 * translated before `atob` rather than passed to it directly.
 */
function decodeSessionTokenSubject(token: string): string | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return null;
    }
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    const sub = (payload as { sub?: unknown } | null)?.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

/**
 * `@clerk/clerk-js` is only imported here, dynamically, and only once a
 * publishable key has actually come back from `/account/auth-config` — every
 * deployment that has not configured Clerk (every deployment today) never
 * fetches it, so the inert case this replaces stays exactly as inert as it
 * was: zero added bytes, zero added requests.
 */
async function loadRealClerkClient(publishableKey: string): Promise<ClerkClient> {
  const { Clerk } = await import('@clerk/clerk-js');
  return new Clerk(publishableKey) as unknown as ClerkClient;
}

export const CLERK_CLIENT_FACTORY = new InjectionToken<ClerkClientFactory>('CLERK_CLIENT_FACTORY', {
  providedIn: 'root',
  factory: () => loadRealClerkClient
});

/**
 * Whether this deployment has Clerk configured, and — once it does — the
 * signed-in session token `authInterceptor` attaches to Story Lab account
 * requests.
 *
 * Root-scoped deliberately, unlike `MemoryCardService`: a session is
 * per-browser-tab state that should survive `App` being destroyed and
 * recreated on navigation (e.g. to `/proving-grounds` and back), not
 * per-story state that must reset with it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storyService = inject(StoryService);
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly clientFactory = inject(CLERK_CLIENT_FACTORY);

  private readonly authConfigState = signal<StoryLabAuthConfig | null>(null);
  private readonly sessionTokenState = signal<string | null>(null);
  private client: ClerkClient | null = null;
  private initPromise: Promise<void> | null = null;
  // Bumped by `signOut()` and by every `refreshSessionToken()` call's own
  // start — see that method's own comment for why a request-scoped counter,
  // not a session-scoped one, is what closes this race.
  private sessionRefreshGeneration = 0;
  // The most recently started `refreshSessionToken()` call's own promise, so
  // a superseded-by-an-ordinary-same-identity-refresh call can defer to it —
  // see `refreshSessionToken`'s own comment.
  private latestRefreshPromise: Promise<string | null> | null = null;
  private readonly sessionEpochState = signal(0);
  private readonly identityTransitionPendingState = signal(false);

  readonly isConfigured = computed(() => this.authConfigState()?.provider === 'clerk');
  readonly sessionToken = computed(() => this.sessionTokenState());
  readonly isSignedIn = computed(() => this.sessionTokenState() !== null);
  /**
   * Advances synchronously — before any `await` — on every event that might
   * change which account is signed in: a Clerk session-change listener
   * firing, or an explicit `signOut()`. `isSignedIn`/`accountId` do not
   * update until `refreshSessionToken()`'s `await session.getToken()`
   * resolves, so a caller (`App`'s cloud-library request guards) that only
   * compared those two against a live read had a real window, between the
   * event firing and that `await` resolving, where they still read as the
   * *outgoing* identity — a stale response arriving in exactly that window
   * would pass the comparison. Comparing this instead closes that window:
   * it changes the instant the event is known, not once its consequences
   * are known. Deliberately coarser than `accountId` — it also advances on
   * an ordinary same-account token refresh, not only an actual identity
   * change, trading a rare needlessly-discarded in-flight response for
   * never risking one account's data landing under another.
   */
  readonly sessionEpoch = computed(() => this.sessionEpochState());
  /**
   * True from the instant a Clerk session-change listener fires until its
   * own token refresh settles. `sessionEpoch` alone does not close this
   * window for a *new* request that starts inside it: the epoch has already
   * advanced by the time such a request captures it, so it reads as the
   * current identity rather than a stale one, even though `sessionTokenState`
   * (and the `accountId`/`isSignedIn` derived from it) has not actually
   * caught up yet — the account still displayed is the outgoing one. A save
   * built from that still-outgoing data could have its interceptor attach
   * the *incoming* account's fresh token, persisting the old account's data
   * under the new one with no response-level guard able to undo the write.
   * `App`'s cloud-library methods refuse to start while this is true, rather
   * than only discarding what a request that already started returns.
   */
  readonly identityTransitionPending = computed(() => this.identityTransitionPendingState());
  /**
   * `null` when signed out; otherwise the signed-in account's identity,
   * stable across an ordinary token refresh (a new token string, same `sub`)
   * and changed only by an actual sign-in/out or account switch. `App`'s
   * constructor effect tracks this rather than `isSignedIn` alone: a
   * multi-session Clerk client can replace one signed-in account with
   * another without an intermediate signed-out state, and `isSignedIn`'s
   * boolean value would not change across that swap, so an effect keyed on
   * it alone would never notice account B has replaced account A. `computed`
   * only marks dependents dirty when its own return value changes by `===`,
   * so a refresh that keeps the same `sub` produces the same string here and
   * intentionally does not retrigger anything downstream.
   */
  readonly accountId = computed(() => {
    const token = this.sessionTokenState();
    return token ? decodeSessionTokenSubject(token) : null;
  });

  /**
   * Fetches the deployment's auth config and, only when it names a real
   * provider, loads the Clerk client. Idempotent and safe to call from
   * anywhere that might need cloud auth — every caller after the first gets
   * the same in-flight or settled promise rather than re-fetching.
   */
  initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadConfigAndClient();
    }
    return this.initPromise;
  }

  async signIn(): Promise<void> {
    await this.initialize();
    this.client?.openSignIn();
  }

  /**
   * Ends the Clerk session. Deliberately does not swallow a failed
   * `client.signOut()` call: Clerk's own session state is the source of
   * truth for whether a reader is actually signed out, and clearing the
   * local token regardless would report "signed out" on a shared device
   * even when the underlying session survives and is restored on reload.
   * Callers that want to announce success must wait for this to resolve.
   */
  async signOut(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.signOut();
    // Invalidates any `refreshSessionToken()` call already in flight when
    // sign-out started — without this, that older call's `await
    // session.getToken()` could resolve *after* the line below, with a
    // token fetched before sign-out, and unconditionally overwrite the
    // `null` this line is about to set — resurrecting the session sign-out
    // just ended. Bumping `sessionEpochState` here (rather than a dedicated
    // sign-out-only counter) is what `resolveSupersededRefresh` uses to
    // reject that stale call — see its own comment.
    this.sessionRefreshGeneration++;
    this.sessionEpochState.update(epoch => epoch + 1);
    this.sessionTokenState.set(null);
  }

  /**
   * Fetches a fresh bearer token for one outgoing account request, rather
   * than reading the cached `sessionToken` signal. The listener wired in
   * `loadConfigAndClient` only fires on session *change* events — sign-in,
   * sign-out, an explicit refresh — not on ordinary JWT expiry between them,
   * and `session.getToken()` is what performs Clerk's own silent refresh.
   * Without this, a browser tab left open past the token's lifetime would
   * keep sending an expired bearer to every account request until the next
   * session-change event happened to land.
   */
  async getRequestToken(): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    return this.refreshSessionToken();
  }

  private async loadConfigAndClient(): Promise<void> {
    let config: StoryLabAuthConfig;
    try {
      const response = await firstValueFrom(this.storyService.getStoryLabAuthConfig());
      if (!response.success || !response.data) {
        return;
      }
      config = response.data;
    } catch (error) {
      this.errorLogging.logError(error, 'AuthService.loadConfigAndClient');
      // A transient failure (network blip, backend cold start) must not wedge
      // `initialize()` into permanently returning this same failed, cached
      // promise — clearing it lets the next `initialize()`/`signIn()` call
      // actually retry the auth-config request instead of replaying today's
      // failure forever.
      this.initPromise = null;
      return;
    }

    this.authConfigState.set(config);
    if (config.provider !== 'clerk' || !config.publishableKey) {
      return;
    }

    try {
      this.client = await this.clientFactory(config.publishableKey);
      await this.client.load();
      // Clerk fires this on every session change — sign-in, sign-out, token
      // refresh — so this is the one place `sessionTokenState` needs to be
      // kept current rather than only being set once after `load()`.
      // `sessionEpochState` is bumped here, synchronously, rather than only
      // inside `refreshSessionToken()` once its `await session.getToken()`
      // resolves — see `sessionEpoch`'s own comment for why that gap
      // matters to callers outside this service.
      this.client.addListener(() => {
        this.identityTransitionPendingState.set(true);
        this.sessionEpochState.update(epoch => epoch + 1);
        void this.refreshSessionToken(true);
      });
      await this.refreshSessionToken();
    } catch (error) {
      this.errorLogging.logError(error, 'AuthService.loadConfigAndClient');
      this.client = null;
      // Same reasoning as the auth-config catch above: a Clerk client that
      // failed to load (script blocked, network error) should be retried on
      // the next sign-in attempt, not treated as a permanent unconfigured
      // state indistinguishable from `provider: 'none'`.
      this.initPromise = null;
    }
  }

  /**
   * `requestGeneration` is captured fresh on every call, not read from a
   * single session-scoped flag: two overlapping calls (a session-change
   * listener firing while an interceptor's `getRequestToken()` is already
   * awaiting `getToken()`, say, or a rapid account switch) can resolve out
   * of order, and only the call that started *last* is allowed to write —
   * an earlier one resolving after it must not overwrite a result that is
   * already known to be newer.
   *
   * A superseded call cannot just return `sessionTokenState()` at that
   * point, though: if it was superseded by another *refresh* that has not
   * itself resolved yet, the signal may still hold an even-older value (or
   * the previous account's), and a caller — an interceptor attaching this
   * as a bearer token — would send that wrong credential. Nor can it always
   * defer to that newer refresh's own result: when the two calls are for
   * *different* identities (a session-change listener fired between this
   * call starting and its `getToken()` resolving), substituting the newer
   * account's token here would let this call's caller — which built its
   * request, e.g. a cloud save's payload, before the switch — send that
   * request authenticated as the new account. `requestEpoch` (captured from
   * `sessionEpochState` at the same moment `requestGeneration` is captured)
   * exists to tell the two cases apart: `resolveSupersededRefresh` rejects
   * with `null` whenever the epoch has moved since this call started — sign
   * out and an identity change both bump it, so either invalidates a call
   * that started before them — and only defers to `latestRefreshPromise`
   * when the epoch is unchanged, meaning this call was superseded by an
   * ordinary same-identity refresh whose own settled result is safe to
   * return instead of a stale snapshot.
   */
  /**
   * `clearsIdentityTransitionOnSettle` is only ever passed `true` by the
   * session-change listener's own call — the one that set
   * `identityTransitionPendingState` in the first place. It clears that flag
   * once this call settles, but only if this call's own generation is still
   * the latest by then: a second listener firing before the first settles
   * (a rapid double account switch) starts its own tagged call, and only
   * that later call's settling should clear the flag — the earlier one
   * settling first must leave it pending.
   */
  private async refreshSessionToken(clearsIdentityTransitionOnSettle = false): Promise<string | null> {
    const requestGeneration = ++this.sessionRefreshGeneration;
    const requestEpoch = this.sessionEpochState();
    const refreshPromise = this.fetchAndApplySessionToken(requestGeneration, requestEpoch);
    this.latestRefreshPromise = refreshPromise;
    if (clearsIdentityTransitionOnSettle) {
      void refreshPromise.finally(() => {
        if (requestGeneration === this.sessionRefreshGeneration) {
          this.identityTransitionPendingState.set(false);
        }
      });
    }
    return refreshPromise;
  }

  private async fetchAndApplySessionToken(
    requestGeneration: number,
    requestEpoch: number
  ): Promise<string | null> {
    try {
      const token = (await this.client?.session?.getToken()) ?? null;
      if (requestGeneration !== this.sessionRefreshGeneration) {
        return this.resolveSupersededRefresh(requestEpoch);
      }
      this.sessionTokenState.set(token);
      return token;
    } catch (error) {
      if (requestGeneration !== this.sessionRefreshGeneration) {
        return this.resolveSupersededRefresh(requestEpoch);
      }
      this.errorLogging.logError(error, 'AuthService.refreshSessionToken');
      this.sessionTokenState.set(null);
      return null;
    }
  }

  private resolveSupersededRefresh(requestEpoch: number): Promise<string | null> | string | null {
    if (this.sessionEpochState() !== requestEpoch) {
      return null;
    }
    // `this.latestRefreshPromise` is expected to already point at the
    // refresh that superseded this one: whichever call incremented
    // `sessionRefreshGeneration` past this call's own generation also
    // assigned its own promise to `latestRefreshPromise` synchronously,
    // before this check could run. The live signal is a fallback only, not
    // the expected path.
    return this.latestRefreshPromise ?? this.sessionTokenState();
  }
}
