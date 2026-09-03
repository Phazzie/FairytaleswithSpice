// Created: 2026-09-03 05:15 EDT

import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ApiResponse, HealthCheckPayload } from './contracts';

/**
 * Reads whether Story Lab's cloud account sign-in is actually reachable, and
 * sends the browser to Clerk's hosted Account Portal to sign in/out.
 *
 * There is no Clerk SDK here on purpose - see the PR that added this file for
 * why (`@clerk/clerk-js` hard-bundles Web3 wallet adapters and Stripe.js as
 * dependencies, none of which this app uses). Instead this leans on
 * `clerkAuthPort.ts` already reading a `__session` cookie and
 * `accountRouteHandlers.ts` already answering account routes with CORS
 * `credentials: true`.
 *
 * IMPORTANT, unverified against a live Clerk instance (no live credentials in
 * this environment - see `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`):
 * a plain redirect to the hosted portal only results in a cookie this app's
 * own origin can read when `CLERK_ACCOUNT_PORTAL_URL` is configured as a
 * subdomain of this app's own registrable domain (Clerk's documented "Account
 * Portal on your own domain" setup) - the portal's `Set-Cookie` then carries a
 * parent-domain `Domain=` attribute both origins share. Clerk's default
 * `*.accounts.dev` sandbox domain, or any portal domain unrelated to this
 * app's, does **not** share cookies this way; that case needs Clerk's
 * handshake protocol (`authenticateRequest`/the JS SDK), which this file does
 * not implement.
 *
 * `initialize()` is a no-op everywhere except a real browser tab - during SSR
 * there is no cookie-bearing browser to redirect and no reason to fetch
 * `/api/health` for a config only a click handler needs.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private initializePromise: Promise<void> | null = null;

  readonly isConfigured = signal(false);
  private accountPortalUrl: string | null = null;

  /**
   * Fetches the account-auth config once and caches it. Safe to call
   * repeatedly (from a constructor and again from a click handler, say) -
   * every caller after the first awaits the same in-flight fetch.
   */
  initialize(): Promise<void> {
    if (!this.isBrowser) {
      return Promise.resolve();
    }
    if (!this.initializePromise) {
      this.initializePromise = this.loadAuthConfig();
    }
    return this.initializePromise;
  }

  private async loadAuthConfig(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<HealthCheckPayload> | HealthCheckPayload>('/api/health')
      );
      const payload = 'success' in response ? response.data : response;
      const auth = payload?.auth;

      if (auth?.provider === 'clerk' && auth.accountPortalUrl) {
        this.accountPortalUrl = auth.accountPortalUrl;
        this.isConfigured.set(true);
      }
    } catch {
      // A transient failure (cold start, dropped connection) should not wedge
      // every later "Connect account" click behind the one bad attempt -
      // clear the cache so the next `initialize()` call retries instead of
      // replaying this same failed result forever. Deliberately not clearing
      // it on *success* (undefined vs. cleared is the caching signal): a
      // resolved, unconfigured result is still a cached, honest answer.
      this.initializePromise = null;
    }
  }

  /** Redirects the browser to Clerk's hosted sign-in page. No-op if unconfigured. */
  async signIn(): Promise<void> {
    await this.initialize();
    if (!this.isBrowser || !this.accountPortalUrl) {
      return;
    }
    this.navigateTo(this.buildPortalUrl('sign-in'));
  }

  /** Redirects the browser to Clerk's hosted sign-out page. No-op if unconfigured. */
  async signOut(): Promise<void> {
    await this.initialize();
    if (!this.isBrowser || !this.accountPortalUrl) {
      return;
    }
    this.navigateTo(this.buildPortalUrl('sign-out'));
  }

  private buildPortalUrl(path: 'sign-in' | 'sign-out'): string {
    const redirectUrl = encodeURIComponent(window.location.href);
    return `${this.accountPortalUrl}/${path}?redirect_url=${redirectUrl}`;
  }

  /** Isolated so tests can verify the target URL without a real navigation. */
  private navigateTo(url: string): void {
    window.location.href = url;
  }
}
