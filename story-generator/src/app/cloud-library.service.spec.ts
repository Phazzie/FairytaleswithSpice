import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { CloudLibraryService } from './cloud-library.service';
import { StoryService } from './story.service';
import { AuthService } from './auth.service';
import { ErrorLoggingService } from './error-logging';
import { NotificationService } from './notification.service';
import { ApiResponse, CloudStoryProjectList, CloudStoryProjectListItem } from './contracts';

/**
 * A minimal stand-in for `AuthService`'s signed-in identity, exposing the
 * same signals `CloudLibraryService` reads (`isSignedIn`/`accountId`/
 * `sessionEpoch`/`identityTransitionPending`) with test-only setters to
 * drive them, plus spies for the two methods it calls
 * (`signIn`/`signOut`/`isConfigured`). `App`'s own spec file exercises this
 * same logic through a real `AuthService` and a fake Clerk client end to
 * end; this fake is deliberately narrower so these tests can drive the
 * exact identity transitions each one is about, directly.
 */
function createFakeAuthService(): AuthService & {
  setSignedIn(value: boolean): void;
  setAccountId(value: string | null): void;
  bumpSessionEpoch(): void;
  setIdentityTransitionPending(value: boolean): void;
} {
  const signedIn = signal(true);
  const accountId = signal<string | null>('user-1');
  const sessionEpoch = signal(0);
  const identityTransitionPending = signal(false);

  return {
    isSignedIn: computed(() => signedIn()),
    accountId: computed(() => accountId()),
    sessionEpoch: computed(() => sessionEpoch()),
    identityTransitionPending: computed(() => identityTransitionPending()),
    isConfigured: computed(() => true),
    initialize: () => Promise.resolve(),
    signIn: jasmine.createSpy('signIn').and.resolveTo(),
    signOut: jasmine.createSpy('signOut').and.resolveTo(),
    getRequestToken: () => Promise.resolve(null),
    setSignedIn: (value: boolean) => signedIn.set(value),
    setAccountId: (value: string | null) => accountId.set(value),
    bumpSessionEpoch: () => sessionEpoch.update(epoch => epoch + 1),
    setIdentityTransitionPending: (value: boolean) => identityTransitionPending.set(value)
  } as unknown as AuthService & {
    setSignedIn(value: boolean): void;
    setAccountId(value: string | null): void;
    bumpSessionEpoch(): void;
    setIdentityTransitionPending(value: boolean): void;
  };
}

function createProjectListItem(overrides: Partial<CloudStoryProjectListItem> = {}): CloudStoryProjectListItem {
  return {
    projectId: overrides.projectId ?? 'project-1',
    storyId: overrides.storyId ?? 'story-1',
    title: overrides.title ?? 'Reefbound Vow',
    synopsis: overrides.synopsis ?? 'A siren diplomat risks exile for love.',
    chapterCount: overrides.chapterCount ?? 3,
    acceptedMemoryCardCount: overrides.acceptedMemoryCardCount ?? 0,
    createdAt: overrides.createdAt ?? '2026-06-08T08:37:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-08T08:38:00.000Z'
  };
}

