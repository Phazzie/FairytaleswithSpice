import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      @for (notification of notifications(); track notification.id) {
        <div 
          class="notification"
          [class]="'notification-' + notification.type"
          [attr.role]="'alert'"
          [attr.aria-live]="notification.type === 'error' ? 'assertive' : 'polite'"
          [attr.aria-labelledby]="'notification-title-' + notification.id"
          [attr.aria-describedby]="'notification-message-' + notification.id">
          
          <div class="notification-content">
            <div class="notification-icon">
              @switch (notification.type) {
                @case ('success') {
                  <span aria-hidden="true">✅</span>
                }
                @case ('error') {
                  <span aria-hidden="true">❌</span>
                }
                @case ('warning') {
                  <span aria-hidden="true">⚠️</span>
                }
                @case ('info') {
                  <span aria-hidden="true">ℹ️</span>
                }
              }
            </div>
            
            <div class="notification-text">
              <h4 
                class="notification-title" 
                [id]="'notification-title-' + notification.id">
                {{ notification.title }}
              </h4>
              <p 
                class="notification-message" 
                [id]="'notification-message-' + notification.id">
                {{ notification.message }}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            class="notification-close"
            (click)="dismissNotification(notification.id)"
            [attr.aria-label]="'Close notification: ' + notification.title">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  notifications;

  constructor(private notificationService: NotificationService) {
    this.notifications = this.notificationService.notifications$;
  }

  dismissNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }
}