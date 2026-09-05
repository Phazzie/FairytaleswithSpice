// Created: 2026-09-02 13:00 UTC

import { TestBed } from '@angular/core/testing';
import { MemoryCardService } from './memory-card.service';
import { CharacterProfile, ContinuityPanelViewModel, LoreArtifact, PlotThread, StoryMemoryCard } from './contracts';

function createContinuityPanel(overrides: Partial<ContinuityPanelViewModel> = {}): ContinuityPanelViewModel {
  return {
    characters: [],
    activeThreads: [],
    unresolvedArtifacts: [],
    continuityWarnings: [],
    ...overrides
  };
}

function createCharacter(overrides: Partial<CharacterProfile> = {}): CharacterProfile {
  return {
    id: 'char-mara',
    displayName: 'Mara',
    archetype: 'protagonist',
    summary: 'A vampire diplomat.',
    currentGoal: 'Broker a truce before dawn.',
    internalConflict: '',
    externalConflict: '',
    secrets: [],
    relationships: [],
    spiceCompatibilities: [],
    ...overrides
  };
}

function createThread(overrides: Partial<PlotThread> = {}): PlotThread {
  return {
    id: 'thread-truce',
    label: 'The dawn truce',
    status: 'active',
    description: 'Mara and the rival court must agree before sunrise.',
    foreshadowedDevices: [],
    ...overrides
  };
}

function createArtifact(overrides: Partial<LoreArtifact> = {}): LoreArtifact {
  return {
    id: 'artifact-seal',
    name: 'The Obsidian Seal',
    significance: 'Binds the truce once pressed into wax.',
    ...overrides
  };
}