describe('CloudLibraryService', () => {
  let service: CloudLibraryService;
  let fakeAuthService: ReturnType<typeof createFakeAuthService>;
  let storyServiceSpy: jasmine.SpyObj<StoryService>;
  let errorLoggingSpy: jasmine.SpyObj<ErrorLoggingService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    fakeAuthService = createFakeAuthService();
    storyServiceSpy = jasmine.createSpyObj<StoryService>('StoryService', [
      'listCloudStoryProjects',
      'saveCloudStoryProject',
      'loadCloudStoryProject',
      'deleteCloudStoryProject'
    ]);
    errorLoggingSpy = jasmine.createSpyObj<ErrorLoggingService>('ErrorLoggingService', ['logError']);
    notificationServiceSpy = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'info',
      'success',
      'warning',
      'error'
    ]);

    TestBed.configureTestingModule({
      providers: [
        CloudLibraryService,
        { provide: AuthService, useValue: fakeAuthService },
        { provide: StoryService, useValue: storyServiceSpy },
        { provide: ErrorLoggingService, useValue: errorLoggingSpy },
        { provide: NotificationService, useValue: notificationServiceSpy }
      ]
    });
    service = TestBed.inject(CloudLibraryService);
  });

  describe('refresh', () => {
    it('loads the project list and reports cloud_synced on success', () => {
      const projects = [createProjectListItem()];
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: true,
        data: { ownerUserId: 'user-1', storageMode: 'cloud_postgres', projects, totalProjectCount: 1 }
      }));

      service.refresh();

      expect(service.projects()).toEqual(projects);
      expect(service.syncState().mode).toBe('cloud_synced');
      expect(service.syncState().message).toBe('1 cloud project loaded.');
      expect(service.isBusy()).toBeFalse();
    });

    // Before the routine's earlier fix (August 27), a page shorter than the
    // account's real total read exactly like a complete library. This pins
    // that the cap is still said out loud, not just fixed once.
    it('says how many of the total were loaded when the listing is capped', () => {
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: true,
        data: {
          ownerUserId: 'user-1',
          storageMode: 'cloud_postgres',
          projects: [createProjectListItem()],
          totalProjectCount: 61
        }
      }));

      service.refresh();

      expect(service.syncState().message).toBe('1 of 61 cloud projects loaded.');
    });

    it('reports cloud_unavailable with the loaded count when storage is non-durable', () => {
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: true,
        data: {
          ownerUserId: 'user-1',
          storageMode: 'non_durable_memory',
          projects: [createProjectListItem()],
          totalProjectCount: 1
        }
      }));

      service.refresh();

      expect(service.syncState().mode).toBe('cloud_unavailable');
      expect(service.syncState().message).toContain('non-durable account storage');
    });

    it('reports sync_failed on an unsuccessful response', () => {
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Listing failed.' }
      } as ApiResponse<CloudStoryProjectList>));

      service.refresh();

      expect(service.syncState().mode).toBe('sync_failed');
      expect(service.syncState().message).toBe('Listing failed.');
    });

    it('does nothing while already busy', () => {
      service.isBusy.set(true);

      service.refresh();

      expect(storyServiceSpy.listCloudStoryProjects).not.toHaveBeenCalled();
    });

    it('does nothing while an identity transition is pending', () => {
      fakeAuthService.setIdentityTransitionPending(true);

      service.refresh();

      expect(storyServiceSpy.listCloudStoryProjects).not.toHaveBeenCalled();
    });

    // The core of the staleness guard this service exists to own: a
    // response authenticated under one account must not populate the UI
    // once the signed-in identity has since moved on, whether or not
    // anything explicitly cancelled the request.
    it('discards a response whose identity no longer matches the live signed-in state', () => {
      const projectsSubject = new Subject<ApiResponse<CloudStoryProjectList>>();
      storyServiceSpy.listCloudStoryProjects.and.returnValue(projectsSubject.asObservable());

      service.refresh();
      fakeAuthService.bumpSessionEpoch();
      projectsSubject.next({
        success: true,
        data: {
          ownerUserId: 'user-1',
          storageMode: 'cloud_postgres',
          projects: [createProjectListItem({ title: 'Should not apply' })],
          totalProjectCount: 1
        }
      });

      expect(service.projects()).toEqual([]);
    });

    it('releases the busy lock on a stale error without applying its error state', () => {
      const projectsSubject = new Subject<ApiResponse<CloudStoryProjectList>>();
      storyServiceSpy.listCloudStoryProjects.and.returnValue(projectsSubject.asObservable());

      service.refresh();
      fakeAuthService.bumpSessionEpoch();
      const syncStateBeforeError = service.syncState();
      projectsSubject.error(new Error('stale request failed'));

      expect(service.isBusy()).toBeFalse();
      expect(service.syncState()).toEqual(syncStateBeforeError);
      expect(errorLoggingSpy.logError).not.toHaveBeenCalled();
    });
  });

  describe('syncWithAuthState', () => {
    it('refreshes the library on sign-in', () => {
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: true,
        data: { ownerUserId: 'user-1', storageMode: 'cloud_postgres', projects: [], totalProjectCount: 0 }
      }));

      service.syncWithAuthState(true, 'user-1');

      expect(storyServiceSpy.listCloudStoryProjects).toHaveBeenCalledTimes(1);
    });

    it('clears projects and reports cloud_unavailable on a true-to-false sign-out transition', () => {
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of({
        success: true,
        data: {
          ownerUserId: 'user-1',
          storageMode: 'cloud_postgres',
          projects: [createProjectListItem()],
          totalProjectCount: 1
        }
      }));
      service.syncWithAuthState(true, 'user-1');
      expect(service.projects().length).toBe(1);

      service.syncWithAuthState(false, null);

      expect(service.projects()).toEqual([]);
      expect(service.syncState().mode).toBe('cloud_unavailable');
      expect(service.syncState().message).toBe('Signed out. Local browser saves are still available.');
    });

    it('does nothing on a standing signed-out state (no prior sign-in)', () => {
      service.syncWithAuthState(false, null);

      expect(storyServiceSpy.listCloudStoryProjects).not.toHaveBeenCalled();
      expect(service.syncState().mode).toBe('cloud_unavailable');
      expect(service.syncState().message).toBe('Account sync is not connected yet.');
    });

    // A multi-session Clerk client can swap the signed-in account without an
    // intermediate signed-out state (another tab switching accounts). The
    // outgoing account's in-flight request must be cancelled and its
    // eventual stale response discarded, and the incoming account's library
    // refreshed in its place.
    it('cancels the outgoing account request, clears its projects, and refreshes on an account switch', () => {
      const firstAccountSubject = new Subject<ApiResponse<CloudStoryProjectList>>();
      storyServiceSpy.listCloudStoryProjects.and.returnValue(firstAccountSubject.asObservable());
      service.syncWithAuthState(true, 'user-original');
      expect(service.isBusy()).toBeTrue();

      const secondAccountResponse: ApiResponse<CloudStoryProjectList> = {
        success: true,
        data: {
          ownerUserId: 'user-incoming',
          storageMode: 'cloud_postgres',
          projects: [createProjectListItem({ projectId: 'incoming-project' })],
          totalProjectCount: 1
        }
      };
      storyServiceSpy.listCloudStoryProjects.and.returnValue(of(secondAccountResponse));
      fakeAuthService.setAccountId('user-incoming');
      service.syncWithAuthState(true, 'user-incoming');

      expect(service.projects().map(project => project.projectId)).toEqual(['incoming-project']);

      // The outgoing account's request, arriving late, must not overwrite
      // the incoming account's already-applied list.
      firstAccountSubject.next({
        success: true,
        data: {
          ownerUserId: 'user-original',
          storageMode: 'cloud_postgres',
          projects: [createProjectListItem({ projectId: 'stale-project' })],
          totalProjectCount: 1
        }
      });
      expect(service.projects().map(project => project.projectId)).toEqual(['incoming-project']);
    });
  });

  describe('signOut', () => {
    it('does nothing when not signed in', async () => {
      fakeAuthService.setSignedIn(false);

      await service.signOut();

      expect(fakeAuthService.signOut).not.toHaveBeenCalled();
    });

    it('clears projects/sync state and notifies on success', async () => {
      service.projects.set([createProjectListItem()]);

      await service.signOut();

      expect(fakeAuthService.signOut).toHaveBeenCalled();
      expect(service.projects()).toEqual([]);
      expect(service.syncState().mode).toBe('cloud_unavailable');
      expect(service.isBusy()).toBeFalse();
      expect(notificationServiceSpy.info).toHaveBeenCalledWith('Signed out', jasmine.any(String));
    });

    it('unlocks cloud controls and reports an error without clearing state when Clerk sign-out fails', async () => {
      (fakeAuthService.signOut as jasmine.Spy).and.rejectWith(new Error('clerk sign-out failed'));
      service.projects.set([createProjectListItem()]);

      await service.signOut();

      expect(service.projects().length).toBe(1);
      expect(service.isBusy()).toBeFalse();
      expect(notificationServiceSpy.error).toHaveBeenCalled();
      expect(errorLoggingSpy.logError).toHaveBeenCalled();
    });
  });

  describe('showAccountSetupStatus', () => {
    it('notifies that the account is already connected without opening sign-in again', async () => {
      service.syncState.set({ mode: 'cloud_synced', lastSyncedAt: '2026-06-08T08:38:00.000Z' });

      await service.showAccountSetupStatus();

      expect(fakeAuthService.signIn).not.toHaveBeenCalled();
      expect(notificationServiceSpy.info).toHaveBeenCalledWith('Account connected', jasmine.any(String));
    });

    it('does nothing while busy', async () => {
      service.isBusy.set(true);

      await service.showAccountSetupStatus();

      expect(fakeAuthService.signIn).not.toHaveBeenCalled();
    });
  });

  describe('cancelInFlightRequest', () => {
    it('unsubscribes the tracked subscription and releases the busy lock', () => {
      const projectsSubject = new Subject<ApiResponse<CloudStoryProjectList>>();
      storyServiceSpy.listCloudStoryProjects.and.returnValue(projectsSubject.asObservable());
      service.refresh();
      expect(projectsSubject.observed).toBeTrue();
      expect(service.isBusy()).toBeTrue();

      service.cancelInFlightRequest();

      expect(projectsSubject.observed).toBeFalse();
      expect(service.isBusy()).toBeFalse();
    });
  });
});
