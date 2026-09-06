import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreatureArchetype,
  HeatIntimacyBoundary,
  HeatTensionMode,
  NarrativeTone,
  StoryLabLibrarySort,
  StoryLabUserProfile
} from '../contracts';
import {
  ChoiceOption,
  CreatureOption,
  HeatContractOption,
  creatureOptions,
  heatBoundaryOptions,
  heatTensionOptions,
  toneOptions
} from '../story-lab-option-copy';
import { StoryService } from '../story.service';
import { AuthService } from '../auth.service';

type ProfilePreferences = StoryLabUserProfile['preferences'];

type LoadState = 'loading' | 'loaded' | 'error';

const LIBRARY_SORT_OPTIONS: ChoiceOption<StoryLabLibrarySort>[] = [
  { id: 'updated_desc', label: 'Recently updated' },
  { id: 'created_desc', label: 'Newest first' },
  { id: 'title_asc', label: 'Title (A–Z)' }
];

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function toggleMember<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

/**
 * `StoryService.getStoryLabProfile`/`updateStoryLabProfile` reject their
 * observable on any non-2xx response (see `StoryService.handleHttpError`)
 * rather than resolving to `{ success: false }`, so the API's own error
 * message lives at `error.error.error.message` on the resulting
 * `HttpErrorResponse` — `error.message` on it is Angular's generic "Http
 * failure response for ..." text, not anything the backend said.
 */
function extractApiErrorMessage(error: { error?: { error?: { message?: string } } } | undefined | null, fallback: string): string {
  return error?.error?.error?.message ?? fallback;
}

/**
 * The editor for the Story Lab profile the backend has supported since it was
 * built — favorite creatures/tones, a default heat contract, content
 * boundaries, and the library sort order that `readLibrarySort` in
 * `accountRouteHandlers.ts` already reads on every Cloud Library list. Until
 * this component, nothing on the client ever wrote to it: `StoryService`'s
 * `getStoryLabProfile`/`updateStoryLabProfile` were called only from their own
 * spec file, so every signed-in user was permanently stuck on whatever
 * `createDefaultStoryLabUserProfile` answered, with no screen that told them
 * a preference existed.
 *
 * Guards its requests against `AuthService.sessionEpoch()` the same way
 * `CloudLibraryService` guards its own — a response arriving after the
 * signed-in account changed (a sign-out, or a switch in another tab) is
 * discarded rather than applied. The panel additionally closes itself the
 * moment `AuthService.accountId()` changes while it's open — a coarser
 * `sessionEpoch` change alone (an ordinary same-account token refresh) does
 * not close it, so a refresh mid-edit cannot discard a reader's unsaved
 * changes — so one account's profile, including its private "no-go
 * content" notes, can never render under another.
 */
@Component({
  selector: 'app-story-lab-profile-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './story-lab-profile-panel.component.html',
  styleUrl: './story-lab-profile-panel.component.css'
})
export class StoryLabProfilePanelComponent implements OnInit, AfterViewInit {
  private readonly storyService = inject(StoryService);
  private readonly authService = inject(AuthService);

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<StoryLabUserProfile>();

  @ViewChild('panel') private readonly panelRef?: ElementRef<HTMLElement>;

  readonly creatureOptions: CreatureOption[] = creatureOptions;
  readonly toneOptions: ChoiceOption<NarrativeTone>[] = toneOptions;
  readonly heatTensionOptions: HeatContractOption<HeatTensionMode>[] = heatTensionOptions;
  readonly heatBoundaryOptions: HeatContractOption<HeatIntimacyBoundary>[] = heatBoundaryOptions;
  readonly librarySortOptions: ChoiceOption<StoryLabLibrarySort>[] = LIBRARY_SORT_OPTIONS;

  readonly loadState = signal<LoadState>('loading');
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly profile = signal<StoryLabUserProfile | null>(null);

