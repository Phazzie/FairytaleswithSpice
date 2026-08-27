#!/usr/bin/env tsx
// Created: 2026-08-27 04:00 UTC

/**
 * Direct, no-AI unit coverage for `storyStateBuilder.ts` — the pure
 * state-snapshot/delta-merge logic every Story Lab genesis and continuation
 * request is built from and read back against (characters, plot threads,
 * world artifacts, beats, deltas).
 *
 * This module was extracted out of `storyLabEngine.ts` in #267 alongside
 * `continuationGuidance.ts`, but only `continuationGuidance.ts` got a direct
 * test file there — this one was reachable only indirectly through
 * `story-lab-real-engine.test.ts`, which exercises it solely through the two
 * route entry points.
 */

import {
  buildChapterDelta,
  buildStateDelta,
  buildStateSnapshot
} from '../api/_lib/story-lab/storyStateBuilder';
import type {
  ChapterDelta,
  GeneratedChapter,
  StoryGenerationSeam,
  StoryStateSnapshot
} from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const STORY_ID = 'story-state-builder';
const NOW = '2026-08-27T04:00:00.000Z';

function baseInput(overrides: Partial<StoryGenerationSeam['input']> = {}): StoryGenerationSeam['input'] {
  return {
    creature: 'vampire',
    themes: [
      { id: 'forbidden_love', label: 'Forbidden Love', description: 'Star-crossed lovers defy their courts.' }
    ],
    logline: 'A vampire envoy must betray her court to save a mortal lover.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black'
    },
    chapterBatchSize: 1,
    ...overrides
  };
}

function emptyDelta(overrides: Partial<ChapterDelta> = {}): ChapterDelta {
  return {
    introducedCharacters: [],
    resolvedThreads: [],
    escalatedThreads: [],
    foreshadowedArtifacts: [],
    continuityFlags: [],
    ...overrides
  };
}

function chapter(chapterNumber: number, overrides: Partial<GeneratedChapter> = {}): GeneratedChapter {
  return {
    chapterId: `${STORY_ID}-chapter-${chapterNumber}`,
    chapterNumber,
    title: `Chapter ${chapterNumber}`,
    htmlContent: `<p>Chapter ${chapterNumber} content.</p>`,
    summary: `Summary of chapter ${chapterNumber}.`,
    wordCount: 900,
    hasCliffhanger: false,
    delta: emptyDelta(),
    ...overrides
  };
}

function baseState(overrides: Partial<StoryStateSnapshot> = {}): StoryStateSnapshot {
  return {
    storyId: STORY_ID,
    revision: 1,
    characters: [],
    threads: [
      {
        id: 'thread-binding-debt',
        label: 'The binding debt',
        status: 'active',
        description: 'Mira owes the manor a debt she has not yet paid.',
        foreshadowedDevices: [],
        lifetime: 'series'
      },
      {
        id: 'thread-quiet-oath',
        label: 'The quiet oath',
        status: 'escalating',
        description: 'An old promise nobody has mentioned in chapters.',
        foreshadowedDevices: [],
        lifetime: 'series'
      }
    ],
    artifacts: [],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'dark romance',
    lastUpdatedAt: NOW,
    ...overrides
  };
}

/**
 * Genesis path (`input` supplied, `previousState` null): builds initial
 * characters/threads from the blueprint and starts at revision 1.
 */
function testGenesisBuildsInitialCharactersAndThreads(): void {
  const input = baseInput({ protagonistName: 'Mira', antagonistName: 'Corvin' });
  const state = buildStateSnapshot(input, STORY_ID, [], null, NOW);

  assert(state.revision === 1, `expected revision 1, got ${state.revision}`);

  const protagonist = state.characters.find(character => character.archetype === 'protagonist');
  const antagonist = state.characters.find(character => character.archetype === 'antagonist');
  assert(protagonist?.displayName === 'Mira', `expected protagonist named Mira, got ${JSON.stringify(protagonist)}`);
  assert(antagonist?.displayName === 'Corvin', `expected antagonist named Corvin, got ${JSON.stringify(antagonist)}`);
  assert(
    protagonist?.relationships.some(edge => edge.characterId === antagonist?.id),
    'expected the protagonist to carry a relationship edge to the antagonist'
  );

  assert(state.threads.length === 1, `expected one thread from the one theme seed, got ${state.threads.length}`);
  assert(state.threads[0].label === 'Forbidden Love', `expected thread labeled from the theme, got ${state.threads[0].label}`);

  assert(state.narrativeVoice === 'dark romance', `expected 'dark_romance' to render as 'dark romance', got ${state.narrativeVoice}`);
}

