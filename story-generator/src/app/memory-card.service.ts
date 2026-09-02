// Created: 2026-09-02 13:00 UTC

import { Injectable, signal } from '@angular/core';
import { ContinuityPanelViewModel, StoryMemoryCard } from './contracts';

export type MemoryCardDraftItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  triggerLabel: string;
  pinned: boolean;
  accepted: boolean;
};

export type AcceptedMemoryCardEditDraft = {
  title: string;
  detail: string;
  triggerLabel: string;
};

const EMPTY_ACCEPTED_MEMORY_CARD_EDIT_DRAFT: AcceptedMemoryCardEditDraft = {
  title: '',
  detail: '',
  triggerLabel: ''
};

/**
 * The memory-card domain split out of the `App` god-component: pinning
 * continuity drafts, accepting them into a story, and editing/reordering/
 * deleting the accepted set. `App` still owns UI-visible side effects
 * (status messages, notifications); this service owns the state and the
 * pure logic, and is deliberately unaware of `App`'s other concerns —
 * `deriveDrafts`/`deriveAcceptedContinuationSummary` take the continuity
 * view model as a parameter instead of reaching back into the component.
 *
 * Provided in `App`'s own `providers` array, not `root`: the signals here
 * used to be plain `App` instance fields, freshly initialized every time
 * Angular constructs a new `App` (e.g. navigating to `/proving-grounds` and
 * back). A root-provided singleton would survive that destroy/recreate
 * instead, leaking one story's pinned/accepted memory cards into the next
 * whenever `restoreLatestProject()` finds no saved project to hydrate over
 * it.
 */
@Injectable()
export class MemoryCardService {
  readonly pinnedMemoryCardDraftIds = signal<Set<string>>(new Set());
  readonly acceptedMemoryCards = signal<StoryMemoryCard[]>([]);
  readonly editingAcceptedMemoryCardId = signal<string | null>(null);
  readonly acceptedMemoryCardEditDraft = signal<AcceptedMemoryCardEditDraft>({
    ...EMPTY_ACCEPTED_MEMORY_CARD_EDIT_DRAFT
  });

  deriveDrafts(continuity: ContinuityPanelViewModel): MemoryCardDraftItem[] {
    const pinnedDraftIds = this.pinnedMemoryCardDraftIds();
    const acceptedCardIds = new Set(this.acceptedMemoryCards().map(card => card.id));
    const characterDrafts = continuity.characters.slice(0, 1).map(character => ({
      id: `memory-card-character-${character.id}`,
      label: 'Character card',
      title: character.displayName,
      detail: character.currentGoal || character.summary || character.externalConflict,
      triggerLabel: this.buildTriggerLabel(character.displayName),
      pinned: pinnedDraftIds.has(`memory-card-character-${character.id}`),
      accepted: acceptedCardIds.has(`memory-card-character-${character.id}`)
    }));
    const threadDrafts = continuity.activeThreads.slice(0, 1).map(thread => ({
      id: `memory-card-thread-${thread.id}`,
      label: 'Promise card',
      title: thread.label,
      detail: thread.description,
      triggerLabel: this.buildTriggerLabel(thread.label),
      pinned: pinnedDraftIds.has(`memory-card-thread-${thread.id}`),
      accepted: acceptedCardIds.has(`memory-card-thread-${thread.id}`)
    }));
    const artifactDrafts = continuity.unresolvedArtifacts.slice(0, 1).map(artifact => ({
      id: `memory-card-artifact-${artifact.id}`,
      label: 'World card',
      title: artifact.name,
      detail: artifact.significance,
      triggerLabel: this.buildTriggerLabel(artifact.name),
      pinned: pinnedDraftIds.has(`memory-card-artifact-${artifact.id}`),
      accepted: acceptedCardIds.has(`memory-card-artifact-${artifact.id}`)
    }));

    return [...characterDrafts, ...threadDrafts, ...artifactDrafts].filter(item => item.title && item.detail);
  }

  deriveAcceptedContinuationSummary(): string {
    const cards = this.acceptedMemoryCards();
    if (!cards.length) {
      return '';
    }

    const noun = cards.length === 1 ? 'card' : 'cards';
    const visibleTitles = cards.slice(0, 2).map(card => card.title);
    const hiddenCount = cards.length - visibleTitles.length;
    const titleSummary = hiddenCount > 0
      ? `${visibleTitles.join(', ')} +${hiddenCount}`
      : visibleTitles.join(', ');
    return `${cards.length} accepted memory ${noun} will be included: ${titleSummary}.`;
  }

  pinDraft(draftId: string): string {
    let draftPinned = false;
    this.pinnedMemoryCardDraftIds.update(current => {
      const next = new Set(current);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
        draftPinned = true;
      }

      return next;
    });

