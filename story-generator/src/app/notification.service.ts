import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  autoHide?: boolean;
  duration?: number; // in milliseconds, default 5000
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = signal<Notification[]>([]);
  private idCounter = 0;

  getNotifications() {
    return this.notifications.asReadonly();
  }

  show(notification: Omit<Notification, 'id'>): void {
    const id = (++this.idCounter).toString();
    const newNotification: Notification = {
      id,
      autoHide: true,
      duration: 5000,
      ...notification
    };

    this.notifications.update(current => [...current, newNotification]);

    // Auto-hide if enabled
    if (newNotification.autoHide) {
      setTimeout(() => {
        this.hide(id);
      }, newNotification.duration);
    }
  }

  showSuccess(message: string, autoHide = true): void {
    this.show({
      type: 'success',
      message,
      autoHide
    });
  }

  showError(message: string, autoHide = true): void {
    this.show({
      type: 'error',
      message,
      autoHide
    });
  }

  showInfo(message: string, autoHide = true): void {
    this.show({
      type: 'info',
      message,
      autoHide
    });
  }

  showWarning(message: string, autoHide = true): void {
    this.show({
      type: 'warning',
      message,
      autoHide
    });
  }

  hide(id: string): void {
    this.notifications.update(current => 
      current.filter(notification => notification.id !== id)
    );
  }

  clear(): void {
    this.notifications.set([]);
  }
}