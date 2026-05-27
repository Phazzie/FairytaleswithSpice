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
});
