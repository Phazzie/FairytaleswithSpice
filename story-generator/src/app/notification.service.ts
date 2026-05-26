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
  private readonly notificationsSignal = signal<Notification[]>([]);

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

    this.notificationsSignal.update(current => [notification, ...current].slice(0, 5));

    if (notification.autoHide) {
      setTimeout(() => this.removeNotification(notification.id), notification.duration);
    }

    return notification.id;
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
    return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
