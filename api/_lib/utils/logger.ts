/**
 * Advanced Logging Utility for Fairytales with Spice
 * 
 * Provides structured logging with context, severity levels, and production-ready features
 * - Timestamp tracking
 * - Request correlation IDs
 * - Stack trace preservation
 * - API error details capture
 * - User-friendly vs developer error separation
 * - Performance metrics
 * - Environment-aware logging (verbose in dev, minimal in prod)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  userInput?: any;
  promptTokens?: number;
  completionTokens?: number;
  responseTime?: number;
  statusCode?: number;
  ipAddress?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
    apiResponse?: any;
  };
  metadata?: Record<string, any>;
}

class Logger {
  private static instance: Logger;
  private isDevelopment: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    this.isDevelopment = process.env['NODE_ENV'] !== 'production';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Generate a unique request ID for correlation
   */
  public generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log debug information (only in development)
   */
  public debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    if (this.isDevelopment) {
      this.log('debug', message, context, undefined, metadata);
    }
  }

  /**
   * Log informational messages
   */
  public info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('info', message, context, undefined, metadata);
  }

  /**
   * Log warning messages
   */
  public warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('warn', message, context, undefined, metadata);
  }

  /**
   * Log error messages
   */
  public error(message: string, error?: any, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('error', message, context, error, metadata);
  }

  /**
   * Log critical errors (system failures, data corruption, security issues)
   */
  public critical(message: string, error?: any, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('critical', message, context, error, metadata);
  }

  /**
   * Log API errors with full context
   */
  public apiError(
    apiName: string,
    error: any,
    context?: LogContext,
    requestData?: any
  ): void {
    const errorDetails = this.extractApiError(error);
    
    this.log(
      'error',
      `${apiName} API Error: ${errorDetails.message}`,
      context,
      error,
      {
        apiName,
        requestData: this.sanitizeRequestData(requestData),
        statusCode: errorDetails.statusCode,
        apiResponse: errorDetails.apiResponse,
        errorCode: errorDetails.code
      }
    );
  }

  /**
   * Log performance metrics
   */
  public performance(
    operation: string,
    durationMs: number,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.info(
      `Performance: ${operation} completed in ${durationMs}ms`,
      { ...context, responseTime: durationMs },
      metadata
    );
  }

  /**
   * Log user actions for analytics
   */
  public userAction(
    action: string,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.info(
      `User Action: ${action}`,
      context,
      { ...metadata, category: 'user-action' }
    );
  }

  /**
   * Get recent log entries (for debugging)
   */
  public getRecentLogs(count: number = 50, level?: LogLevel): LogEntry[] {
    let logs = this.logBuffer.slice(-count);
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    return logs;
  }

  /**
   * Clear log buffer
   */
  public clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: any,
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata
    };

    // Extract error details if present
    if (error) {
      logEntry.error = this.extractErrorDetails(error);
    }

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Console output with formatting
    this.outputToConsole(logEntry);

    // In production, you could send to external logging service here
    // e.g., Sentry, Datadog, CloudWatch, etc.
    if (!this.isDevelopment && level === 'critical') {
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * Extract detailed error information
   */
  private extractErrorDetails(error: any): LogEntry['error'] {
    const details: LogEntry['error'] = {
      name: error?.name || 'Error',
      message: error?.message || String(error)
    };

    // Stack trace
    if (error?.stack) {
      details.stack = error.stack;
    }

    // Error code
    if (error?.code) {
      details.code = error.code;
    }

    // HTTP status code
    if (error?.response?.status) {
      details.statusCode = error.response.status;
    } else if (error?.status) {
      details.statusCode = error.status;
    }

    // API response data
    if (error?.response?.data) {
      details.apiResponse = error.response.data;
    }

    return details;
  }

  /**
   * Extract API error details
   */
  private extractApiError(error: any): {
    message: string;
    statusCode?: number;
    code?: string;
    apiResponse?: any;
  } {
    const result: any = {
      message: 'Unknown API error'
    };

    // Axios error format
    if (error?.response) {
      result.statusCode = error.response.status;
      result.apiResponse = error.response.data;
      
      if (error.response.data?.message) {
        result.message = error.response.data.message;
      } else if (error.response.data?.error) {
        result.message = error.response.data.error;
      } else if (error.response.statusText) {
        result.message = error.response.statusText;
      }
    } else if (error?.message) {
      result.message = error.message;
    }

    if (error?.code) {
      result.code = error.code;
    }

    return result;
  }

  /**
   * Sanitize request data to remove sensitive information
   */
  private sanitizeRequestData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };
    
    // Remove API keys
    const sensitiveKeys = ['apiKey', 'api_key', 'password', 'token', 'secret', 'authorization'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Format and output to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(8);
    const emoji = this.getLevelEmoji(entry.level);
    
    // Base message
    const baseMessage = `${emoji} [${timestamp}] ${level} ${entry.message}`;

    // Select console method
    const consoleMethod = this.getConsoleMethod(entry.level);

    // Log base message
    consoleMethod(baseMessage);

    // Log context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      consoleMethod('📋 Context:', JSON.stringify(entry.context, null, 2));
    }

    // Log metadata if present and in development
    if (this.isDevelopment && entry.metadata && Object.keys(entry.metadata).length > 0) {
      consoleMethod('🔍 Metadata:', JSON.stringify(entry.metadata, null, 2));
    }

    // Log error details if present
    if (entry.error) {
      consoleMethod('❌ Error Details:');
      consoleMethod(`   Name: ${entry.error.name}`);
      consoleMethod(`   Message: ${entry.error.message}`);
      
      if (entry.error.statusCode) {
        consoleMethod(`   Status Code: ${entry.error.statusCode}`);
      }
      
      if (entry.error.code) {
        consoleMethod(`   Error Code: ${entry.error.code}`);
      }
      
      if (entry.error.apiResponse) {
        consoleMethod(`   API Response: ${JSON.stringify(entry.error.apiResponse, null, 2)}`);
      }
      
      if (entry.error.stack && this.isDevelopment) {
        consoleMethod(`   Stack Trace:\n${entry.error.stack}`);
      }
    }

    // Add separator for critical errors
    if (entry.level === 'critical') {
      consoleMethod('═'.repeat(80));
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: '🔧',
      info: 'ℹ️ ',
      warn: '⚠️ ',
      error: '❌',
      critical: '🚨'
    };
    return emojis[level] || 'ℹ️';
  }

  /**
   * Get appropriate console method
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case 'debug':
      case 'info':
        return console.log;
      case 'warn':
        return console.warn;
      case 'error':
      case 'critical':
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * Send critical errors to external logging service
   * (Placeholder - implement with Sentry, Datadog, etc.)
   */
  private sendToExternalLogger(entry: LogEntry): void {
    // TODO: Implement external logging service integration
    // Example services:
    // - Sentry
    // - Datadog
    // - CloudWatch
    // - LogRocket
    // - Rollbar
    
    // For now, just ensure it's logged to console
    console.error('🚨 CRITICAL ERROR - External logging placeholder:', entry);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.debug(message, context, metadata);

export const logInfo = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.info(message, context, metadata);

export const logWarn = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.warn(message, context, metadata);

export const logError = (message: string, error?: any, context?: LogContext, metadata?: Record<string, any>) => 
  logger.error(message, error, context, metadata);

export const logCritical = (message: string, error?: any, context?: LogContext, metadata?: Record<string, any>) => 
  logger.critical(message, error, context, metadata);

export const logApiError = (apiName: string, error: any, context?: LogContext, requestData?: any) => 
  logger.apiError(apiName, error, context, requestData);

export const logPerformance = (operation: string, durationMs: number, context?: LogContext, metadata?: Record<string, any>) => 
  logger.performance(operation, durationMs, context, metadata);

export const logUserAction = (action: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.userAction(action, context, metadata);

export const generateRequestId = () => logger.generateRequestId();
