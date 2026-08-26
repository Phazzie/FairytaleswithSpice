import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';
import { ErrorLoggingService } from './error-logging';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let errorLogging: ErrorLoggingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GlobalErrorHandler, ErrorLoggingService]
    });

    handler = TestBed.inject(GlobalErrorHandler);
    errorLogging = TestBed.inject(ErrorLoggingService);
  });

  it('logs uncaught errors to the ErrorLoggingService as critical', () => {
    spyOn(errorLogging, 'logCritical');
    const error = new Error('uncaught boom');

    handler.handleError(error);

    expect(errorLogging.logCritical).toHaveBeenCalledWith(error, 'GlobalErrorHandler');
  });

  it('still delegates to the default ErrorHandler so console output does not regress', () => {
    const defaultHandleError = spyOn(ErrorHandler.prototype, 'handleError');
    const error = new Error('uncaught boom');

    handler.handleError(error);

    expect(defaultHandleError).toHaveBeenCalledWith(error);
  });
});