/**
 * Without an antagonist name or themes, the builder falls back to a default
 * protagonist label and a single generic "Central romance" thread instead of
 * an empty thread list.
 */
function testGenesisFallsBackWithoutAntagonistOrThemes(): void {
  const input = baseInput({ themes: [], protagonistName: undefined, antagonistName: undefined });
  const state = buildStateSnapshot(input, STORY_ID, [], null, NOW);

  assert(state.characters.length === 1, `expected only a protagonist with no antagonist name, got ${state.characters.length}`);
  assert(
    state.characters[0].displayName === 'Vampire protagonist',
    `expected a creature-derived fallback name, got ${state.characters[0].displayName}`
  );
  assert(state.threads.length === 1 && state.threads[0].label === 'Central romance',
    `expected the untitled-theme fallback thread, got ${JSON.stringify(state.threads)}`);
  assert(state.artifacts.length === 0, 'expected no world artifact when worldDetails is absent');
}

/**
 * World-details text derives a short lore-artifact name via a few pattern
 * heuristics, each with its own fallback.
 */
function testWorldArtifactNameDerivation(): void {
  const byCase = buildStateSnapshot(
    baseInput({ worldDetails: "A locked vault, guarded by the coven's eldest daughter." }),
    STORY_ID, [], null, NOW
  );
  assert(
    byCase.artifacts[0]?.name === "Coven's Eldest Daughter",
    `expected the "guarded by X" pattern to name the artifact after its object, got ${byCase.artifacts[0]?.name}`
  );

  const genericCase = buildStateSnapshot(
    baseInput({ worldDetails: 'An ancient silver locket.' }),
    STORY_ID, [], null, NOW
  );
  assert(
    genericCase.artifacts[0]?.name === 'Ancient Silver Locket',
    `expected the generic fallback to title-case the stripped phrase, got ${genericCase.artifacts[0]?.name}`
  );

  const degenerateCase = buildStateSnapshot(
    baseInput({ worldDetails: ' . ' }),
    STORY_ID, [], null, NOW
  );
  assert(
    degenerateCase.artifacts[0]?.name === 'World Texture',
    `expected the empty-after-cleanup fallback "World Texture", got ${degenerateCase.artifacts[0]?.name}`
  );
}

/**
 * Continuation path (`input` undefined, `previousState` supplied): carries
 * the previous state forward, increments revision, and merges in what the
 * new chapters' deltas report rather than rebuilding from a blueprint.
 */
function testContinuationCarriesForwardAndIncrementsRevision(): void {
  const previousState = baseState({ revision: 3 });
  const newCharacter = {
    id: 'character-new-ally',
    displayName: 'Sable',
    archetype: 'supporting' as const,
    summary: 'A newly introduced ally.',
    currentGoal: 'Protect Mira.',
    internalConflict: 'Loyalty versus self-preservation.',
    externalConflict: 'The court suspects her.',
    secrets: [],
    relationships: [],
    spiceCompatibilities: [3 as const]
  };

  const chapters = [chapter(4, { delta: emptyDelta({ introducedCharacters: [newCharacter] }) })];
  const state = buildStateSnapshot(undefined, STORY_ID, chapters, previousState, NOW);

  assert(state.revision === 4, `expected revision to increment from 3 to 4, got ${state.revision}`);
  assert(state.narrativeVoice === 'dark romance', 'expected narrativeVoice to carry forward when no input blueprint is supplied');
  assert(
    state.characters.some(character => character.id === 'character-new-ally'),
    'expected the chapter-introduced character to be merged into state'
  );
}

/**
 * `mergeThreads` must apply both directions `buildStateDelta` reports:
 * escalation for `escalatedThreads` (already covered) and resolution for
 * `resolvedThreads` (the gap this PR closes) so the persisted snapshot
 * matches the delta describing it, and a resolved thread stops counting as
 * "unresolved" for every downstream reader (`continuationGuidance.ts`'s
 * `isUnresolvedThread`) on every subsequent request.
 */
