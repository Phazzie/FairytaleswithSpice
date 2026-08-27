#!/usr/bin/env tsx
// Created: 2026-08-27 UTC

/**
 * The four vocabularies a continuity state is written in, and the one table
 * each of them now has.
 *
 * A character's archetype, a thread's status, a thread or artifact's lifetime,
 * and a relationship edge's kind were the last closed sets in the Angular
 * contract declared as inline unions with no runtime list anywhere. Every
 * reader that had to *check* one of them wrote the list out again:
 * `continuityExtractor.ts` alone held four such copies — three chains of
 * `value === '…' || value === '…'` and a `Set` of bare strings — and
 * `shared/continuityActivation.ts` a fifth, declaring the thread statuses as
 * its own union because it sits below the Angular tree and could not reach the
 * contract's.
 *
 * Copies of a closed set fail differently here than they do at a route. The
 * extractor does not reject an unrecognised value; it drops it and keeps
 * whatever the state already held. So a vocabulary the extractor has fallen
 * behind on does not produce an error — it produces a continuity fact the model
 * reported correctly and the state silently refused, which is invisible in
 * exactly the way this repository has learned to watch for.
 *
 * This file pins the three properties that keep that from coming back: the
 * merge accepts every value in each table, it drops values outside them, and
 * the prompt that asks the model for these fields names the tables it will be
 * checked against — the half that stops the model proposing values that can
 * only be thrown away.
 */

import { assert } from './assert';
import {
  CHARACTER_ARCHETYPES,
  PLOT_THREAD_STATUSES,
  RELATIONSHIP_KINDS,
  STORY_MEMORY_LIFETIMES,
  isVocabularyMember
} from '../shared/storyStateVocabulary';
import { formatThreadDebtLabel } from '../shared/continuityActivation';
import { SPICY_LEVELS } from '../api/_lib/story-lab/contracts';
import type { StoryStateSnapshot } from '../api/_lib/story-lab/contracts';
import { buildContinuityPrompt, mergeAiContinuity } from '../api/_lib/story-lab/continuityExtractor';

const now = '2026-08-27T00:00:00.000Z';

function emptyState(): StoryStateSnapshot {
  return {
    storyId: 'story-vocabulary',
    revision: 1,
    characters: [],
    threads: [],
    artifacts: [],
    beats: [],
    continuityWarnings: [],
    narrativeVoice: 'Third person, close.',
    lastUpdatedAt: now
  };
}

// ==================== The tables are the sets they describe ====================

assert(
  isVocabularyMember(CHARACTER_ARCHETYPES, 'protagonist')
  && !isVocabularyMember(CHARACTER_ARCHETYPES, 'love_interest'),
  'the membership predicate should answer for the table it is given'
);
assert(
  !isVocabularyMember(PLOT_THREAD_STATUSES, undefined)
  && !isVocabularyMember(PLOT_THREAD_STATUSES, 3),
  'a value that is not a string is not a member of a string vocabulary'
);

// `formatThreadDebtLabel` used to name three statuses and fall through for the
// fourth, and this file asserted `PLOT_THREAD_STATUSES.length === 4` to say so
// — a test standing in for a guarantee the language can make. It reads a total
// `Record` keyed by the union now, so a fifth status fails to compile rather
// than inheriting a label. What is left to prove at runtime is that every
// status has a *distinct*, non-empty label: a `Record` is total whatever is
// written in it, and two statuses sharing a line is the same failure the
// fall-through was.
const threadDebtLabels = PLOT_THREAD_STATUSES.map(status => formatThreadDebtLabel(status));
assert(
  threadDebtLabels.every(label => label.trim().length > 0)
  && new Set(threadDebtLabels).size === PLOT_THREAD_STATUSES.length,
  `every thread status should have its own label (got ${JSON.stringify(threadDebtLabels)})`
);
assert(
  formatThreadDebtLabel('escalating') === 'Pressure rising'
  && formatThreadDebtLabel('dormant') === 'Quiet promise'
  && formatThreadDebtLabel('active') === 'Open promise',
  'each named status should keep its label'
);
// The status both callers filter out before the label is reached. It said
// "Open promise" under the fall-through, so the one way it could ever be
// rendered was to announce a paid-off thread as one the story still owes.
assert(
  formatThreadDebtLabel('resolved') === 'Paid promise',
  'a resolved thread should not be labelled as an open promise'
);

// ==================== Every table value survives the merge ====================

for (const archetype of CHARACTER_ARCHETYPES) {
  const merged = mergeAiContinuity(emptyState(), {
    characters: [{ id: 'character-1', displayName: 'Mira', archetype }]
  }, now);

  assert(
    merged.characters[0]?.archetype === archetype,
    `the merge should accept the archetype "${archetype}" its own table lists`
  );
}

