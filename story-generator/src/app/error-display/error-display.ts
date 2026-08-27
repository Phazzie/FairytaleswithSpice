import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ErrorLoggingService } from '../error-logging';
import { ERROR_SEVERITIES, ErrorLog, ErrorSeverity } from '../contracts';

/**
 * The glyph each severity is shown as, declared once for both places that show
 * it — the icon on an error row and the icon beside its count in the header.
 *
 * A total `Record` rather than a `switch` with a `default`: the `switch` this
 * replaces already named all four severities, so its `default` was unreachable
 * and would only ever have been reached by a *fifth* severity — which is the
 * one case where falling back to a neutral `📝` is the wrong answer, because
 * nothing else in this component would have counted it either. TypeScript
 * refuses a `Record` that is short a key, so a fifth severity stops the build
 * here instead.
 */
const ERROR_SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  critical: '🔴',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

/** One severity's row in the debug panel's count header. */
export interface ErrorSeverityCount {
  severity: ErrorSeverity;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-error-display',
  imports: [CommonModule],
  templateUrl: './error-display.html',
  styleUrl: './error-display.css'
})
export class ErrorDisplayComponent implements OnInit, OnDestroy {
  errors: ErrorLog[] = [];
  severityCounts: ErrorSeverityCount[] = [];
  private subscription: Subscription = new Subscription();
  isExpanded = false;

  constructor(private errorLogging: ErrorLoggingService) {}

  ngOnInit() {
    // Subscribe to error updates
    this.subscription.add(
      this.errorLogging.getErrors().subscribe(errors => {
        this.errors = errors.slice(0, 10); // Keep only latest 10 errors
        this.severityCounts = this.readSeverityCounts();
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
    return ERROR_SEVERITY_ICONS[severity];
  }

  getSeverityClass(severity: ErrorSeverity): string {
    return `severity-${severity}`;
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  /**
   * The counts the header shows, one row per severity, built from the table.
   *
   * The template used to write the four rows out by hand and call
   * `getErrorCounts()` twice per row — eight calls to a method that walked the
   * whole error buffer four times each, on every change-detection pass — then
   * read one hand-picked key off each result. It now renders whatever this
   * returns, so a severity added to `ERROR_SEVERITIES` appears in the header
   * without the template being touched, and the buffer is walked when the
   * errors change rather than when Angular happens to look.
   */
  private readSeverityCounts(): ErrorSeverityCount[] {
    return ERROR_SEVERITIES.map(severity => ({
      severity,
      icon: ERROR_SEVERITY_ICONS[severity],
      count: this.errorLogging.getErrorCount(severity)
    }));
  }

  trackBySeverity(_index: number, entry: ErrorSeverityCount): ErrorSeverity {
    return entry.severity;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  trackByErrorId(index: number, error: ErrorLog): string {
    return error.id;
  }
}