  // Captured once at construction. `AuthService.sessionEpoch()` advances on
  // every sign-out, every account switch, *and* an ordinary same-account
  // token refresh (deliberately coarser — see that signal's own comment) —
  // right for discarding a response that might have raced any of those, but
  // wrong for deciding whether to close the panel out from under an editing
  // reader: a refresh alone must not discard their unsaved edits.
  // `AuthService.accountId()` is what the panel is actually open *for* — it
  // is `null` when signed out and otherwise stable across an ordinary
  // refresh (same `sub`, changed only by an actual sign-in/out or switch) —
  // so that is what the auto-close effect below compares instead.
  private readonly openedSessionEpoch = this.authService.sessionEpoch();
  private readonly openedAccountId = this.authService.accountId();
  private lastFocusedElement: HTMLElement | null = null;

  constructor() {
    // The reaction lives in `handleAccountIdChange` rather than inline here
    // — see `App`'s own constructor-effect comment for why a plain,
    // directly-callable method is what this codebase's tests drive, rather
    // than relying on a constructor effect reliably rerunning under TestBed.
    effect(() => {
      this.handleAccountIdChange(this.authService.accountId());
    });
  }

  /**
   * Bypasses `close()`'s `isSaving()` guard deliberately: that guard exists
   * to stop a reader's own Cancel/Escape/backdrop click from discarding an
   * in-flight save by accident, not to keep the outgoing account's profile
   * on screen — including its private "no-go content" notes — locked open
   * under the incoming account for however long that save takes to fail or
   * land.
   */
  handleAccountIdChange(currentAccountId: string | null): void {
    if (currentAccountId !== this.openedAccountId) {
      this.forceClose();
    }
  }

  ngOnInit(): void {
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.loadProfile();
  }

  ngAfterViewInit(): void {
    this.panelRef?.nativeElement.focus();
  }

  loadProfile(): void {
    this.loadState.set('loading');
    this.loadError.set(null);
    const requestEpoch = this.authService.sessionEpoch();

    this.storyService.getStoryLabProfile().subscribe({
      next: response => {
        // Retries under whichever identity is current now, rather than
        // discarding and leaving `loadState` stuck at `'loading'` forever:
        // this is a `GET`, safe to repeat, and (unlike `save()`) there is no
        // reader-entered data at risk of loading under the wrong account —
        // only the read itself needs to be current.
        if (this.authService.sessionEpoch() !== requestEpoch) {
          this.loadProfile();
          return;
        }

        if (!response.success || !response.data) {
          this.loadState.set('error');
          this.loadError.set(response.error?.message ?? 'Could not load your Story Lab profile.');
          return;
        }

        this.profile.set(response.data);
        this.loadState.set('loaded');
      },
      error: error => {
        if (this.authService.sessionEpoch() !== requestEpoch) {
          this.loadProfile();
          return;
        }

        this.loadState.set('error');
        this.loadError.set(extractApiErrorMessage(error, 'Could not load your Story Lab profile.'));
      }
    });
  }

  isCreatureSelected(id: CreatureArchetype): boolean {
    return this.profile()?.preferences.favoriteCreatures.includes(id) ?? false;
  }

  isToneSelected(id: NarrativeTone): boolean {
    return this.profile()?.preferences.favoriteTones.includes(id) ?? false;
  }

  toggleCreature(id: CreatureArchetype): void {
    this.updatePreferences(prefs => ({ ...prefs, favoriteCreatures: toggleMember(prefs.favoriteCreatures, id) }));
  }

  toggleTone(id: NarrativeTone): void {
    this.updatePreferences(prefs => ({ ...prefs, favoriteTones: toggleMember(prefs.favoriteTones, id) }));
  }

  updateTensionMode(id: HeatTensionMode): void {
    this.updatePreferences(prefs => ({
      ...prefs,
      defaultHeatContract: { ...prefs.defaultHeatContract, tensionMode: id }
    }));
  }

