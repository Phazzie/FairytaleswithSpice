import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let authServiceSpy: jasmine.SpyObj<Pick<AuthService, 'sessionToken'>>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<Pick<AuthService, 'sessionToken'>>('AuthService', ['sessionToken']);
    authServiceSpy.sessionToken.and.returnValue(null);

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

  it('attaches the session token to account profile requests when signed in', () => {
    authServiceSpy.sessionToken.and.returnValue('signed-in-session-token');

    http.get('/api/story-lab/account/profile').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer signed-in-session-token');
    req.flush({ success: true });
  });

  it('attaches the session token to cloud project requests', () => {
    authServiceSpy.sessionToken.and.returnValue('signed-in-session-token');

    http.get('/api/story-lab/account/projects/project-1').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/projects/project-1');
    expect(req.request.headers.get('Authorization')).toBe('Bearer signed-in-session-token');
    req.flush({ success: true });
  });

  it('does not attach a header when there is no session', () => {
    http.get('/api/story-lab/account/profile').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/profile');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });

  // `auth-config` is the one account resource that has to work with no
  // session at all — this is what would catch a broadened route pattern
  // accidentally starting to require what this resource cannot have yet.
  it('does not attach a header to the auth-config request even when signed in', () => {
    authServiceSpy.sessionToken.and.returnValue('signed-in-session-token');

    http.get('/api/story-lab/account/auth-config').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/auth-config');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });

  it('leaves requests outside the Story Lab account surface untouched', () => {
    authServiceSpy.sessionToken.and.returnValue('signed-in-session-token');

    http.get('/api/story-lab/stories').subscribe();

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ success: true });
  });
});
