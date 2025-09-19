import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  autoClose?: boolean;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);
  
  getNotifications() {
    return this.notifications.asReadonly();
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  showSuccess(title: string, message?: string, autoClose = true, duration = 5000): string {
    return this.addNotification({
      type: 'success',
      title,
      message,
      autoClose,
      duration
    });
  }

  showError(title: string, message?: string, autoClose = true, duration = 7000): string {
    return this.addNotification({
      type: 'error',
      title,
      message,
      autoClose,
      duration
    });
  }

  showInfo(title: string, message?: string, autoClose = true, duration = 5000): string {
    return this.addNotification({
      type: 'info',
      title,
      message,
      autoClose,
      duration
    });
  }

  showWarning(title: string, message?: string, autoClose = true, duration = 6000): string {
    return this.addNotification({
      type: 'warning',
      title,
      message,
      autoClose,
      duration
    });
  }

  private addNotification(notification: Omit<Notification, 'id'>): string {
    const id = this.generateId();
    const newNotification: Notification = {
      ...notification,
      id
    };

    this.notifications.update(notifications => [...notifications, newNotification]);

    if (notification.autoClose !== false) {
      setTimeout(() => {
        this.removeNotification(id);
      }, notification.duration || 5000);
    }

    return id;
  }

  removeNotification(id: string): void {
    this.notifications.update(notifications => 
      notifications.filter(notification => notification.id !== id)
    );
  }

  clearAll(): void {
    this.notifications.set([]);
  }
}