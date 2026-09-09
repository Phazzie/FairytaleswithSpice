// Created: 2025-10-31 06:28 UTC

import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  autoHide: boolean;
  duration: number;
  timestamp: Date;
}

export type NotificationOptions = Partial<Pick<Notification, 'autoHide' | 'duration'>>;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // Auto-hiding toasts (success/info/routine warnings) churn constantly, so only the
  // most recent few are worth keeping on screen at once.
  private static readonly MAX_AUTO_HIDE_NOTIFICATIONS = 5;
  // Persistent (autoHide: false) notifications stay until the user dismisses them —
  // this only bounds unbounded growth if a user never dismisses any of them.
  private static readonly MAX_PERSISTENT_NOTIFICATIONS = 20;

  private readonly notificationsSignal = signal<Notification[]>([]);
  private idSequence = 0;

  readonly notifications = this.notificationsSignal.asReadonly();

  addNotification(
    type: NotificationType,
    title: string,
    message: string,
    options: NotificationOptions = {}
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      type,
      title,
      message,
      autoHide: options.autoHide ?? true,
      duration: options.duration ?? 5000,
      timestamp: new Date()
    };

    this.notificationsSignal.update(current => this.withNotificationAdded(current, notification));

    if (notification.autoHide) {
      setTimeout(() => this.removeNotification(notification.id), notification.duration);
    }

    return notification.id;
  }

  /**
   * Caps auto-hiding and persistent notifications independently, so a burst of routine
   * toasts (autoHide: true) can never silently evict a persistent error/warning banner
   * the user hasn't dismissed yet, and vice versa. Newest-first order is preserved.
   */
  private withNotificationAdded(current: Notification[], notification: Notification): Notification[] {
    const combined = [notification, ...current];
    let autoHideKept = 0;
    let persistentKept = 0;
    const kept: Notification[] = [];

    for (const candidate of combined) {
      if (candidate.autoHide) {
        if (autoHideKept >= NotificationService.MAX_AUTO_HIDE_NOTIFICATIONS) continue;
        autoHideKept++;
      } else {
        if (persistentKept >= NotificationService.MAX_PERSISTENT_NOTIFICATIONS) continue;
        persistentKept++;
      }
      kept.push(candidate);
    }

    return kept;
  }

  removeNotification(id: string): void {
    this.notificationsSignal.update(current => current.filter(notification => notification.id !== id));
  }

  clearAll(): void {
    this.notificationsSignal.set([]);
  }

  success(title: string, message: string, options?: NotificationOptions): string {
    return this.addNotification('success', title, message, options);
  }

  error(title: string, message: string, options?: NotificationOptions): string {
    return this.addNotification('error', title, message, { autoHide: false, ...options });
  }

  warning(title: string, message: string, options?: NotificationOptions): string {
    return this.addNotification('warning', title, message, options);
  }

  info(title: string, message: string, options?: NotificationOptions): string {
    return this.addNotification('info', title, message, options);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${this.idSequence++}`;
  }
}
