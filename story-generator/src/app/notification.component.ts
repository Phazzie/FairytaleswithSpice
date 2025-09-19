import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-container" role="region" aria-label="Notifications">
      @for (notification of notificationService.getNotifications()(); track notification.id) {
        <div 
          class="notification notification-{{notification.type}}"
          role="alert"
          [attr.aria-label]="getAriaLabel(notification)"
          (click)="notificationService.hide(notification.id)">
          <div class="notification-icon">
            {{getIcon(notification.type)}}
          </div>
          <div class="notification-content">
            <span class="notification-message">{{notification.message}}</span>
          </div>
          <button 
            class="notification-close"
            (click)="notificationService.hide(notification.id)"
            aria-label="Close notification"
            type="button">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }

    .notification {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-left: 4px solid;
      animation: slideIn 0.3s ease-out;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }

    .notification:hover {
      opacity: 0.9;
    }

    .notification-success {
      border-left-color: #28a745;
      background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    }

    .notification-error {
      border-left-color: #dc3545;
      background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    }

    .notification-warning {
      border-left-color: #ffc107;
      background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
    }

    .notification-info {
      border-left-color: #17a2b8;
      background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    }

    .notification-icon {
      font-size: 1.2rem;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .notification-content {
      flex: 1;
      font-weight: 500;
      color: #333;
    }

    .notification-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
      padding: 0;
      margin-left: 12px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .notification-close:hover {
      background-color: rgba(0, 0, 0, 0.1);
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
      .notification-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `]
})
export class NotificationComponent {
  notificationService = inject(NotificationService);

  getIcon(type: Notification['type']): string {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type];
  }

  getAriaLabel(notification: Notification): string {
    return `${notification.type} notification: ${notification.message}`;
  }
}