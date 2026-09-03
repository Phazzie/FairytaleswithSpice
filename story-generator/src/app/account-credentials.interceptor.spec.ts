import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { accountCredentialsInterceptor } from './account-credentials.interceptor';

describe('accountCredentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accountCredentialsInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches withCredentials to account routes', () => {
    http.get('/api/story-lab/account/profile').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/profile');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('attaches withCredentials to account project routes', () => {
    http.get('/api/story-lab/account/projects').subscribe();

    const req = httpMock.expectOne('/api/story-lab/account/projects');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('leaves non-account requests untouched', () => {
    http.get('/api/story-lab/stories').subscribe();

    const req = httpMock.expectOne('/api/story-lab/stories');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  it('leaves unrelated requests that merely start with a similar prefix untouched', () => {
    http.get('/api/story-lab/accountability').subscribe();

    const req = httpMock.expectOne('/api/story-lab/accountability');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });
});