    return draftPinned
      ? 'Memory card draft pinned for this session.'
      : 'Memory card draft unpinned for this session.';
  }

  /** Accepts a draft (looked up from an already-derived drafts list) into the story. Returns `null` if the draft no longer exists. */
  acceptDraft(draftId: string, drafts: MemoryCardDraftItem[]): string | null {
    const draft = drafts.find(item => item.id === draftId);
    if (!draft) {
      return null;
    }

    this.acceptedMemoryCards.update(current => {
      if (current.some(card => card.id === draft.id)) {
        return current;
      }

      return [
        ...current,
        {
          id: draft.id,
          label: draft.label,
          title: draft.title,
          detail: draft.detail,
          triggerLabel: draft.triggerLabel,
          acceptedAt: new Date().toISOString()
        }
      ];
    });

    return 'Memory card accepted into this story.';
  }

  beginEdit(card: StoryMemoryCard): void {
    this.editingAcceptedMemoryCardId.set(card.id);
    this.acceptedMemoryCardEditDraft.set({
      title: card.title,
      detail: card.detail,
      triggerLabel: card.triggerLabel
    });
  }

  updateEditDraft(field: keyof AcceptedMemoryCardEditDraft, value: string): void {
    this.acceptedMemoryCardEditDraft.update(current => ({
      ...current,
      [field]: value
    }));
  }

  /** Validates and commits the in-progress edit. Returns the status message, or `null` if nothing is being edited. */
  saveEdit(): string | null {
    const cardId = this.editingAcceptedMemoryCardId();
    if (!cardId) {
      return null;
    }

    const draft = this.acceptedMemoryCardEditDraft();
    const title = draft.title.trim();
    const detail = draft.detail.trim();
    const triggerLabel = draft.triggerLabel.trim() || this.buildTriggerLabel(title);
    if (!title || !detail) {
      return 'Accepted memory cards need a title and detail.';
    }

    this.acceptedMemoryCards.update(current => current.map(card => card.id === cardId
      ? {
          ...card,
          title,
          detail,
          triggerLabel
        }
      : card
    ));
    this.cancelEdit();
    return 'Accepted memory card updated.';
  }

  cancelEdit(): void {
    this.editingAcceptedMemoryCardId.set(null);
    this.acceptedMemoryCardEditDraft.set({ ...EMPTY_ACCEPTED_MEMORY_CARD_EDIT_DRAFT });
  }

  moveAccepted(cardId: string, direction: -1 | 1): void {
    this.acceptedMemoryCards.update(current => {
      const currentIndex = current.findIndex(card => card.id === cardId);
      const nextIndex = currentIndex + direction;
      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  }

  deleteAccepted(cardId: string): void {
    this.acceptedMemoryCards.update(current => current.filter(card => card.id !== cardId));
    this.pinnedMemoryCardDraftIds.update(current => {
      if (!current.has(cardId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
    if (this.editingAcceptedMemoryCardId() === cardId) {
      this.cancelEdit();
    }
  }

  /** Clears all memory-card state for a fresh workbench (a reset, or starting a new story from a batch). */
  reset(): void {
    this.pinnedMemoryCardDraftIds.set(new Set());
    this.acceptedMemoryCards.set([]);
    this.cancelEdit();
  }

  /** Restores memory-card state from a saved/cloud project, tolerating malformed persisted data. */
  hydrate(pinnedMemoryCardDraftIds: unknown, acceptedMemoryCards: unknown): void {
    this.pinnedMemoryCardDraftIds.set(new Set(this.normalizePinnedMemoryCardDraftIds(pinnedMemoryCardDraftIds)));
    this.acceptedMemoryCards.set(this.normalizeAcceptedMemoryCards(acceptedMemoryCards));
    this.cancelEdit();
  }

  /** A save-ready snapshot of the current memory-card state, safe to embed in a `SavedStoryProject`. */
  snapshot(): { pinnedMemoryCardDraftIds: string[]; acceptedMemoryCards: StoryMemoryCard[] } {
    return {
      pinnedMemoryCardDraftIds: Array.from(this.pinnedMemoryCardDraftIds()),
      acceptedMemoryCards: this.acceptedMemoryCards().map(card => ({ ...card }))
    };
  }

  formatBrief(card: Pick<StoryMemoryCard, 'label' | 'title' | 'detail' | 'triggerLabel'>): string {
    return `- ${card.label}: ${card.title}. ${card.detail} ${card.triggerLabel}.`;
  }

  private buildTriggerLabel(title: string): string {
    const alias = this.extractTriggerAlias(title);
    return alias ? `Trigger: ${title}, ${alias}` : `Trigger: ${title}`;
  }

  private extractTriggerAlias(title: string): string | null {
    const trimmedTitle = title.trim();
    const words = trimmedTitle
      .split(/\s+/)
      .map(word => word.replace(/[^\p{L}\p{N}']+/gu, ''))
      .filter(Boolean);
    if (words.length < 2) {
      return null;
    }

    const alias = words.pop()?.toLowerCase() ?? '';
    return alias === trimmedTitle.toLowerCase() ? null : alias;
  }

  private normalizePinnedMemoryCardDraftIds(ids: unknown): string[] {
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
  }

  private normalizeAcceptedMemoryCards(cards: unknown): StoryMemoryCard[] {
    if (!Array.isArray(cards)) {
      return [];
    }

    return cards.filter((card): card is StoryMemoryCard => {
      if (!card || typeof card !== 'object') {
        return false;
      }

      const candidate = card as Partial<StoryMemoryCard>;
      return typeof candidate.id === 'string'
        && typeof candidate.label === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.detail === 'string'
        && typeof candidate.triggerLabel === 'string'
        && typeof candidate.acceptedAt === 'string';
    });
  }
}
