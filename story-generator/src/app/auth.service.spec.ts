import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { ApiResponse } from './contracts';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts unconfigured before initialize resolves', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('stays unconfigured when the provider is "none"', async () => {
    const initializePromise = service.initialize();

    const req = httpMock.expectOne('/api/health');
    req.flush({
      success: true,
      data: { auth: { provider: 'none', accountPortalUrl: null } }
    } satisfies ApiResponse<{ auth: { provider: 'none'; accountPortalUrl: null } }>);

    await initializePromise;

    expect(service.isConfigured()).toBe(false);
  });

  it('stays unconfigured when clerk is selected but no portal URL is set', async () => {
    const initializePromise = service.initialize();

    const req = httpMock.expectOne('/api/health');
    req.flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: null } }
    });

    await initializePromise;

    expect(service.isConfigured()).toBe(false);
  });

  it('becomes configured when clerk and a portal URL are both present', async () => {
    const initializePromise = service.initialize();

    const req = httpMock.expectOne('/api/health');
    req.flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } }
    });

    await initializePromise;

    expect(service.isConfigured()).toBe(true);
  });

  it('accepts a bare (non-ApiResponse) health payload shape too', async () => {
    const initializePromise = service.initialize();

    const req = httpMock.expectOne('/api/health');
    req.flush({ auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } });

    await initializePromise;

    expect(service.isConfigured()).toBe(true);
  });

  it('only fetches /api/health once across repeated initialize calls', async () => {
    const first = service.initialize();
    const second = service.initialize();

    httpMock.expectOne('/api/health').flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } }
    });

    await Promise.all([first, second]);

    // httpMock.expectOne above already asserts exactly one request fired;
    // this confirms both callers actually observed its result.
    expect(service.isConfigured()).toBe(true);
  });

  it('stays unconfigured, without throwing, when the health request fails', async () => {
    const initializePromise = service.initialize();

    httpMock.expectOne('/api/health').flush('boom', { status: 500, statusText: 'Server Error' });

    await initializePromise;

    expect(service.isConfigured()).toBe(false);
  });

  it('retries the health check on the next initialize() call after a transient failure', async () => {
    const first = service.initialize();
    httpMock.expectOne('/api/health').flush('boom', { status: 500, statusText: 'Server Error' });
    await first;
    expect(service.isConfigured()).toBe(false);

    const second = service.initialize();
    httpMock.expectOne('/api/health').flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } }
    });
    await second;

    expect(service.isConfigured()).toBe(true);
  });

  it('signIn redirects to the hosted sign-in URL with a redirect_url back to the current page', async () => {
    const initializePromise = service.initialize();
    httpMock.expectOne('/api/health').flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } }
    });
    await initializePromise;

    const navigateSpy = spyOn(service as unknown as { navigateTo(url: string): void }, 'navigateTo');

    await service.signIn();

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [url] = navigateSpy.calls.mostRecent().args;
    expect(url.startsWith('https://accounts.example.com/sign-in?redirect_url=')).toBeTrue();
    expect(url).toContain(encodeURIComponent(window.location.href));
  });

  it('signOut redirects to the hosted sign-out URL', async () => {
    const initializePromise = service.initialize();
    httpMock.expectOne('/api/health').flush({
      success: true,
      data: { auth: { provider: 'clerk', accountPortalUrl: 'https://accounts.example.com' } }
    });
    await initializePromise;

    const navigateSpy = spyOn(service as unknown as { navigateTo(url: string): void }, 'navigateTo');

    await service.signOut();

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [url] = navigateSpy.calls.mostRecent().args;
    expect(url.startsWith('https://accounts.example.com/sign-out?redirect_url=')).toBeTrue();
  });

  it('signIn is a no-op when unconfigured', async () => {
    const initializePromise = service.initialize();
    httpMock.expectOne('/api/health').flush({
      success: true,
      data: { auth: { provider: 'none', accountPortalUrl: null } }
    });
    await initializePromise;

    const navigateSpy = spyOn(service as unknown as { navigateTo(url: string): void }, 'navigateTo');

    await service.signIn();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
