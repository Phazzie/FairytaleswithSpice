import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { App } from './app';
import { StoryService } from './story.service';
import { ErrorLoggingService } from './error-logging';
import { AuthService } from './auth.service';
import { ApiResponse, CloudStoryProjectList } from './contracts';

/**
 * `app.spec.ts` mocks `AuthService` as always-unconfigured (matching every
 * deployment today), which is what its "honest account setup action" spec
 * relies on. The configured-Clerk path needs a different double, so it lives
 * here rather than adding a second `AuthService` provider mid-suite.
 */
describe('App cloud account sign-in (Clerk configured)', () => {
  let fixture: ComponentFixture<App>;
  let component: App;
  let storyService: jasmine.SpyObj<StoryService>;
  let authService: jasmine.SpyObj<AuthService>;

  function emptyCloudProjectList(): CloudStoryProjectList {
    return {
      ownerUserId: 'user_test',
      storageMode: 'cloud_postgres',
      projects: [],
      totalProjectCount: 0
    };
  }

  /**
   * `StoryService.handleHttpError` rethrows every non-2xx response
   * (`catchError(error => this.handleHttpError(...))` ends in `throwError`),
   * and `accountRouteHandlers.ts`'s `sendJson` always answers with the real
   * status code - so a `success: false` body only ever arrives through
   * Angular's `error` callback with a real `HttpErrorResponse`, never
   * through `next`. Building these as `throwError(() => new
   * HttpErrorResponse(...))` instead of `of({ success: false, ... })`
   * reproduces that real path; the earlier version of this file didn't, and
   * silently exercised a branch of `App.refreshCloudLibrary` real traffic
   * never reaches.
   */
  function unauthorizedListResponse(): Observable<ApiResponse<CloudStoryProjectList>> {
    return throwError(() => new HttpErrorResponse({
      status: 401,
      error: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account authentication is required.', retryable: false }
      }
    }));
  }

  function storageOutageListResponse(): Observable<ApiResponse<CloudStoryProjectList>> {
    return throwError(() => new HttpErrorResponse({
      status: 503,
      error: {
        success: false,
        error: { code: 'STORAGE_UNAVAILABLE', message: 'Cloud project storage is temporarily unavailable.', retryable: true }
      }
    }));
  }

  /**
   * What an upstream gateway/proxy failure (a 502) - or any other request
   * that never reached `accountRouteHandlers.ts`'s own handler - looks like:
   * a non-2xx status with no JSON body carrying this route's envelope shape.
   * A real account-route answer, success or failure, always carries one.
   */
  function gatewayFailureListResponse(): Observable<ApiResponse<CloudStoryProjectList>> {
    return throwError(() => new HttpErrorResponse({
      status: 502,
      error: 'Bad Gateway'
    }));
  }

  /**
   * `handleStoryLabAccountRouteWithContext` answers this *before*
   * `requireAccountUser` runs at all (see `accountRouteHandlers.ts`), so
   * unlike every other code this route can answer with, it carries the
   * route's own envelope shape but proves nothing about whether this
   * session is signed in.
   */
  function accountRouteNotFoundListResponse(): Observable<ApiResponse<CloudStoryProjectList>> {
    return throwError(() => new HttpErrorResponse({
      status: 404,
      error: {
        success: false,
        error: { code: 'ACCOUNT_ROUTE_NOT_FOUND', message: 'Story Lab account route was not found.' }
      }
    }));
  }

  /**
   * The constructor kicks off `authService.initialize().then(...)`, which
   * (with an already-resolved spy promise) drains as a microtask before this
   * `it` block's own body starts running - so a spy return value has to be
   * set *before* `TestBed.createComponent`, not after, or the constructor's
   * own `refreshCloudLibrary()` call already saw the old one.
   */
  async function createFixture(listCloudStoryProjectsResult: Observable<ApiResponse<CloudStoryProjectList>>): Promise<void> {
    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'beginStory',
      'continueStory',
      'createStoryLabJob',
      'getStoryLabJobStatus',
      'listCloudStoryProjects',
      'saveCloudStoryProject',
      'loadCloudStoryProject',
      'deleteCloudStoryProject',
      'generateImage',
      'convertChapterToAudio',
      'exportStory'
    ]);
    storyServiceSpy.listCloudStoryProjects.and.returnValue(listCloudStoryProjectsResult);

    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError',
      'getErrors'
    ]);
    errorLoggingSpy.getErrors.and.returnValue(of([]));

    const authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'initialize',
      'isConfigured',
      'signIn',
      'signOut'
    ]);
    authServiceSpy.initialize.and.returnValue(Promise.resolve());
    authServiceSpy.isConfigured.and.returnValue(true);
    authServiceSpy.signIn.and.returnValue(Promise.resolve());
    authServiceSpy.signOut.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    storyService = TestBed.inject(StoryService) as jasmine.SpyObj<StoryService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  }

  afterEach(() => {
    localStorage.removeItem('fairytales_story_lab_projects_v1');
    localStorage.removeItem('fairytales_story_lab_skin_v1');
  });

  it('checks the cloud library on startup once Clerk reports configured', async () => {
    await createFixture(of({ success: true, data: emptyCloudProjectList() }));
    await fixture.whenStable();

    expect(storyService.listCloudStoryProjects).toHaveBeenCalled();
    expect(component.cloudLibrarySyncState().mode).toBe('cloud_synced');
  });

  it('redirects to sign-in instead of showing the "not configured" message', async () => {
    // Clerk is configured, but no session cookie exists yet in this
    // scenario - the browser hasn't been through the hosted sign-in flow -
    // so the startup check 401s, same as any unauthenticated request to an
    // account route.
    await createFixture(unauthorizedListResponse());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.cloudLibrarySyncState().mode).not.toBe('cloud_synced');

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountAction = panel?.querySelector('[data-testid="cloud-account-action"]') as HTMLButtonElement | null;

    accountAction?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.signIn).toHaveBeenCalledTimes(1);
    const fullText = fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
    expect(fullText).not.toContain('Sign-in setup is not configured yet.');
  });

  it('offers sign-out, not just an info toast, once connected', async () => {
    await createFixture(of({ success: true, data: emptyCloudProjectList() }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.cloudLibrarySyncState().mode).toBe('cloud_synced');

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountAction = panel?.querySelector('[data-testid="cloud-account-action"]') as HTMLButtonElement | null;

    expect(accountAction?.textContent?.trim()).toBe('Sign out');

    accountAction?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.signOut).toHaveBeenCalledTimes(1);
  });

  it('still offers sign-out when authenticated but cloud storage is having an outage', async () => {
    // The account route's auth gate accepted the session (this is not an
    // UNAUTHORIZED response) - only the storage layer behind it failed.
    await createFixture(storageOutageListResponse());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.cloudLibrarySyncState().mode).not.toBe('cloud_synced');
    expect(component.cloudAccountAuthenticated()).toBe(true);

    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountAction = panel?.querySelector('[data-testid="cloud-account-action"]') as HTMLButtonElement | null;

    expect(accountAction?.textContent?.trim()).toBe('Sign out');

    accountAction?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(authService.signIn).not.toHaveBeenCalled();
  });

  it('does not treat a gateway failure with no account-route envelope as proof of authentication', async () => {
    // Status alone can't tell a real account-route 5xx apart from a 502 that
    // never reached the handler - only the envelope can. Without a status
    // this bare, unparsed as a body was previously read as "not 401, so
    // authenticated," which would have shown "Sign out" for a browser that
    // was never signed in.
    await createFixture(gatewayFailureListResponse());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.cloudAccountAuthenticated()).toBe(false);
  });

  it('does not treat ACCOUNT_ROUTE_NOT_FOUND as proof of authentication', async () => {
    // This code is real - it's this route's own envelope - but it's
    // answered before the auth gate runs, so it can't prove the gate passed.
    await createFixture(accountRouteNotFoundListResponse());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.cloudAccountAuthenticated()).toBe(false);
  });

  it('retries auth initialization on a second click after a transient startup failure', async () => {
    const storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'beginStory',
      'continueStory',
      'createStoryLabJob',
      'getStoryLabJobStatus',
      'listCloudStoryProjects',
      'saveCloudStoryProject',
      'loadCloudStoryProject',
      'deleteCloudStoryProject',
      'generateImage',
      'convertChapterToAudio',
      'exportStory'
    ]);
    storyServiceSpy.listCloudStoryProjects.and.returnValue(of({ success: true, data: emptyCloudProjectList() }));

    const errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', [
      'logInfo',
      'logError',
      'getErrors'
    ]);
    errorLoggingSpy.getErrors.and.returnValue(of([]));

    // First call (from the constructor) simulates the transient failure
    // AuthService itself already handles (clears its cached promise, stays
    // unconfigured) - this test is about the *click handler* actually
    // calling `initialize()` again rather than only reading a stale
    // `isConfigured()`.
    let initializeCalls = 0;
    const authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'initialize',
      'isConfigured',
      'signIn',
      'signOut'
    ]);
    authServiceSpy.initialize.and.callFake(() => {
      initializeCalls += 1;
      return Promise.resolve();
    });
    (authServiceSpy.isConfigured.and as jasmine.SpyAnd<() => boolean>).callFake(() => initializeCalls >= 2);
    authServiceSpy.signIn.and.returnValue(Promise.resolve());
    authServiceSpy.signOut.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [App, HttpClientTestingModule],
      providers: [
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.isConfigured()).toBe(false);
    const panel = fixture.nativeElement.querySelector('[data-testid="cloud-library-panel"]') as HTMLElement | null;
    const accountAction = panel?.querySelector('[data-testid="cloud-account-action"]') as HTMLButtonElement | null;

    accountAction?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(initializeCalls).toBeGreaterThanOrEqual(2);
    expect(authService.signIn).toHaveBeenCalledTimes(1);
  });
});
