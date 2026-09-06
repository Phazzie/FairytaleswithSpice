import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
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

type ProfilePreferences = StoryLabUserProfile['preferences'];

type LoadState = 'loading' | 'loaded' | 'error';

const LIBRARY_SORT_OPTIONS: ChoiceOption<StoryLabLibrarySort>[] = [
  { id: 'updated_desc', label: 'Recently updated' },
  { id: 'created_desc', label: 'Newest first' },
  { id: 'title_asc', label: 'Title (A–Z)' }
];

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
 */
@Component({
  selector: 'app-story-lab-profile-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './story-lab-profile-panel.component.html',
  styleUrl: './story-lab-profile-panel.component.css'
})
export class StoryLabProfilePanelComponent implements OnInit {
  private readonly storyService = inject(StoryService);

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<StoryLabUserProfile>();

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

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loadState.set('loading');
    this.loadError.set(null);

    this.storyService.getStoryLabProfile().subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.loadState.set('error');
          this.loadError.set(response.error?.message ?? 'Could not load your Story Lab profile.');
          return;
        }

        this.profile.set(response.data);
        this.loadState.set('loaded');
      },
      error: error => {
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

    this.storyService.updateStoryLabProfile(profile).subscribe({
      next: response => {
        this.isSaving.set(false);
        if (!response.success || !response.data) {
          this.saveError.set(response.error?.message ?? 'Could not save your Story Lab profile.');
          return;
        }

        this.profile.set(response.data);
        this.saved.emit(response.data);
      },
      error: error => {
        this.isSaving.set(false);
        this.saveError.set(extractApiErrorMessage(error, 'Could not save your Story Lab profile.'));
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  private updatePreferences(update: (preferences: ProfilePreferences) => ProfilePreferences): void {
    const current = this.profile();
    if (!current) {
      return;
    }

    this.profile.set({ ...current, preferences: update(current.preferences) });
  }
}
