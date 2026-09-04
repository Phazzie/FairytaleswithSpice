import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ErrorLog, ErrorSeverity, ErrorLoggingSeam } from './contracts';
import {
  REDACTED_SENSITIVE_TEXT,
  redactSensitiveTextTokens
} from '../../../shared/sensitiveTextRedaction';

// Seam-Driven Error Logging Service
// Provides centralized error capture and management following seam contracts

const REDACTED = REDACTED_SENSITIVE_TEXT;
const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /^x-api-key$/i,
  // Carries a Clerk session token on the Story Lab generation/job routes
  // (`auth.interceptor.ts`) — the same credential `authorization` already
  // covers on the account routes, just under a different header name because
  // those routes also read `authorization` as an `API_KEYS` candidate.
  /^x-story-lab-session$/i,
  /api[_-]?key/i,
  /password/i,
  /^token$/i,
  /[_-]token$/i,
  /^token[_-]/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /secret/i,
  /email/i,
  /prompt/i,
  /story[_-]?text/i,
  /raw[_-]?content/i,
  /html[_-]?content/i,
  /user[_-]?input/i,
  /artifact[_-]?url/i,
  /blob[_-]?url/i,
  /export[_-]?url/i
];

@Injectable({
  providedIn: 'root'
})
export class ErrorLoggingService {
  private errors$ = new BehaviorSubject<ErrorLog[]>([]);
  private readonly maxErrors = 100; // Keep only the latest 100 errors
  private errorIdSequence = 0;

  constructor() {}

  // ==================== PUBLIC API ====================
  
  /**
   * Log an error with context and severity
   */
  logError(error: any, context: string, severity: ErrorSeverity = 'error', additionalDetails?: any): ErrorLoggingSeam['output'] {
    try {
      const detailsSource = {
        ...additionalDetails,
        originalError: error
      };
      const sensitiveValues = this.collectSensitiveStrings(detailsSource);
      const errorLog: ErrorLog = {
        id: this.generateErrorId(),
        timestamp: new Date(),
        message: this.redactSensitiveText(this.extractErrorMessage(error), sensitiveValues),
        context,
        severity,
        stack: this.redactOptionalText(this.extractErrorStack(error), sensitiveValues),
        details: this.redactSensitiveLogData(detailsSource, sensitiveValues)
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
      console.error('ErrorLoggingService failed to log error:', this.redactSensitiveLogData(loggingError));
      console.error('Original error that failed to log:', this.redactSensitiveLogData(error));
      
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
    return `error_${Date.now()}_${this.errorIdSequence++}`;
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

  /**
   * `ancestors` holds only the objects on the current recursion path, so a
   * value reachable from two branches is walked twice rather than mislabelled
   * as a cycle — the same reading `redactSensitiveLogData` in
   * `api/_lib/utils/logger.ts` uses, and for the same reason.
   *
   * A set of everything already visited says `[Circular]` for a graph that has
   * no cycle in it, and this service's busiest caller builds exactly such a
   * graph: `StoryService.handleHttpError` logs
   * `{ status, url, payload: error.error, originalError: error }`, where
   * `payload` and `originalError.error` are one object. Walked with a
   * visited-everything set, whichever of the two the key order reached second
   * was replaced by the string `[Circular]`, so the response body the log entry
   * exists to preserve was dropped from the error it belonged to.
   *
   * `collectSensitiveStrings` below shares the failure and makes it a privacy
   * one rather than a legibility one: an object it marked visited under a
   * harmless key was skipped when it reappeared under a sensitive one, so the
   * strings inside it were never collected, and never redacted from the message
   * and stack text they also appear in.
   */
  private redactSensitiveLogData(value: any, sensitiveValues: string[] = [], ancestors = new WeakSet<object>(), keyHint = ''): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (this.isSensitiveKey(keyHint)) {
      return REDACTED;
    }

    if (typeof value === 'string') {
      return this.redactSensitiveText(value, sensitiveValues);
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (ancestors.has(value)) {
      return '[Circular]';
    }
    ancestors.add(value);

    try {
      if (value instanceof Error) {
        const redactedError: Record<string, unknown> = {
          name: value.name,
          message: this.redactSensitiveText(value.message, sensitiveValues)
        };
        if (value.stack) {
          redactedError['stack'] = this.redactSensitiveText(value.stack, sensitiveValues);
        }
        if ('cause' in value && value.cause !== undefined) {
          redactedError['cause'] = this.redactSensitiveLogData(value.cause, sensitiveValues, ancestors, 'cause');
        }
        return redactedError;
      }

      if (Array.isArray(value)) {
        return value.map(item => this.redactSensitiveLogData(item, sensitiveValues, ancestors, keyHint));
      }

      const redacted: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        redacted[key] = this.redactSensitiveLogData(child, sensitiveValues, ancestors, key);
      }
      return redacted;
    } finally {
      ancestors.delete(value);
    }
  }

  private collectSensitiveStrings(value: any, ancestors = new WeakSet<object>(), keyHint = ''): string[] {
    if (value === null || value === undefined) {
      return [];
    }

    if (typeof value === 'string') {
      return this.isSensitiveKey(keyHint) ? [value] : [];
    }

    if (typeof value !== 'object' || value instanceof Date) {
      return [];
    }

    if (ancestors.has(value)) {
      return [];
    }
    ancestors.add(value);

    try {
      return this.collectSensitiveStringsFromObject(value, ancestors, keyHint);
    } finally {
      ancestors.delete(value);
    }
  }

  private collectSensitiveStringsFromObject(value: object, ancestors: WeakSet<object>, keyHint: string): string[] {
    const values: string[] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        values.push(...this.collectSensitiveStrings(item, ancestors, keyHint));
      }
      return values;
    }

    for (const [key, child] of Object.entries(value)) {
      values.push(...this.collectSensitiveStrings(child, ancestors, key));
    }
    return values.filter(item => item.length > 0);
  }

  private redactOptionalText(value: string | undefined, sensitiveValues: string[]): string | undefined {
    return value ? this.redactSensitiveText(value, sensitiveValues) : undefined;
  }

  private redactSensitiveText(value: string, sensitiveValues: string[] = []): string {
    let redacted = redactSensitiveTextTokens(value);

    for (const sensitiveValue of sensitiveValues) {
      redacted = redacted.split(sensitiveValue).join(REDACTED);
    }

    return redacted;
  }

  private isSensitiveKey(key: string): boolean {
    return key.length > 0 && SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
  }

  private logToConsole(errorLog: ErrorLog): void {
    const prefix = `[${errorLog.severity.toUpperCase()}] ${errorLog.context}:`;
    
    const details = (errorLog.details ?? {}) as { originalError?: any } & Record<string, unknown>;

    switch (errorLog.severity) {
      case 'critical':
      case 'error':
        console.error(prefix, errorLog.message);
        console.error('Error details:', details);

        // Enhanced HTTP error logging
        if (details.originalError) {
          const error = details.originalError;
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