for (const status of PLOT_THREAD_STATUSES) {
  const merged = mergeAiContinuity(emptyState(), {
    threads: [{ id: 'thread-1', label: 'The blood oath', status }]
  }, now);

  assert(
    merged.threads[0]?.status === status,
    `the merge should accept the thread status "${status}" its own table lists`
  );
}

for (const lifetime of STORY_MEMORY_LIFETIMES) {
  const merged = mergeAiContinuity(emptyState(), {
    threads: [{ id: 'thread-1', label: 'The blood oath', lifetime }]
  }, now);

  assert(
    merged.threads[0]?.lifetime === lifetime,
    `the merge should accept the lifetime "${lifetime}" its own table lists`
  );
}

for (const relationship of RELATIONSHIP_KINDS) {
  const merged = mergeAiContinuity(emptyState(), {
    characters: [{
      id: 'character-1',
      displayName: 'Mira',
      relationships: [{ characterId: 'character-2', relationship, notes: '' }]
    }]
  }, now);

  assert(
    merged.characters[0]?.relationships[0]?.relationship === relationship,
    `the merge should accept the relationship kind "${relationship}" its own table lists`
  );
}

for (const level of SPICY_LEVELS) {
  const merged = mergeAiContinuity(emptyState(), {
    characters: [{ id: 'character-1', displayName: 'Mira', spiceCompatibilities: [level] }]
  }, now);

  assert(
    merged.characters[0]?.spiceCompatibilities[0] === level,
    `the merge should accept the spice level ${level} the shared table lists`
  );
}

// ==================== And nothing outside them does ====================

const withStrangers = mergeAiContinuity(emptyState(), {
  characters: [{
    id: 'character-1',
    displayName: 'Mira',
    archetype: 'love_interest' as never,
    spiceCompatibilities: [9 as never],
    relationships: [{ characterId: 'character-2', relationship: 'mentor' as never, notes: '' }]
  }],
  threads: [{
    id: 'thread-1',
    label: 'The blood oath',
    status: 'open' as never,
    lifetime: 'arc' as never
  }]
}, now);

assert(
  withStrangers.characters[0]?.archetype === 'supporting',
  'an archetype outside the table falls back to the default rather than being stored'
);
assert(
  withStrangers.characters[0]?.relationships.length === 0,
  'a relationship kind outside the table is dropped rather than stored under a type that forbids it'
);
assert(
  withStrangers.characters[0]?.spiceCompatibilities.join() === '3',
  'a spice level outside the scale is dropped, leaving the middle-of-the-scale default'
);

// ==================== Dropping the bad value does not take the good state ====================
//
// Refusing an unrecognised value is only half of it. The other half is what the
// refusal costs, and for the two array fields it used to cost the state: an
// array whose entries were *all* refused satisfied `Array.isArray`, filtered
// down to nothing, and the empty list was stored — so a model answering the one
// edge `relationship: "mentor"` cleared a `lover` edge the story had actually
// established. That is this file's whole thesis failing one level up, and the
// fixtures below are the case that proves it rather than the shape of it.

function stateWithRelationship(): StoryStateSnapshot {
  return {
    ...emptyState(),
    characters: [{
      id: 'character-1',
      displayName: 'Mira',
      archetype: 'protagonist',
      summary: 'Anchors the story.',
      currentGoal: 'Keep the oath.',
      internalConflict: 'Desire against duty.',
      externalConflict: 'The court refuses her.',
      secrets: [],
      relationships: [{ characterId: 'character-2', relationship: 'lover', notes: 'bound by oath' }],
      spiceCompatibilities: [3]
    }]
  };
}

function mergedRelationships(relationships: unknown): string {
  const merged = mergeAiContinuity(stateWithRelationship(), {
    characters: [{
      id: 'character-1',
      displayName: 'Mira',
      ...(relationships === undefined ? {} : { relationships: relationships as never })
    }]
  }, now);

  return JSON.stringify(merged.characters[0]?.relationships);
}

const establishedEdge = JSON.stringify([{ characterId: 'character-2', relationship: 'lover', notes: 'bound by oath' }]);

assert(
  mergedRelationships([{ characterId: 'character-2', relationship: 'mentor' }]) === establishedEdge,
  'an edge whose kind is outside the table must not clear the relationships the story established'
);
assert(
  mergedRelationships([null, 'character-2', {}]) === establishedEdge,
  'entries that are not edges at all must not clear the relationships the story established'
);
assert(
  mergedRelationships(undefined) === establishedEdge,
  'omitting relationships leaves the established ones alone'
);

