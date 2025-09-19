import { TestBed } from '@angular/core/testing';
import { ErrorLoggingService, ErrorLog, ErrorSeverity } from './error-logging';

describe('ErrorLoggingService', () => {
  let service: ErrorLoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorLoggingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log errors with proper structure', () => {
    const testError = new Error('Test error');
    const context = 'Test context';
    
    service.logError(testError, context, 'error');
    
    const errors = service.getCurrentErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('Test error');
    expect(errors[0].context).toBe('Test context');
    expect(errors[0].severity).toBe('error');
    expect(errors[0].timestamp).toBeInstanceOf(Date);
    expect(errors[0].id).toBeDefined();
  });

  it('should clear all errors', () => {
    service.logError('Error 1', 'Context 1');
    service.logError('Error 2', 'Context 2');
    
    expect(service.getCurrentErrors().length).toBe(2);
    
    service.clearErrors();
    
    expect(service.getCurrentErrors().length).toBe(0);
  });

  it('should return latest N errors', () => {
    for (let i = 1; i <= 15; i++) {
      service.logError(`Error ${i}`, `Context ${i}`);
    }
    
    const latest10 = service.getLatestErrors(10);
    expect(latest10.length).toBe(10);
    expect(latest10[0].message).toBe('Error 15'); // Most recent first
    expect(latest10[9].message).toBe('Error 6');
  });

  it('should filter errors by severity', () => {
    service.logError('Info message', 'Context', 'info');
    service.logError('Warning message', 'Context', 'warning');
    service.logError('Error message', 'Context', 'error');
    service.logError('Critical message', 'Context', 'critical');
    
    expect(service.getErrorsBySeverity('info').length).toBe(1);
    expect(service.getErrorsBySeverity('warning').length).toBe(1);
    expect(service.getErrorsBySeverity('error').length).toBe(1);
    expect(service.getErrorsBySeverity('critical').length).toBe(1);
    
    expect(service.getErrorCountBySeverity('error')).toBe(1);
  });

  it('should clear specific errors by ID', () => {
    service.logError('Error 1', 'Context 1');
    service.logError('Error 2', 'Context 2');
    
    const errors = service.getCurrentErrors();
    const errorToRemove = errors[0];
    
    service.clearError(errorToRemove.id);
    
    const remainingErrors = service.getCurrentErrors();
    expect(remainingErrors.length).toBe(1);
    expect(remainingErrors[0].id).not.toBe(errorToRemove.id);
  });

  it('should handle different error types', () => {
    // String error
    service.logError('String error', 'Context');
    
    // Error object
    service.logError(new Error('Error object'), 'Context');
    
    // HTTP-like error
    service.logError({ error: { message: 'HTTP error' }, statusText: 'Bad Request' }, 'Context');
    
    const errors = service.getCurrentErrors();
    expect(errors.length).toBe(3);
    expect(errors[2].message).toBe('String error');
    expect(errors[1].message).toBe('Error object');
    expect(errors[0].message).toBe('HTTP error');
  });
});
