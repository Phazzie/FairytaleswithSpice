import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ErrorLoggingService, ErrorLog, ErrorSeverity } from '../error-logging';

@Component({
  selector: 'app-error-display',
  imports: [CommonModule],
  templateUrl: './error-display.html',
  styleUrl: './error-display.css'
})
export class ErrorDisplay implements OnInit, OnDestroy {
  errors: ErrorLog[] = [];
  isExpanded: boolean = false;
  private errorSubscription?: Subscription;

  constructor(private errorLoggingService: ErrorLoggingService) {}

  ngOnInit(): void {
    this.errorSubscription = this.errorLoggingService.getErrors().subscribe(errors => {
      this.errors = this.errorLoggingService.getLatestErrors(10);
    });
  }

  ngOnDestroy(): void {
    this.errorSubscription?.unsubscribe();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  clearAllErrors(): void {
    this.errorLoggingService.clearErrors();
  }

  clearError(errorId: string): void {
    this.errorLoggingService.clearError(errorId);
  }

  getSeverityIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🔥';
      default:
        return '📝';
    }
  }

  getSeverityClass(severity: ErrorSeverity): string {
    return `error-${severity}`;
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }

  get errorCounts() {
    return {
      info: this.errorLoggingService.getErrorCountBySeverity('info'),
      warning: this.errorLoggingService.getErrorCountBySeverity('warning'),
      error: this.errorLoggingService.getErrorCountBySeverity('error'),
      critical: this.errorLoggingService.getErrorCountBySeverity('critical')
    };
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get hasImportantErrors(): boolean {
    return this.errorCounts.error > 0 || this.errorCounts.critical > 0;
  }

  trackByErrorId(index: number, error: ErrorLog): string {
    return error.id;
  }
}
