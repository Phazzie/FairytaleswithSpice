import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let authServiceSpy: jasmine.SpyObj<Pick<AuthService, 'getRequestToken'>>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<Pick<AuthService, 'getRequestToken'>>('AuthService', ['getRequestToken']);
    authServiceSpy.getRequestToken.and.resolveTo(null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches the session token to account profile requests when signed in', fakeAsync(() => {
    authServiceSpy.getRequestToken.and.resolveTo('signed-in-session-token');

    http.get('/api/story-lab/account/profile').subscribe();
    tick();

    const req = httpMock.expectOne('/api/story-lab/account/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer signed-in-session-token');
    req.flush({ success: true });
  }));

  it('attaches the session token to cloud project requests', fakeAsync(() => {
    authServiceSpy.getRequestToken.and.resolveTo('signed-in-session-token');

    http.get('/api/story-lab/account/projects/project-1').subscribe();
    tick();

    const req = httpMock.expectOne('/api/story-lab/account/projects/project-1');
    expect(req.request.headers.get('Authorization')).toBe('Bearer signed-in-session-token');
    req.flush({ success: true });
  }));

  it('does not attach a header when there is no session', fakeAsync(() => {
    http.get('/api/story-lab/account/profile').subscribe();
    tick();

    const req = httpMock.expectOne('/api/story-lab/account/profile');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  }));

  // The interceptor must fetch a fresh token per request rather than reading
  // a cached one — this is what would catch a regression back to a
  // signal-read that never expires a stale bearer.
  it('asks for a fresh token on every protected request rather than caching one', fakeAsync(() => {
    authServiceSpy.getRequestToken.and.resolveTo('token-one');
    http.get('/api/story-lab/account/profile').subscribe();
    tick();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true });

    authServiceSpy.getRequestToken.and.resolveTo('token-two');
    http.get('/api/story-lab/account/profile').subscribe();
    tick();
    const secondReq = httpMock.expectOne('/api/story-lab/account/profile');
    expect(secondReq.request.headers.get('Authorization')).toBe('Bearer token-two');
    secondReq.flush({ success: true });

    expect(authServiceSpy.getRequestToken).toHaveBeenCalledTimes(2);
  }));

  // `auth-config` is the one account resource that has to work with no
  // session at all — this is what would catch a broadened route pattern
  // accidentally starting to require what this resource cannot have yet.
  it('does not attach a header to the auth-config request even when signed in', () => {
    authServiceSpy.getRequestToken.and.resolveTo('signed-in-session-token');

    http.get('/api/story-lab/account/auth-config').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/auth-config');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });

  // Before this, a signed-in reader's stored content boundaries could never
  // reach generation through the real browser client: the backend was ready
  // to fold them in (jobRouteHandlers.ts, and now stories.ts/continue.ts too)
  // but nothing on the frontend ever attached a token for it to read, so
  // `getCurrentUser` always saw an anonymous caller on every one of these
  // requests. `X-Story-Lab-Session`, not `Authorization`: every one of these
  // routes also runs `enforceApiAccessControl`, which reads `Authorization:
  // Bearer` as an `API_KEYS` candidate whenever a deployment configures one —
  // sending the Clerk token there would misread it as an invalid key and
  // break generation outright in that configuration.
  for (const [description, url] of [
    ['the direct genesis request', '/api/story-lab/stories'],
    ['the direct continuation request', '/api/story-lab/stories/story-1/continue'],
    ["the job creation request App.startGenesis()/continueSaga() actually send", '/api/story-lab/jobs']
  ] as const) {
    it(`attaches the session token to ${description} when signed in, on a dedicated header rather than Authorization`, fakeAsync(() => {
      authServiceSpy.getRequestToken.and.resolveTo('signed-in-session-token');

      http.post(url, {}).subscribe();
      tick();

      const req = httpMock.expectOne(url);
      expect(req.request.headers.get('X-Story-Lab-Session')).toBe('signed-in-session-token');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ success: true });
    }));
  }

  // Generation never gates on auth the way the account routes do — a
  // signed-out caller is served exactly as before, with no header at all.
  it('does not attach a header to a generation request with no session', fakeAsync(() => {
    http.post('/api/story-lab/stories', {}).subscribe();
    tick();

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.headers.has('X-Story-Lab-Session')).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  }));

  it('leaves requests outside the Story Lab account and generation surface untouched', () => {
    authServiceSpy.getRequestToken.and.resolveTo('signed-in-session-token');

    http.post('/api/audio/generate', {}).subscribe();

    const req = httpMock.expectOne('/api/audio/generate');
    expect(req.request.headers.has('X-Story-Lab-Session')).toBeFalse();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });
});
