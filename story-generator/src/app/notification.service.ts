import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  autoHide: boolean;
  duration: number; // in milliseconds
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);
  
  // Expose notifications as readonly signal
  readonly notifications$ = this.notifications.asReadonly();

  constructor() {}

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  addNotification(
    type: Notification['type'],
    title: string,
    message: string,
    options: Partial<Pick<Notification, 'autoHide' | 'duration'>> = {}
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      type,
      title,
      message,
      autoHide: options.autoHide !== false, // default to true
      duration: options.duration || 5000, // default 5 seconds
      timestamp: new Date()
    };

    this.notifications.update(current => [...current, notification]);

    if (notification.autoHide) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }

    return notification.id;
  }

  removeNotification(id: string): void {
    this.notifications.update(current => 
      current.filter(notification => notification.id !== id)
    );
  }

  clearAll(): void {
    this.notifications.set([]);
  }

  // Convenience methods
  success(title: string, message: string, options?: Partial<Pick<Notification, 'autoHide' | 'duration'>>): string {
    return this.addNotification('success', title, message, options);
  }

  error(title: string, message: string, options?: Partial<Pick<Notification, 'autoHide' | 'duration'>>): string {
    return this.addNotification('error', title, message, { ...options, autoHide: options?.autoHide !== false });
  }

  warning(title: string, message: string, options?: Partial<Pick<Notification, 'autoHide' | 'duration'>>): string {
    return this.addNotification('warning', title, message, options);
  }

  info(title: string, message: string, options?: Partial<Pick<Notification, 'autoHide' | 'duration'>>): string {
    return this.addNotification('info', title, message, options);
  }
}