  updateIntimacyBoundary(id: HeatIntimacyBoundary): void {
    this.updatePreferences(prefs => ({
      ...prefs,
      defaultHeatContract: { ...prefs.defaultHeatContract, intimacyBoundary: id }
    }));
  }

  updateAdultOnlyConfirmed(value: boolean): void {
    this.updatePreferences(prefs => ({
      ...prefs,
      defaultHeatContract: { ...prefs.defaultHeatContract, adultOnlyConfirmed: value }
    }));
  }

  updateNoGoContent(value: string): void {
    this.updatePreferences(prefs => ({
      ...prefs,
      defaultHeatContract: { ...prefs.defaultHeatContract, noGoContent: value }
    }));
  }

  updateContentBoundaries(value: string): void {
    this.updatePreferences(prefs => ({ ...prefs, contentBoundaries: value }));
  }

  updateLibrarySort(id: StoryLabLibrarySort): void {
    this.updatePreferences(prefs => ({ ...prefs, librarySort: id }));
  }

  save(): void {
    const profile = this.profile();
    if (!profile || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);
    const requestEpoch = this.authService.sessionEpoch();

    this.storyService.updateStoryLabProfile(profile).subscribe({
      next: response => {
        // Always released, whether or not the response below turns out to
        // be stale: a same-account token refresh mid-save advances
        // `sessionEpoch` without changing `accountId`, and the round-2 fix
        // deliberately keeps the panel open (not force-closed) for exactly
        // that case — so if this lock stayed on only the non-stale branch,
        // it would never come back off.
        this.isSaving.set(false);

        if (this.authService.sessionEpoch() !== requestEpoch) {
          // Unlike `loadProfile()`, this is a `PUT` — resubmitting the same
          // edit blind isn't safe (the identity that would receive it may
          // have changed), so this surfaces the ambiguity rather than either
          // silently doing nothing (the reader would have no way to know
          // whether their edit actually landed) or retrying automatically.
          this.saveError.set('Your session changed while saving. Please review and save again to be sure.');
          return;
        }

        if (!response.success || !response.data) {
          this.saveError.set(response.error?.message ?? 'Could not save your Story Lab profile.');
          return;
        }

        this.profile.set(response.data);
        this.saved.emit(response.data);
      },
      error: error => {
        this.isSaving.set(false);

        if (this.authService.sessionEpoch() !== requestEpoch) {
          this.saveError.set('Your session changed while saving. Please review and save again to be sure.');
          return;
        }

        this.saveError.set(extractApiErrorMessage(error, 'Could not save your Story Lab profile.'));
      }
    });
  }

  close(): void {
    if (this.isSaving()) {
      return;
    }

    this.forceClose();
  }

  dismissBackdrop(): void {
    this.close();
  }

  private forceClose(): void {
    this.closed.emit();
    this.lastFocusedElement?.focus();
  }

  /**
   * A minimal focus trap: Tab from the last focusable control wraps to the
   * first, and Shift+Tab from the first wraps to the last, so keyboard focus
   * cannot leave the dialog into the account/story controls behind it while
   * it's open.
   */
  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.panelRef?.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // `ngAfterViewInit` focuses the panel container itself (`#panel`), not
    // `first` — so the very first Shift+Tab, before the reader has tabbed
    // anywhere, sees `active === panelRef.nativeElement` rather than `first`.
    // Treating the container as an equivalent backward boundary is what
    // makes that first keystroke wrap instead of escaping to the page
    // behind the dialog.
    const isAtBackwardBoundary = active === first || active === this.panelRef?.nativeElement;

    if (event.shiftKey && isAtBackwardBoundary) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private updatePreferences(update: (preferences: ProfilePreferences) => ProfilePreferences): void {
    const current = this.profile();
    if (!current) {
      return;
    }

    this.profile.set({ ...current, preferences: update(current.preferences) });
  }
}
