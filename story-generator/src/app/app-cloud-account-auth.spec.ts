import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
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

  function unauthorizedListResponse(): Observable<ApiResponse<CloudStoryProjectList>> {
    return of({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Account authentication is required.', retryable: false }
    });
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
    fixture.detectChanges();

    expect(authService.signOut).toHaveBeenCalledTimes(1);
  });
});
