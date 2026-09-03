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

  readonly isConfigured = computed(() => this.authConfigState()?.provider === 'clerk');
  readonly sessionToken = computed(() => this.sessionTokenState());
  readonly isSignedIn = computed(() => this.sessionTokenState() !== null);
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
      this.client.addListener(() => {
        void this.refreshSessionToken();
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

  private async refreshSessionToken(): Promise<string | null> {
    try {
      const token = (await this.client?.session?.getToken()) ?? null;
      this.sessionTokenState.set(token);
      return token;
    } catch (error) {
      this.errorLogging.logError(error, 'AuthService.refreshSessionToken');
      this.sessionTokenState.set(null);
      return null;
    }
  }
}
