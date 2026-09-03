import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, CLERK_CLIENT_FACTORY, ClerkClient } from './auth.service';
import { ErrorLoggingService } from './error-logging';
import { StoryLabAuthConfig } from './contracts';

interface FakeClerkClient extends ClerkClient {
  listeners: Array<() => void>;
  loadCalls: number;
  openSignInCalls: number;
  signOutCalls: number;
  tokenValue: string | null;
  fireSessionChange(token: string | null): void;
}

function createFakeClerkClient(): FakeClerkClient {
  const client: FakeClerkClient = {
    listeners: [],
    loadCalls: 0,
    openSignInCalls: 0,
    signOutCalls: 0,
    tokenValue: 'initial-session-token',
    session: {
      getToken: async () => client.tokenValue
    },
    async load() {
      client.loadCalls += 1;
    },
    openSignIn() {
      client.openSignInCalls += 1;
    },
    async signOut() {
      client.signOutCalls += 1;
    },
    addListener(listener: () => void) {
      client.listeners.push(listener);
      return () => {
        client.listeners = client.listeners.filter(item => item !== listener);
      };
    },
    fireSessionChange(token: string | null) {
      client.tokenValue = token;
      client.listeners.forEach(listener => listener());
    }
  };
  return client;
}

const AUTH_CONFIG_URL = '/api/story-lab/account/auth-config';

