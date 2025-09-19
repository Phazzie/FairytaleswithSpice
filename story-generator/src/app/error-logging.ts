import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// Error log interface
export interface ErrorLog {
  timestamp: Date;
  message: string;
  context: string;
  stack?: string;
  severity: ErrorSeverity;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorLoggingService {
  private errors$ = new BehaviorSubject<ErrorLog[]>([]);
  private errorIdCounter = 0;

  constructor() {}

  /**
   * Log an error with context and severity level
   */
  logError(error: any, context: string, severity: ErrorSeverity = 'error'): void {
    const errorLog: ErrorLog = {
      id: `error_${++this.errorIdCounter}`,
      timestamp: new Date(),
      message: this.extractErrorMessage(error),
      context,
      stack: this.extractErrorStack(error),
      severity
    };

    const currentErrors = this.errors$.value;
    const updatedErrors = [errorLog, ...currentErrors];
    
    // Keep only the latest 100 errors to prevent memory issues
    if (updatedErrors.length > 100) {
      updatedErrors.splice(100);
    }
    
    this.errors$.next(updatedErrors);

    // Also log to console for debugging
    this.logToConsole(errorLog);
  }

  /**
   * Get observable stream of errors
   */
  getErrors(): Observable<ErrorLog[]> {
    return this.errors$.asObservable();
  }

  /**
   * Get current errors array
   */
  getCurrentErrors(): ErrorLog[] {
    return this.errors$.value;
  }

  /**
   * Get latest N errors (default 10)
   */
  getLatestErrors(count: number = 10): ErrorLog[] {
    return this.errors$.value.slice(0, count);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors$.next([]);
  }

  /**
   * Clear specific error by ID
   */
  clearError(errorId: string): void {
    const currentErrors = this.errors$.value;
    const filteredErrors = currentErrors.filter(error => error.id !== errorId);
    this.errors$.next(filteredErrors);
  }

  /**
   * Get errors by severity level
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorLog[] {
    return this.errors$.value.filter(error => error.severity === severity);
  }

  /**
   * Get error count by severity
   */
  getErrorCountBySeverity(severity: ErrorSeverity): number {
    return this.getErrorsBySeverity(severity).length;
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
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
    const consoleMethod = this.getConsoleMethod(errorLog.severity);
    const prefix = `[${errorLog.severity.toUpperCase()}] ${errorLog.context}:`;
    
    if (errorLog.stack) {
      consoleMethod(prefix, errorLog.message, '\nStack:', errorLog.stack);
    } else {
      consoleMethod(prefix, errorLog.message);
    }
  }

  private getConsoleMethod(severity: ErrorSeverity): (...args: any[]) => void {
    switch (severity) {
      case 'info':
        return console.info;
      case 'warning':
        return console.warn;
      case 'error':
      case 'critical':
        return console.error;
      default:
        return console.log;
    }
  }
}
