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

  /**
   * One request/response cycle through the interceptor, and what each of its
   * two possible auth headers should look like afterward. `null` means "must
   * be absent" for that header; a string is the exact expected value.
   *
   * Table-driven because every case here is otherwise the same five lines
   * (issue the request, resolve it, read the headers back) repeated with a
   * different URL/sign-in state/expected header — which is exactly the
   * duplication SonarCloud's Quality Gate flagged when each case was its own
   * copy of that shape.
   */
  interface HeaderCase {
    description: string;
    method: 'get' | 'post';
    url: string;
    signedIn: boolean;
    expectedAuthorization: string | null;
    expectedSessionHeader: string | null;
  }

  const HEADER_CASES: readonly HeaderCase[] = [
    {
      description: 'attaches the session token to account profile requests when signed in',
      method: 'get',
      url: '/api/story-lab/account/profile',
      signedIn: true,
      expectedAuthorization: 'Bearer signed-in-session-token',
      expectedSessionHeader: null
    },
    {
      description: 'attaches the session token to cloud project requests',
      method: 'get',
      url: '/api/story-lab/account/projects/project-1',
      signedIn: true,
      expectedAuthorization: 'Bearer signed-in-session-token',
      expectedSessionHeader: null
    },
    {
      description: 'does not attach a header when there is no session',
      method: 'get',
      url: '/api/story-lab/account/profile',
      signedIn: false,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    {
      // `auth-config` is the one account resource that has to work with no
      // session at all — this is what would catch a broadened route pattern
      // accidentally starting to require what this resource cannot have yet.
      description: 'does not attach a header to the auth-config request even when signed in',
      method: 'get',
      url: '/api/story-lab/account/auth-config',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    // Before X-Story-Lab-Session existed, a signed-in reader's stored content
    // boundaries could never reach generation through the real browser
    // client: the backend was ready to fold them in (jobRouteHandlers.ts, and
    // now stories.ts/continue.ts/jobs too) but nothing on the frontend ever
    // attached a token for it to read. `X-Story-Lab-Session`, not
    // `Authorization`: every one of these routes also runs
    // `enforceApiAccessControl`, which reads `Authorization: Bearer` as an
    // `API_KEYS` candidate whenever a deployment configures one — sending the
    // Clerk token there would misread it as an invalid key and break
    // generation outright in that configuration.
    {
      description: 'attaches the session token to the direct genesis request when signed in, on a dedicated header rather than Authorization',
      method: 'post',
      url: '/api/story-lab/stories',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: 'signed-in-session-token'
    },
    {
      description: 'attaches the session token to the direct continuation request when signed in, on a dedicated header rather than Authorization',
      method: 'post',
      url: '/api/story-lab/stories/story-1/continue',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: 'signed-in-session-token'
    },
    {
      description: "attaches the session token to the job creation request App.startGenesis()/continueSaga() actually send, on a dedicated header rather than Authorization",
      method: 'post',
      url: '/api/story-lab/jobs',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: 'signed-in-session-token'
    },
    // Generation never gates on auth the way the account routes do — a
    // signed-out caller is served exactly as before, with no header at all.
    {
      description: 'does not attach a header to a generation request with no session',
      method: 'post',
      url: '/api/story-lab/stories',
      signedIn: false,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    {
      description: 'leaves requests outside the Story Lab account and generation surface untouched',
      method: 'post',
      url: '/api/audio/generate',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    // Both route patterns test only a path substring, unanchored and with no
    // notion of origin — matching just as readily against an absolute URL to
    // any other origin as against this app's own relative path. Without the
    // `isRelativeApiPath` guard, a request built against an attacker-hosted
    // URL that merely contains one of these paths would still get the
    // signed-in reader's session token attached, and an attacker's own
    // server can freely approve the CORS preflight that makes it fetchable.
    {
      description: 'does not attach a header to an absolute cross-origin URL containing an account path',
      method: 'get',
      url: 'https://attacker.example/api/story-lab/account/profile',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    {
      description: 'does not attach a header to an absolute cross-origin URL containing a generation path',
      method: 'post',
      url: 'https://attacker.example/api/story-lab/stories',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: null
    },
    {
      description: 'does not attach a header to a protocol-relative URL containing a generation path',
      method: 'post',
      url: '//attacker.example/api/story-lab/stories',
      signedIn: true,
      expectedAuthorization: null,
      expectedSessionHeader: null
    }
  ];

  for (const testCase of HEADER_CASES) {
    it(testCase.description, fakeAsync(() => {
      authServiceSpy.getRequestToken.and.resolveTo(testCase.signedIn ? 'signed-in-session-token' : null);

      const request = testCase.method === 'post' ? http.post(testCase.url, {}) : http.get(testCase.url);
      request.subscribe();
      tick();

      const req = httpMock.expectOne(testCase.url);
      if (testCase.expectedAuthorization === null) {
        expect(req.request.headers.has('Authorization')).toBeFalse();
      } else {
        expect(req.request.headers.get('Authorization')).toBe(testCase.expectedAuthorization);
      }
      if (testCase.expectedSessionHeader === null) {
        expect(req.request.headers.has('X-Story-Lab-Session')).toBeFalse();
      } else {
        expect(req.request.headers.get('X-Story-Lab-Session')).toBe(testCase.expectedSessionHeader);
      }
      req.flush({ success: true });
    }));
  }

  // The interceptor must fetch a fresh token per request rather than reading
  // a cached one — this is what would catch a regression back to a
  // signal-read that never expires a stale bearer. Kept out of the table
  // above: this is the one case that issues two requests and asserts on call
  // count, not a single request/header snapshot.
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
});
