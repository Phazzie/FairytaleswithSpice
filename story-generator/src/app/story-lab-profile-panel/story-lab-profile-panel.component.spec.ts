import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StoryLabProfilePanelComponent } from './story-lab-profile-panel.component';
import { StoryLabUserProfile } from '../contracts';
import { AuthService } from '../auth.service';

const OWNER_ACCOUNT_ID = 'user-owner-account';

function createProfile(overrides: Partial<StoryLabUserProfile['preferences']> = {}): StoryLabUserProfile {
  const now = '2026-06-08T08:38:00.000Z';
  return {
    userId: 'user-owner',
    displayName: 'Avery',
    preferences: {
      defaultHeatContract: {
        adultOnlyConfirmed: false,
        tensionMode: 'slow_burn',
        intimacyBoundary: 'closed_door'
      },
      favoriteCreatures: ['witch'],
      favoriteTones: ['dark_romance'],
      librarySort: 'updated_desc',
      ...overrides
    },
    createdAt: now,
    updatedAt: now
  };
}

describe('StoryLabProfilePanelComponent', () => {
  let component: StoryLabProfilePanelComponent;
  let fixture: ComponentFixture<StoryLabProfilePanelComponent>;
  let httpMock: HttpTestingController;
  let sessionEpoch: WritableSignal<number>;
  let accountId: WritableSignal<string | null>;

  beforeEach(async () => {
    sessionEpoch = signal(0);
    accountId = signal<string | null>(OWNER_ACCOUNT_ID);

    await TestBed.configureTestingModule({
      imports: [StoryLabProfilePanelComponent, HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: { sessionEpoch, accountId } }]
    }).compileComponents();

    fixture = TestBed.createComponent(StoryLabProfilePanelComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the signed-in profile on init', () => {
    fixture.detectChanges();

    const request = httpMock.expectOne('/api/story-lab/account/profile');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: createProfile() });

    expect(component.loadState()).toBe('loaded');
    expect(component.profile()?.preferences.favoriteCreatures).toEqual(['witch']);
  });

  it('surfaces the backend error and offers a retry when the profile fails to load', () => {
    fixture.detectChanges();

    const request = httpMock.expectOne('/api/story-lab/account/profile');
    request.flush(
      { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Profile store is unavailable.' } },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(component.loadState()).toBe('error');
    expect(component.loadError()).toBe('Profile store is unavailable.');
  });

  it('toggles a favorite creature locally before saving', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

    expect(component.isCreatureSelected('witch')).toBeTrue();
    expect(component.isCreatureSelected('vampire')).toBeFalse();

    component.toggleCreature('vampire');
    expect(component.isCreatureSelected('vampire')).toBeTrue();

    component.toggleCreature('witch');
    expect(component.isCreatureSelected('witch')).toBeFalse();
  });

  it('saves the edited profile and emits it once the backend confirms', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);

    component.updateLibrarySort('title_asc');
    component.save();

    const putRequest = httpMock.expectOne('/api/story-lab/account/profile');
    expect(putRequest.request.method).toBe('PUT');
    expect(putRequest.request.body.profile.preferences.librarySort).toBe('title_asc');

    const savedProfile = createProfile({ librarySort: 'title_asc' });
    putRequest.flush({ success: true, data: savedProfile });

    expect(component.isSaving()).toBeFalse();
    expect(savedSpy).toHaveBeenCalledWith(savedProfile);
  });

  it('surfaces a save error without closing the panel', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);

    component.save();

    const putRequest = httpMock.expectOne('/api/story-lab/account/profile');
    putRequest.flush(
      { success: false, error: { code: 'VALIDATION', message: 'preferences.contentBoundaries must be 500 characters or fewer.' } },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.isSaving()).toBeFalse();
    expect(component.saveError()).toBe('preferences.contentBoundaries must be 500 characters or fewer.');
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);

    component.close();

    expect(closedSpy).toHaveBeenCalled();
  });

  it('does not close or save while a save request is already in flight', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

    component.save();
    httpMock.expectOne({ method: 'PUT' });

    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);
    component.close();
    component.dismissBackdrop();

    expect(closedSpy).not.toHaveBeenCalled();
  });

  // Mirrors `CloudLibraryService`'s own stale-response guard: a profile GET/PUT
  // that resolves after the signed-in account changed (sign-out, or a switch
  // in another tab) must never populate the UI with another account's data —
  // including the free-text "no-go content" notes this profile carries.
  describe('account-identity staleness guard', () => {
    // Retries under the new epoch rather than leaving `loadState` stuck at
    // `'loading'` forever — a `GET` is safe to repeat, unlike a save.
    it('retries a load response that arrives after the session epoch changes', () => {
      fixture.detectChanges();
      const firstRequest = httpMock.expectOne('/api/story-lab/account/profile');

      sessionEpoch.set(1);
      firstRequest.flush({ success: true, data: createProfile() });

      expect(component.loadState()).toBe('loading');
      expect(component.profile()).toBeNull();

      const retryRequest = httpMock.expectOne('/api/story-lab/account/profile');
      retryRequest.flush({ success: true, data: createProfile() });

      expect(component.loadState()).toBe('loaded');
      expect(component.profile()).not.toBeNull();
    });

    // Unlike `loadProfile()`, a stale save response is not retried — this is
    // a `PUT`, and resubmitting an edit under a possibly-different identity
    // isn't safe. The lock still releases and the reader is told to check,
    // rather than either staying stuck or being silently told nothing.
    it('releases the save lock and reports ambiguity when the response arrives after the session epoch changes', () => {
      fixture.detectChanges();
      httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

      const savedSpy = jasmine.createSpy('saved');
      component.saved.subscribe(savedSpy);
      component.save();
      const putRequest = httpMock.expectOne({ method: 'PUT' });

      sessionEpoch.set(1);
      putRequest.flush({ success: true, data: createProfile({ librarySort: 'title_asc' }) });

      expect(component.isSaving()).toBeFalse();
      expect(component.saveError()).toContain('session changed');
      expect(savedSpy).not.toHaveBeenCalled();
    });
  });

  describe('account-identity close guard', () => {
    it('closes when the signed-in account actually changes', () => {
      fixture.detectChanges();
      httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

      const closedSpy = jasmine.createSpy('closed');
      component.closed.subscribe(closedSpy);

      component.handleAccountIdChange('a-different-account');

      expect(closedSpy).toHaveBeenCalled();
    });

    it('does not close for an ordinary same-account token refresh', () => {
      fixture.detectChanges();
      httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

      const closedSpy = jasmine.createSpy('closed');
      component.closed.subscribe(closedSpy);

      component.handleAccountIdChange(OWNER_ACCOUNT_ID);

      expect(closedSpy).not.toHaveBeenCalled();
    });

    // Before this, an account change while a save was in flight hit
    // `close()`'s `isSaving()` guard and silently did nothing — the exact
    // moment the guard needs to be bypassed, not honored, since the
    // alternative is the outgoing account's private profile staying
    // rendered and locked open under the incoming account.
    it('closes even while a save is in flight', () => {
      fixture.detectChanges();
      httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });
      component.save();
      httpMock.expectOne({ method: 'PUT' });
      expect(component.isSaving()).toBeTrue();

      const closedSpy = jasmine.createSpy('closed');
      component.closed.subscribe(closedSpy);

      component.handleAccountIdChange('a-different-account');

      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard interaction', () => {
    it('closes on Escape', () => {
      fixture.detectChanges();
      httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });

      const closedSpy = jasmine.createSpy('closed');
      component.closed.subscribe(closedSpy);

      component.onDialogKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closedSpy).toHaveBeenCalled();
    });

    // `ngAfterViewInit` focuses the dialog container itself, not its first
    // control — before this fix, the very first Shift+Tab a reader pressed
    // right after opening the panel missed the trap's `active === first`
    // check entirely and escaped to the page behind the dialog.
    it('wraps Shift+Tab back to the last control when focus is still on the dialog container', () => {
      document.body.appendChild(fixture.nativeElement);
      try {
        fixture.detectChanges();
        httpMock.expectOne('/api/story-lab/account/profile').flush({ success: true, data: createProfile() });
        fixture.detectChanges();

        const panel = fixture.nativeElement.querySelector('[data-testid="story-lab-profile-panel"]') as HTMLElement;
        panel.focus();
        expect(document.activeElement).toBe(panel);

        const focusable = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const last = focusable[focusable.length - 1];

        component.onDialogKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));

        expect(document.activeElement).toBe(last);
      } finally {
        document.body.removeChild(fixture.nativeElement);
      }
    });
  });
});