describe('AuthService', () => {
  let httpMock: HttpTestingController;
  let clientFactorySpy: jasmine.Spy<(publishableKey: string) => Promise<ClerkClient>>;
  let fakeClient: FakeClerkClient;

  beforeEach(() => {
    fakeClient = createFakeClerkClient();
    clientFactorySpy = jasmine.createSpy('clerkClientFactory').and.callFake(async () => fakeClient);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ErrorLoggingService,
        { provide: CLERK_CLIENT_FACTORY, useValue: clientFactorySpy }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushAuthConfig(config: StoryLabAuthConfig): void {
    const req = httpMock.expectOne(AUTH_CONFIG_URL);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: config });
  }

  it('stays unconfigured and never loads a Clerk client when the deployment reports provider: none', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'none' });
    await initPromise;

    expect(service.isConfigured()).toBeFalse();
    expect(service.isSignedIn()).toBeFalse();
    expect(clientFactorySpy).not.toHaveBeenCalled();
  });

  it('loads the Clerk client with the reported publishable key and picks up the initial session token', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_from_backend' });
    await initPromise;

    expect(clientFactorySpy).toHaveBeenCalledOnceWith('pk_test_from_backend');
    expect(fakeClient.loadCalls).toBe(1);
    expect(service.isConfigured()).toBeTrue();
    expect(service.isSignedIn()).toBeTrue();
    expect(service.sessionToken()).toBe('initial-session-token');
  });

  it('is idempotent: a second initialize() call issues no second request and reuses the same client', async () => {
    const service = TestBed.inject(AuthService);
    const firstInit = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_once' });
    await firstInit;

    await service.initialize();

    expect(clientFactorySpy).toHaveBeenCalledTimes(1);
  });

  it('tracks session changes Clerk reports through its own listener, not just the state at load time', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_listener' });
    await initPromise;

    expect(service.sessionToken()).toBe('initial-session-token');

    fakeClient.fireSessionChange('rotated-session-token');
    await Promise.resolve();
    await Promise.resolve();

    expect(service.sessionToken()).toBe('rotated-session-token');

    fakeClient.fireSessionChange(null);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.isSignedIn()).toBeFalse();
  });

  it('signIn() initializes first, then opens the Clerk sign-in UI', async () => {
    const service = TestBed.inject(AuthService);
    const signInPromise = service.signIn();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_sign_in' });
    await signInPromise;

    expect(fakeClient.openSignInCalls).toBe(1);
  });

  it('signOut() clears the session token even if the client is not yet loaded', async () => {
    const service = TestBed.inject(AuthService);
    await service.signOut();
    expect(service.isSignedIn()).toBeFalse();
  });

  it('signOut() calls the Clerk client and clears the local session token', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_sign_out' });
    await initPromise;
    expect(service.isSignedIn()).toBeTrue();

    await service.signOut();

    expect(fakeClient.signOutCalls).toBe(1);
    expect(service.isSignedIn()).toBeFalse();
  });

  // The publishable key with no secret key case, and vice versa, are proven
  // server-side in `story-lab-account-routes.test.ts` — this only proves the
  // frontend actually honors whatever `provider` the route reports, rather
  // than re-deriving "clerk" from the presence of a key on its own.
  it('does not load a Clerk client when a publishable key is reported without a usable provider', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    const req = httpMock.expectOne(AUTH_CONFIG_URL);
    req.flush({ success: true, data: { provider: 'none', publishableKey: 'pk_test_half_configured' } });
    await initPromise;

    expect(clientFactorySpy).not.toHaveBeenCalled();
    expect(service.isConfigured()).toBeFalse();
  });

  it('stays unconfigured when the auth-config request itself fails', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    const req = httpMock.expectOne(AUTH_CONFIG_URL);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    await expectAsync(initPromise).toBeResolved();
    expect(clientFactorySpy).not.toHaveBeenCalled();
    expect(service.isConfigured()).toBeFalse();
  });

  // A transient auth-config failure (network blip, cold start) must not wedge
  // `initialize()` into replaying that same failed, cached promise forever —
  // this is what would catch a regression back to caching the failure itself.
  it('retries the auth-config request on the next initialize() call after a transient failure', async () => {
    const service = TestBed.inject(AuthService);
    const firstInit = service.initialize();
    httpMock.expectOne(AUTH_CONFIG_URL).flush('boom', { status: 500, statusText: 'Server Error' });
    await firstInit;

    const retryPromise = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_retry' });
    await retryPromise;

    expect(clientFactorySpy).toHaveBeenCalledOnceWith('pk_test_retry');
    expect(service.isConfigured()).toBeTrue();
  });

  // Same reasoning, for the Clerk client itself failing to load (blocked
  // script, network error) rather than the auth-config request.
  it('retries loading the Clerk client on the next signIn() after a transient client-load failure', async () => {
    clientFactorySpy.and.rejectWith(new Error('script blocked'));
    const service = TestBed.inject(AuthService);
    const firstInit = service.initialize();
    httpMock.expectOne(AUTH_CONFIG_URL).flush({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_client_retry' }
    });
    await firstInit;
    // `isConfigured()` reflects what the backend reported, independent of
    // whether the client itself loaded — the failed load instead shows up
    // as no session and `signIn()` never reaching `openSignIn()`.
    expect(service.isSignedIn()).toBeFalse();
    expect(fakeClient.openSignInCalls).toBe(0);

    clientFactorySpy.and.callFake(async () => fakeClient);
    const retrySignIn = service.signIn();
    httpMock.expectOne(AUTH_CONFIG_URL).flush({
      success: true,
      data: { provider: 'clerk', publishableKey: 'pk_test_client_retry' }
    });
    await retrySignIn;

    expect(fakeClient.openSignInCalls).toBe(1);
  });

  it('getRequestToken() returns null when no Clerk client is loaded', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'none' });
    await initPromise;

    expect(await service.getRequestToken()).toBeNull();
  });

  // The interceptor calls this per request specifically because the cached
  // `sessionToken` signal only updates on session *change* events — this
  // proves `getRequestToken()` re-asks Clerk rather than replaying the
  // signal's last value.
  it('getRequestToken() fetches a fresh token from Clerk rather than the cached signal', async () => {
    const service = TestBed.inject(AuthService);
    const initPromise = service.initialize();
    flushAuthConfig({ provider: 'clerk', publishableKey: 'pk_test_fresh_token' });
    await initPromise;
    expect(service.sessionToken()).toBe('initial-session-token');

    fakeClient.tokenValue = 'rotated-without-listener-event';
    expect(await service.getRequestToken()).toBe('rotated-without-listener-event');
    expect(service.sessionToken()).toBe('rotated-without-listener-event');
  });
});
