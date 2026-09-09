import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('adds and removes notifications', () => {
    const id = service.info('Saved', 'The story was saved.');

    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].title).toBe('Saved');

    service.removeNotification(id);

    expect(service.notifications().length).toBe(0);
  });

  it('keeps error notifications visible by default', fakeAsync(() => {
    service.error('Generation failed', 'Try again later.');
    tick(6000);

    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].type).toBe('error');
  }));

  it('auto-hides notifications when configured', fakeAsync(() => {
    service.success('Generated', 'Two chapters are ready.', { duration: 10 });
    tick(11);

    expect(service.notifications().length).toBe(0);
  }));

  it('keeps an undismissed error visible through a burst of routine toasts', () => {
    service.error('Generation failed', 'Try again later.');

    for (let i = 0; i < 8; i++) {
      service.success('Saved', `Autosave #${i}`);
    }

    const notifications = service.notifications();
    expect(notifications.some(notification => notification.title === 'Generation failed')).toBe(true);
  });

  it('still caps auto-hiding notifications to the 5 most recent', () => {
    for (let i = 0; i < 8; i++) {
      service.success('Saved', `Autosave #${i}`);
    }

    const notifications = service.notifications();
    expect(notifications.length).toBe(5);
    expect(notifications[0].message).toBe('Autosave #7');
    expect(notifications[4].message).toBe('Autosave #3');
  });

  it('evicts the oldest persistent notification once the persistent ceiling is exceeded', () => {
    for (let i = 0; i < 21; i++) {
      service.error(`Error #${i}`, 'Something failed.');
    }

    const notifications = service.notifications();
    expect(notifications.length).toBe(20);
    expect(notifications.some(notification => notification.title === 'Error #0')).toBe(false);
    expect(notifications[0].title).toBe('Error #20');
  });

  it('does not let persistent and auto-hiding notifications evict each other', () => {
    service.error('Generation failed', 'Try again later.');
    service.success('Saved', 'Autosave #1');
    service.warning('Slow connection', 'Retrying upload.', { autoHide: false });
    service.info('Tip', 'You can rename chapters.');

    const notifications = service.notifications();
    expect(notifications.length).toBe(4);
    expect(notifications.some(notification => notification.title === 'Generation failed')).toBe(true);
    expect(notifications.some(notification => notification.title === 'Slow connection')).toBe(true);
  });
});
