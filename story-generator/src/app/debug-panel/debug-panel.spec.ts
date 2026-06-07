import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DebugPanel } from './debug-panel';

describe('DebugPanel', () => {
  let component: DebugPanel;
  let fixture: ComponentFixture<DebugPanel>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebugPanel, HttpClientTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DebugPanel);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('checks root API health', () => {
    const timestamp = '2026-06-07T10:00:00.000Z';

    component.checkApiHealth();

    const request = httpMock.expectOne('/api/health');
    expect(request.request.method).toBe('GET');
    request.flush({
      success: true,
      data: {
        status: 'healthy',
        timestamp,
        version: '1.0.0',
        environment: 'test',
        services: {
          grok: 'mock'
        },
        cors: {
          allowedOrigin: 'http://localhost:4200'
        }
      }
    });

    expect(component.health()).toEqual(jasmine.objectContaining({
      state: 'healthy',
      timestamp,
      message: 'grok: mock'
    }));
    expect(component.health().latencyMs).toEqual(jasmine.any(Number));
  });

  it('checks unwrapped local root API health', () => {
    const timestamp = '2026-06-07T10:05:00.000Z';

    component.checkApiHealth();

    const request = httpMock.expectOne('/api/health');
    expect(request.request.method).toBe('GET');
    request.flush({
      status: 'healthy',
      timestamp,
      version: '2.1.0',
      environment: 'test',
      services: {
        grok: 'configured'
      }
    });

    expect(component.health()).toEqual(jasmine.objectContaining({
      state: 'healthy',
      timestamp,
      message: 'grok: configured'
    }));
  });

  it('treats malformed successful health payloads as unhealthy', () => {
    component.checkApiHealth();

    const request = httpMock.expectOne('/api/health');
    request.flush({
      success: true,
      data: {
        status: 'degraded'
      }
    });

    expect(component.health()).toEqual(jasmine.objectContaining({
      state: 'unhealthy',
      message: 'grok: unknown'
    }));
  });
});
