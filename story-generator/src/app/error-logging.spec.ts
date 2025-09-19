import { TestBed } from '@angular/core/testing';

import { ErrorLoggingService } from './error-logging';

describe('ErrorLoggingService', () => {
  let service: ErrorLoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorLoggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log errors with correct severity', () => {
    const testError = new Error('Test error');
    const result = service.logError(testError, 'Test Context', 'error');
    
    expect(result.logged).toBe(true);
    expect(result.severity).toBe('error');
    expect(service.getErrorCount()).toBe(1);
  });

  it('should clear errors', () => {
    service.logError(new Error('Test'), 'Test', 'error');
    expect(service.getErrorCount()).toBe(1);
    
    service.clearErrors();
    expect(service.getErrorCount()).toBe(0);
  });

  it('should get latest errors', () => {
    for (let i = 0; i < 15; i++) {
      service.logError(new Error(`Error ${i}`), 'Test', 'error');
    }
    
    const latest = service.getLatestErrors(10);
    expect(latest.length).toBe(10);
    expect(latest[0].message).toBe('Error 14'); // Most recent first
  });

  it('should filter errors by severity', () => {
    service.logError(new Error('Critical'), 'Test', 'critical');
    service.logError(new Error('Warning'), 'Test', 'warning');
    service.logError(new Error('Info'), 'Test', 'info');
    
    expect(service.getErrorsBySeverity('critical').length).toBe(1);
    expect(service.getErrorsBySeverity('warning').length).toBe(1);
    expect(service.getErrorsBySeverity('info').length).toBe(1);
  });
});
