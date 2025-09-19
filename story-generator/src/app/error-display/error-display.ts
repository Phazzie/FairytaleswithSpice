import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ErrorLoggingService } from '../error-logging';
import { ErrorLog, ErrorSeverity } from '../contracts';

@Component({
  selector: 'app-error-display',
  imports: [CommonModule],
  templateUrl: './error-display.html',
  styleUrl: './error-display.css'
})
export class ErrorDisplayComponent implements OnInit, OnDestroy {
  errors: ErrorLog[] = [];
  private subscription: Subscription = new Subscription();
  isExpanded = false;

  constructor(private errorLogging: ErrorLoggingService) {}

  ngOnInit() {
    // Subscribe to error updates
    this.subscription.add(
      this.errorLogging.getErrors().subscribe(errors => {
        this.errors = errors.slice(0, 10); // Keep only latest 10 errors
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  clearErrors() {
    this.errorLogging.clearErrors();
  }

  getSeverityIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  }

  getSeverityClass(severity: ErrorSeverity): string {
    return `severity-${severity}`;
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  getErrorCounts() {
    return {
      critical: this.errorLogging.getErrorCount('critical'),
      error: this.errorLogging.getErrorCount('error'),
      warning: this.errorLogging.getErrorCount('warning'),
      info: this.errorLogging.getErrorCount('info')
    };
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  trackByErrorId(index: number, error: ErrorLog): string {
    return error.id;
  }
}