// The distinction the fallback turns on, asserted in both directions: an array
// that arrives empty is the model reporting that this character has no
// relationships, which it is allowed to say, and that still clears.
assert(
  mergedRelationships([]) === '[]',
  'an empty array is a report of no relationships and still clears them'
);
assert(
  mergedRelationships([
    { characterId: 'character-2', relationship: 'mentor' },
    { characterId: 'character-3', relationship: 'rival', notes: 'n' }
  ]) === JSON.stringify([{ characterId: 'character-3', relationship: 'rival', notes: 'n' }]),
  'a partly valid array keeps what survived rather than falling back to the previous edges'
);
assert(
  withStrangers.threads[0]?.status === 'active',
  'a thread status outside the table falls back to the default rather than being stored'
);
assert(
  withStrangers.threads[0]?.lifetime === undefined,
  'a lifetime outside the table is left unset rather than stored'
);

// ==================== The prompt names what the merge will check ====================

const prompt = buildContinuityPrompt({
  storyId: 'story-vocabulary',
  currentState: emptyState(),
  chapters: [{
    chapterNumber: 1,
    title: 'The oath',
    htmlContent: '<p>Mira pressed the blood oath into the door.</p>',
    wordCount: 8,
    themeTags: [],
    cliffhanger: 'The door answered.',
    spiceLevel: 3,
    generatedAt: now
  }],
  summary: {
    storyId: 'story-vocabulary',
    title: 'The oath',
    synopsis: 'A vampire keeps a promise.',
    tone: 'dark_romance',
    spicyLevel: 3,
    createdAt: now
  },
  useAi: true
});

// Read back through `JSON.parse`, not by substring: the prompt is a JSON
// document, and what matters is that the model is handed these lists as values
// under the field paths the merge checks — not that the words appear somewhere
// in the text.
const promptShape = JSON.parse(prompt) as { allowedValues?: Record<string, unknown> };
const allowedValues = promptShape.allowedValues ?? {};

for (const [path, expected] of [
  ['characters[].archetype', CHARACTER_ARCHETYPES],
  ['characters[].spiceCompatibilities[]', SPICY_LEVELS],
  ['characters[].relationships[].relationship', RELATIONSHIP_KINDS],
  ['threads[].status', PLOT_THREAD_STATUSES],
  ['threads[].lifetime and artifacts[].lifetime', STORY_MEMORY_LIFETIMES]
] as const) {
  assert(
    JSON.stringify(allowedValues[path]) === JSON.stringify([...expected]),
    `the prompt should offer "${path}" exactly the values the merge accepts for it`
  );
}

// ==================== A refused list does not delete the one it replaces ====================

// `relationshipEdges` and `spiceLevels` distinguish an array that arrives empty
// from one whose entries were all refused; `arrayOfStrings` — the reader behind
// `secrets` and `foreshadowedDevices` — did not, so a model answering in the
// shape it found natural cleared facts it was asked to add to.
const withKeptSecrets = mergeAiContinuity({
  ...emptyState(),
  characters: [{
    id: 'character-1',
    displayName: 'Mira',
    archetype: 'protagonist',
    summary: 's',
    currentGoal: 'g',
    internalConflict: 'i',
    externalConflict: 'e',
    secrets: ['She was there that night'],
    relationships: [],
    spiceCompatibilities: [3]
  }],
  threads: [{
    id: 'thread-1',
    label: 'The oath',
    status: 'active',
    description: 'd',
    foreshadowedDevices: ['the sealed door']
  }]
}, {
  characters: [{
    id: 'character-1',
    displayName: 'Mira',
    // The three shapes a model reaches for when asked for a list of short
    // prose, none of them a string.
    secrets: [{ secret: 'She was there that night' }, null, ['the pact']] as unknown as string[]
  }],
  threads: [{ id: 'thread-1', label: 'The oath', foreshadowedDevices: [null] as unknown as string[] }]
}, now);

assert(
  JSON.stringify(withKeptSecrets.characters[0]?.secrets) === JSON.stringify(['She was there that night']),
  'an all-refused secrets array should keep the secrets the state already held'
);
assert(
  JSON.stringify(withKeptSecrets.threads[0]?.foreshadowedDevices) === JSON.stringify(['the sealed door']),
  'an all-refused device array should keep the devices the state already held'
);

const withClearedSecrets = mergeAiContinuity({
  ...emptyState(),
  characters: [{
    id: 'character-1',
    displayName: 'Mira',
    archetype: 'protagonist',
    summary: 's',
    currentGoal: 'g',
    internalConflict: 'i',
    externalConflict: 'e',
    secrets: ['She was there that night'],
    relationships: [],
    spiceCompatibilities: [3]
  }]
}, {
  characters: [{ id: 'character-1', displayName: 'Mira', secrets: [] }]
}, now);

// The other half of the rule, and the reason it is not simply "never clear":
// `[]` is the model reporting that this character keeps nothing, which is a
// fact it is allowed to report.
assert(
  JSON.stringify(withClearedSecrets.characters[0]?.secrets) === JSON.stringify([]),
  'an empty secrets array is the model reporting no secrets and should still clear'
);

console.log('story-state vocabulary checks passed');
