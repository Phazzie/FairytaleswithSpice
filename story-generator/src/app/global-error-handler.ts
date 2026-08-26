import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorLoggingService } from './error-logging';

/**
 * Angular only calls `handleError` for errors that escape a zone task uncaught —
 * a component or service that already caught an error and passed it to
 * `ErrorLoggingService` manually never reaches this handler, so there is no
 * double-logging path to guard against here.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorLogging = inject(ErrorLoggingService);
  private readonly defaultHandler = new ErrorHandler();

  handleError(error: unknown): void {
    this.errorLogging.logCritical(error, 'GlobalErrorHandler');
    this.defaultHandler.handleError(error);
  }
}
