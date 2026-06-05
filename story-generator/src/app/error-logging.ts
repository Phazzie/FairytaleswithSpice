import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ErrorLog, ErrorSeverity, ErrorLoggingSeam } from './contracts';

// Seam-Driven Error Logging Service
// Provides centralized error capture and management following seam contracts

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /^x-api-key$/i,
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
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const API_KEY_PATTERN = /\b(?:xai|sk|api)[-_][-_A-Za-z0-9]{8,}\b/gi;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

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

  private redactSensitiveLogData(value: any, sensitiveValues: string[] = [], seen = new WeakSet<object>(), keyHint = ''): any {
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

    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => this.redactSensitiveLogData(item, sensitiveValues, seen, keyHint));
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      redacted[key] = this.redactSensitiveLogData(child, sensitiveValues, seen, key);
    }
    return redacted;
  }

  private collectSensitiveStrings(value: any, seen = new WeakSet<object>(), keyHint = ''): string[] {
    if (value === null || value === undefined) {
      return [];
    }

    if (typeof value === 'string') {
      return this.isSensitiveKey(keyHint) ? [value] : [];
    }

    if (typeof value !== 'object' || value instanceof Date) {
      return [];
    }

    if (seen.has(value)) {
      return [];
    }
    seen.add(value);

    const values: string[] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        values.push(...this.collectSensitiveStrings(item, seen, keyHint));
      }
      return values;
    }

    for (const [key, child] of Object.entries(value)) {
      values.push(...this.collectSensitiveStrings(child, seen, key));
    }
    return values.filter(item => item.length > 0);
  }

  private redactOptionalText(value: string | undefined, sensitiveValues: string[]): string | undefined {
    return value ? this.redactSensitiveText(value, sensitiveValues) : undefined;
  }

  private redactSensitiveText(value: string, sensitiveValues: string[] = []): string {
    let redacted = value
      .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
      .replace(API_KEY_PATTERN, REDACTED)
      .replace(EMAIL_PATTERN, REDACTED)
      .replace(URL_PATTERN, REDACTED);

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