describe('MemoryCardService', () => {
  let service: MemoryCardService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MemoryCardService] });
    service = TestBed.inject(MemoryCardService);
  });

  describe('deriveDrafts', () => {
    it('derives one draft per category (first character, thread, and artifact), marked unpinned and unaccepted by default', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({
        characters: [createCharacter()],
        activeThreads: [createThread()],
        unresolvedArtifacts: [createArtifact()]
      }));

      expect(drafts.length).toBe(3);
      expect(drafts.every(draft => !draft.pinned && !draft.accepted)).toBeTrue();
      expect(drafts.find(draft => draft.label === 'Character card')?.title).toBe('Mara');
      expect(drafts.find(draft => draft.label === 'Promise card')?.title).toBe('The dawn truce');
      expect(drafts.find(draft => draft.label === 'World card')?.title).toBe('The Obsidian Seal');
    });

    it('derives a draft for every tracked character, thread, and artifact, not just the first of each', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({
        characters: [
          createCharacter({ id: 'char-mara', displayName: 'Mara' }),
          createCharacter({ id: 'char-eli', displayName: 'Eli' }),
          createCharacter({ id: 'char-rook', displayName: 'Rook' })
        ],
        activeThreads: [
          createThread({ id: 'thread-truce', label: 'The dawn truce' }),
          createThread({ id: 'thread-debt', label: 'The blood debt' })
        ],
        unresolvedArtifacts: [
          createArtifact({ id: 'artifact-seal', name: 'The Obsidian Seal' }),
          createArtifact({ id: 'artifact-key', name: 'The Rusted Key' })
        ]
      }));

      expect(drafts.length).toBe(7);
      expect(drafts.filter(draft => draft.label === 'Character card').map(draft => draft.title))
        .toEqual(['Mara', 'Eli', 'Rook']);
      expect(drafts.filter(draft => draft.label === 'Promise card').map(draft => draft.title))
        .toEqual(['The dawn truce', 'The blood debt']);
      expect(drafts.filter(draft => draft.label === 'World card').map(draft => draft.title))
        .toEqual(['The Obsidian Seal', 'The Rusted Key']);
      expect(drafts.map(draft => draft.id)).toEqual([
        'memory-card-character-char-mara',
        'memory-card-character-char-eli',
        'memory-card-character-char-rook',
        'memory-card-thread-thread-truce',
        'memory-card-thread-thread-debt',
        'memory-card-artifact-artifact-seal',
        'memory-card-artifact-artifact-key'
      ]);
    });

    it('tracks pinned and accepted state per draft independently when multiple share a category', () => {
      service.pinDraft('memory-card-character-char-eli');
      const panel = createContinuityPanel({
        characters: [
          createCharacter({ id: 'char-mara', displayName: 'Mara' }),
          createCharacter({ id: 'char-eli', displayName: 'Eli' })
        ]
      });
      service.acceptDraft('memory-card-character-char-mara', service.deriveDrafts(panel));

      const drafts = service.deriveDrafts(panel);
      const mara = drafts.find(draft => draft.title === 'Mara')!;
      const eli = drafts.find(draft => draft.title === 'Eli')!;

      expect(mara.accepted).toBeTrue();
      expect(mara.pinned).toBeFalse();
      expect(eli.pinned).toBeTrue();
      expect(eli.accepted).toBeFalse();
    });

    it('omits a draft when its title or detail is empty', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({
        characters: [createCharacter({ currentGoal: '', summary: '', externalConflict: '' })]
      }));

      expect(drafts.length).toBe(0);
    });

    it('marks a draft pinned and accepted once its id has been pinned or accepted', () => {
      service.pinDraft('memory-card-character-char-mara');
      service.acceptDraft('memory-card-character-char-mara', service.deriveDrafts(createContinuityPanel({
        characters: [createCharacter()]
      })));

      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      expect(drafts[0].pinned).toBeTrue();
      expect(drafts[0].accepted).toBeTrue();
    });
  });

  describe('pinDraft', () => {
    it('pins on the first call and unpins on the second, reporting which happened', () => {
      expect(service.pinDraft('draft-1')).toBe('Memory card draft pinned for this session.');
      expect(service.pinnedMemoryCardDraftIds().has('draft-1')).toBeTrue();

      expect(service.pinDraft('draft-1')).toBe('Memory card draft unpinned for this session.');
      expect(service.pinnedMemoryCardDraftIds().has('draft-1')).toBeFalse();
    });
  });

  describe('acceptDraft', () => {
    it('returns null and makes no change when the draft id is not in the given list', () => {
      const message = service.acceptDraft('missing-draft', []);

      expect(message).toBeNull();
      expect(service.acceptedMemoryCards()).toEqual([]);
    });

    it('accepts a draft into the story exactly once', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      const draftId = drafts[0].id;

      expect(service.acceptDraft(draftId, drafts)).toBe('Memory card accepted into this story.');
      expect(service.acceptedMemoryCards().length).toBe(1);

      // Accepting the same draft again is a no-op, not a duplicate.
      service.acceptDraft(draftId, drafts);
      expect(service.acceptedMemoryCards().length).toBe(1);
    });
  });

  describe('editing an accepted card', () => {
    function acceptOneCard(): StoryMemoryCard {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      service.acceptDraft(drafts[0].id, drafts);
      return service.acceptedMemoryCards()[0];
    }

    it('begins an edit with the card current values', () => {
      const card = acceptOneCard();

      service.beginEdit(card);

      expect(service.editingAcceptedMemoryCardId()).toBe(card.id);
      expect(service.acceptedMemoryCardEditDraft()).toEqual({
        title: card.title,
        detail: card.detail,
        triggerLabel: card.triggerLabel
      });
    });

    it('refuses to save an edit with an empty title or detail', () => {
      const card = acceptOneCard();
      service.beginEdit(card);

      service.updateEditDraft('title', '   ');

      expect(service.saveEdit()).toBe('Accepted memory cards need a title and detail.');
      // The edit stays open — nothing was committed.
      expect(service.editingAcceptedMemoryCardId()).toBe(card.id);
    });

    it('commits a valid edit and closes it', () => {
      const card = acceptOneCard();
      service.beginEdit(card);

      service.updateEditDraft('title', 'Mara, Unmasked');
      service.updateEditDraft('detail', 'Her diplomacy was always a blade in a glove.');

      expect(service.saveEdit()).toBe('Accepted memory card updated.');
      expect(service.editingAcceptedMemoryCardId()).toBeNull();
      expect(service.acceptedMemoryCards()[0].title).toBe('Mara, Unmasked');
      expect(service.acceptedMemoryCards()[0].detail).toBe('Her diplomacy was always a blade in a glove.');
    });

    it('returns null from saveEdit when nothing is being edited', () => {
      expect(service.saveEdit()).toBeNull();
    });

    it('cancelEdit clears the in-progress edit without touching the accepted card', () => {
      const card = acceptOneCard();
      service.beginEdit(card);
      service.updateEditDraft('title', 'Discarded');

      service.cancelEdit();

      expect(service.editingAcceptedMemoryCardId()).toBeNull();
      expect(service.acceptedMemoryCards()[0].title).toBe(card.title);
    });
  });

  describe('moveAccepted', () => {
    it('reorders two accepted cards and no-ops past either end', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({
        characters: [createCharacter()],
        activeThreads: [createThread()]
      }));
      drafts.forEach(draft => service.acceptDraft(draft.id, drafts));
      const [firstId, secondId] = service.acceptedMemoryCards().map(card => card.id);

      service.moveAccepted(secondId, -1);
      expect(service.acceptedMemoryCards().map(card => card.id)).toEqual([secondId, firstId]);

      // Already first: moving up further is a no-op.
      service.moveAccepted(secondId, -1);
      expect(service.acceptedMemoryCards().map(card => card.id)).toEqual([secondId, firstId]);
    });
  });

  describe('deleteAccepted', () => {
    it('removes the card, its pin, and closes its edit if it was open', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      service.pinDraft(drafts[0].id);
      service.acceptDraft(drafts[0].id, drafts);
      const card = service.acceptedMemoryCards()[0];
      service.beginEdit(card);

      service.deleteAccepted(card.id);

      expect(service.acceptedMemoryCards()).toEqual([]);
      expect(service.pinnedMemoryCardDraftIds().has(card.id)).toBeFalse();
      expect(service.editingAcceptedMemoryCardId()).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears pinned drafts, accepted cards, and any in-progress edit', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      service.pinDraft(drafts[0].id);
      service.acceptDraft(drafts[0].id, drafts);
      service.beginEdit(service.acceptedMemoryCards()[0]);

      service.reset();

      expect(service.pinnedMemoryCardDraftIds().size).toBe(0);
      expect(service.acceptedMemoryCards()).toEqual([]);
      expect(service.editingAcceptedMemoryCardId()).toBeNull();
    });
  });

  describe('hydrate and snapshot (save/restore round trip)', () => {
    it('restores well-formed persisted state as-is', () => {
      const persistedCard: StoryMemoryCard = {
        id: 'memory-card-character-char-mara',
        label: 'Character card',
        title: 'Mara',
        detail: 'A vampire diplomat.',
        triggerLabel: 'Trigger: Mara',
        acceptedAt: '2026-01-01T00:00:00.000Z'
      };

      service.hydrate(['memory-card-character-char-mara'], [persistedCard]);

      expect(Array.from(service.pinnedMemoryCardDraftIds())).toEqual(['memory-card-character-char-mara']);
      expect(service.acceptedMemoryCards()).toEqual([persistedCard]);
    });

    it('drops malformed entries rather than restoring them', () => {
      service.hydrate(
        [42, '  ', 'memory-card-thread-thread-truce', null],
        [{ id: 'incomplete' }, 'not-a-card', null]
      );

      expect(Array.from(service.pinnedMemoryCardDraftIds())).toEqual(['memory-card-thread-thread-truce']);
      expect(service.acceptedMemoryCards()).toEqual([]);
    });

    it('tolerates non-array persisted values', () => {
      service.hydrate(undefined, undefined);

      expect(service.pinnedMemoryCardDraftIds().size).toBe(0);
      expect(service.acceptedMemoryCards()).toEqual([]);
    });

    it('snapshot round-trips through hydrate without mutating the live state on edit', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      service.pinDraft(drafts[0].id);
      service.acceptDraft(drafts[0].id, drafts);

      const snapshot = service.snapshot();
      snapshot.acceptedMemoryCards[0].title = 'Mutated in the snapshot only';

      expect(service.acceptedMemoryCards()[0].title).toBe('Mara');

      service.reset();
      service.hydrate(snapshot.pinnedMemoryCardDraftIds, [{
        id: drafts[0].id,
        label: 'Character card',
        title: 'Mara',
        detail: drafts[0].detail,
        triggerLabel: drafts[0].triggerLabel,
        acceptedAt: '2026-01-01T00:00:00.000Z'
      }]);

      expect(service.acceptedMemoryCards()[0].title).toBe('Mara');
    });
  });

  describe('deriveAcceptedContinuationSummary', () => {
    it('is empty with no accepted cards', () => {
      expect(service.deriveAcceptedContinuationSummary()).toBe('');
    });

    it('names up to two accepted cards by title', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({ characters: [createCharacter()] }));
      service.acceptDraft(drafts[0].id, drafts);

      expect(service.deriveAcceptedContinuationSummary()).toBe('1 accepted memory card will be included: Mara.');
    });

    it('collapses a third and later accepted card into a +N count', () => {
      const drafts = service.deriveDrafts(createContinuityPanel({
        characters: [createCharacter()],
        activeThreads: [createThread()],
        unresolvedArtifacts: [createArtifact()]
      }));
      drafts.forEach(draft => service.acceptDraft(draft.id, drafts));

      expect(service.deriveAcceptedContinuationSummary())
        .toBe('3 accepted memory cards will be included: Mara, The dawn truce +1.');
    });
  });

  describe('formatBrief', () => {
    it('formats a card as a single prompt-ready line', () => {
      const line = service.formatBrief({
        label: 'Character card',
        title: 'Mara',
        detail: 'A vampire diplomat.',
        triggerLabel: 'Trigger: Mara'
      });

      expect(line).toBe('- Character card: Mara. A vampire diplomat. Trigger: Mara.');
    });
  });
});
