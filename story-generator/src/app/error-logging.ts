import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ErrorLog, ErrorSeverity, ErrorLoggingSeam } from './contracts';

// Seam-Driven Error Logging Service
// Provides centralized error capture and management following seam contracts

@Injectable({
  providedIn: 'root'
})
export class ErrorLoggingService {
  private errors$ = new BehaviorSubject<ErrorLog[]>([]);
  private readonly maxErrors = 100; // Keep only the latest 100 errors

  constructor() {}

  // ==================== PUBLIC API ====================

  /**
   * Log an error with context and severity
   */
  logError(error: any, context: string, severity: ErrorSeverity = 'error', additionalDetails?: any): ErrorLoggingSeam['output'] {
    try {
      const errorLog: ErrorLog = {
        id: this.generateErrorId(),
        timestamp: new Date(),
        message: this.extractErrorMessage(error),
        context,
        severity,
        stack: this.extractErrorStack(error),
        details: {
          originalError: error,
          ...additionalDetails
        }
      };

      // Add to errors array (keep only recent errors)
      const currentErrors = this.errors$.value;
      const updatedErrors = [errorLog, ...currentErrors].slice(0, this.maxErrors);
      this.errors$.next(updatedErrors);

      // Also log to console for debugging
      this.logToConsole(errorLog);

      return {
        errorId: errorLog.id,
        logged: true,
        timestamp: errorLog.timestamp,
        severity: errorLog.severity
      };
    } catch (loggingError) {
      // Fallback logging if the service itself fails
      console.error('ErrorLoggingService failed to log error:', loggingError);
      console.error('Original error that failed to log:', error);

      return {
        errorId: 'failed-' + Date.now(),
        logged: false,
        timestamp: new Date(),
        severity: 'critical'
      };
    }
  }

  /**
   * Get observable stream of all errors
   */
  getErrors(): Observable<ErrorLog[]> {
    return this.errors$.asObservable();
  }

  /**
   * Get latest N errors
   */
  getLatestErrors(count: number = 10): ErrorLog[] {
    return this.errors$.value.slice(0, count);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.errors$.value.filter(error => error.severity === severity);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors$.next([]);
  }

  /**
   * Get error count by severity
   */
  getErrorCount(severity?: ErrorSeverity): number {
    if (!severity) {
      return this.errors$.value.length;
    }
    return this.errors$.value.filter(error => error.severity === severity).length;
  }

  // ==================== CONVENIENCE METHODS ====================

  logInfo(message: string, context: string, details?: any): void {
    this.logError({ message }, context, 'info', details);
  }

  logWarning(message: string, context: string, details?: any): void {
    this.logError({ message }, context, 'warning', details);
  }

  logCritical(error: any, context: string, details?: any): void {
    this.logError(error, context, 'critical', details);
  }

  // ==================== PRIVATE HELPERS ====================

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    // HTTP Error Response handling
    if (error?.status && error?.statusText) {
      const baseMessage = `HTTP ${error.status}: ${error.statusText}`;
      if (error?.error?.message) {
        return `${baseMessage} - ${error.error.message}`;
      }
      if (error?.error && typeof error.error === 'string') {
        return `${baseMessage} - ${error.error}`;
      }
      return baseMessage;
    }

    if (error?.message) {
      return error.message;
    }
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.statusText) {
      return error.statusText;
    }
    return 'Unknown error occurred';
  }

  private extractErrorStack(error: any): string | undefined {
    if (error?.stack) {
      return error.stack;
    }
    if (error?.error?.stack) {
      return error.error.stack;
    }
    return undefined;
  }

  private logToConsole(errorLog: ErrorLog): void {
    const prefix = `[${errorLog.severity.toUpperCase()}] ${errorLog.context}:`;

    switch (errorLog.severity) {
      case 'critical':
      case 'error':
        console.error(prefix, errorLog.message);
        console.error('Error details:', errorLog.details);

        // Enhanced HTTP error logging
        if (errorLog.details?.originalError) {
          const error = errorLog.details.originalError;
          if (error?.status) {
            console.error(`HTTP Status: ${error.status}`);
          }
          if (error?.url) {
            console.error(`Request URL: ${error.url}`);
          }
          if (error?.error) {
            console.error('Response Body:', error.error);
          }
          if (error?.headers) {
            console.error('Response Headers:', error.headers);
          }
        }

        if (errorLog.stack) {
          console.error('Stack trace:', errorLog.stack);
        }
        break;
      case 'warning':
        console.warn(prefix, errorLog.message, errorLog.details);
        break;
      case 'info':
        console.info(prefix, errorLog.message, errorLog.details);
        break;
    }
  }
}
