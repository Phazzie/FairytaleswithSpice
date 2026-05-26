import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Notification, NotificationService } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="notifications-container" aria-label="Notifications">
      @for (notification of notifications(); track notification.id) {
        <article
          class="notification"
          [class.notification--success]="notification.type === 'success'"
          [class.notification--error]="notification.type === 'error'"
          [class.notification--warning]="notification.type === 'warning'"
          [class.notification--info]="notification.type === 'info'"
          [attr.role]="notification.type === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="notification.type === 'error' ? 'assertive' : 'polite'"
          [attr.aria-labelledby]="'notification-title-' + notification.id"
          [attr.aria-describedby]="'notification-message-' + notification.id"
        >
          <span class="notification-marker" aria-hidden="true"></span>
          <div class="notification-text">
            <h2 class="notification-title" [id]="'notification-title-' + notification.id">
              {{ notification.title }}
            </h2>
            <p class="notification-message" [id]="'notification-message-' + notification.id">
              {{ notification.message }}
            </p>
          </div>
          <button
            type="button"
            class="notification-close"
            (click)="dismissNotification(notification)"
            [attr.aria-label]="'Dismiss notification: ' + notification.title"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </article>
      }
    </section>
  `,
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  private readonly notificationService = inject(NotificationService);

  readonly notifications = this.notificationService.notifications;

  dismissNotification(notification: Notification): void {
    this.notificationService.removeNotification(notification.id);
  }
}
