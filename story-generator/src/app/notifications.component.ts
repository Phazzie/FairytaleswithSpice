import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container" [attr.aria-live]="'polite'" [attr.aria-label]="'Notifications'">
      @for (notification of notificationService.getNotifications()(); track notification.id) {
        <div 
          class="notification notification-{{notification.type}}"
          [attr.role]="'alert'"
          [attr.aria-labelledby]="'title-' + notification.id"
          [attr.aria-describedby]="notification.message ? 'message-' + notification.id : null">
          
          <div class="notification-content">
            <div class="notification-icon">
              @switch (notification.type) {
                @case ('success') { ✅ }
                @case ('error') { ❌ }
                @case ('warning') { ⚠️ }
                @case ('info') { ℹ️ }
              }
            </div>
            
            <div class="notification-text">
              <div class="notification-title" [id]="'title-' + notification.id">
                {{notification.title}}
              </div>
              @if (notification.message) {
                <div class="notification-message" [id]="'message-' + notification.id">
                  {{notification.message}}
                </div>
              }
            </div>
            
            <button 
              class="notification-close"
              (click)="notificationService.removeNotification(notification.id)"
              [attr.aria-label]="'Close notification: ' + notification.title"
              type="button">
              ✕
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1000;
      pointer-events: none;
      max-width: 400px;
    }

    .notification {
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 0.75rem;
      pointer-events: all;
      transform: translateX(100%);
      animation: slideIn 0.3s ease-out forwards;
      border-left: 4px solid #ddd;
    }

    .notification-success {
      border-left-color: #28a745;
    }

    .notification-error {
      border-left-color: #dc3545;
    }

    .notification-warning {
      border-left-color: #ffc107;
    }

    .notification-info {
      border-left-color: #17a2b8;
    }

    .notification-content {
      display: flex;
      align-items: flex-start;
      padding: 1rem;
      gap: 0.75rem;
    }

    .notification-icon {
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .notification-text {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 0.25rem;
      line-height: 1.4;
    }

    .notification-message {
      color: #666;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .notification-close {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .notification-close:hover {
      background: #f0f0f0;
      color: #333;
    }

    .notification-close:focus {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .notifications-container {
        left: 1rem;
        right: 1rem;
        max-width: none;
      }
    }
  `]
})
export class NotificationsComponent {
  protected notificationService = inject(NotificationService);
}