function testResolvedThreadsAreMarkedResolvedInTheSnapshot(): void {
  const previousState = baseState();
  const chapters = [chapter(3, {
    delta: emptyDelta({
      resolvedThreads: ['thread-binding-debt'],
      escalatedThreads: ['thread-quiet-oath']
    })
  })];

  const state = buildStateSnapshot(undefined, STORY_ID, chapters, previousState, NOW);

  const resolved = state.threads.find(thread => thread.id === 'thread-binding-debt');
  const escalated = state.threads.find(thread => thread.id === 'thread-quiet-oath');
  assert(resolved?.status === 'resolved', `expected thread-binding-debt to be marked resolved, got ${resolved?.status}`);
  assert(escalated?.status === 'escalating', `expected thread-quiet-oath to stay escalating, got ${escalated?.status}`);
}

/**
 * A thread already resolved must not be reopened by a later escalation flag
 * — mirrors the guard `mergeThreads` already had for escalation, now also
 * checked against resolution taking priority when a chapter reports both for
 * the same thread id.
 */
function testResolutionTakesPriorityOverEscalationForTheSameThread(): void {
  const previousState = baseState();
  const chapters = [chapter(3, {
    delta: emptyDelta({
      resolvedThreads: ['thread-binding-debt'],
      escalatedThreads: ['thread-binding-debt']
    })
  })];

  const state = buildStateSnapshot(undefined, STORY_ID, chapters, previousState, NOW);
  const thread = state.threads.find(candidate => candidate.id === 'thread-binding-debt');
  assert(thread?.status === 'resolved', `expected resolution to win when both are reported, got ${thread?.status}`);
}

/**
 * `buildChapterDelta`'s continuity flag only fires on a batch boundary
 * (`chapterNumber % batchSize === 0`, with `batchSize > 1`), not on every
 * chapter and not for single-chapter batches.
 */
function testChapterDeltaFlagsOnlyAtBatchBoundary(): void {
  const withinBatch = buildChapterDelta(STORY_ID, 2, 3, false);
  const atBoundary = buildChapterDelta(STORY_ID, 3, 3, false);
  const singleChapterBatch = buildChapterDelta(STORY_ID, 3, 1, false);

  assert(withinBatch.continuityFlags.length === 0, 'expected no flag mid-batch');
  assert(atBoundary.continuityFlags.length === 1, 'expected a flag exactly at the batch boundary');
  assert(singleChapterBatch.continuityFlags.length === 0, 'expected no flag when batchSize is 1');
}

/**
 * `buildStateDelta`'s `fromRevision` reflects a genuine genesis (`null`)
 * versus a continuation (the previous snapshot's revision), and its
 * `escalatedThreads` is read back off the *new* state, not the chapter delta
 * directly, so it carries the merged thread objects rather than bare ids.
 */
function testStateDeltaRevisionAndEscalatedThreads(): void {
  const chapters = [chapter(1, { delta: emptyDelta({ escalatedThreads: ['thread-binding-debt'] }) })];
  const state = buildStateSnapshot(undefined, STORY_ID, chapters, baseState(), NOW);

  const genesisDelta = buildStateDelta(STORY_ID, null, state, chapters);
  assert(genesisDelta.fromRevision === null, 'expected fromRevision null for a genesis delta');

  const previousState = baseState();
  const continuationDelta = buildStateDelta(STORY_ID, previousState, state, chapters);
  assert(
    continuationDelta.fromRevision === previousState.revision,
    `expected fromRevision to be the previous snapshot's revision, got ${continuationDelta.fromRevision}`
  );
  assert(
    continuationDelta.escalatedThreads.some(thread => thread.id === 'thread-binding-debt'),
    'expected the escalated thread object to appear in the delta'
  );
}

function main(): void {
  testGenesisBuildsInitialCharactersAndThreads();
  testGenesisFallsBackWithoutAntagonistOrThemes();
  testWorldArtifactNameDerivation();
  testContinuationCarriesForwardAndIncrementsRevision();
  testResolvedThreadsAreMarkedResolvedInTheSnapshot();
  testResolutionTakesPriorityOverEscalationForTheSameThread();
  testChapterDeltaFlagsOnlyAtBatchBoundary();
  testStateDeltaRevisionAndEscalatedThreads();

  console.log('Story Lab state builder tests passed');
}

main();
