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

// `formatThreadDebtLabel` names three statuses and falls through for the
// fourth, which is only correct while there are exactly four. It reads the
// union derived from this table now, so the table is what keeps it honest.
assert(
  PLOT_THREAD_STATUSES.length === 4,
  'the thread-debt label falls through for its fourth status; a fifth needs its own branch'
);
assert(
  formatThreadDebtLabel('escalating') === 'Pressure rising'
  && formatThreadDebtLabel('dormant') === 'Quiet promise'
  && formatThreadDebtLabel('active') === 'Open promise',
  'each named status should keep its label'
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

console.log('story-state vocabulary checks passed');
