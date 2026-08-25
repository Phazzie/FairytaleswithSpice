#!/usr/bin/env tsx
// Created: 2026-08-25 10:05 UTC

import {
  mergeAiContinuity,
  type AiContinuityShape
} from '../api/_lib/story-lab/continuityExtractor';
import type { StoryStateSnapshot } from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const STORY_ID = 'story-continuity-merge';
const NOW = '2026-08-25T10:05:00.000Z';

function emptyState(): StoryStateSnapshot {
  return {
    storyId: STORY_ID,
    revision: 1,
    characters: [],
    threads: [],
    artifacts: [],
    narrativeVoice: 'tense romantic fantasy',
    continuityWarnings: [],
    lastUpdatedAt: NOW
  };
}

function mergeNames(shape: AiContinuityShape): StoryStateSnapshot {
  return mergeAiContinuity(emptyState(), shape, NOW);
}

/**
 * The id a name is slugged into is the key the merge deduplicates on, so two
 * different names sharing one id are stored as one character rather than two.
 * Deleting every non-ASCII character left a cast named in any other script with
 * no slug body at all, so all of them collapsed onto the bare `character-`
 * prefix and the state carried a single entry wearing whichever name the model
 * mentioned last.
 */
function testNonAsciiNamesStayDistinct(): void {
  const state = mergeNames({
    characters: [
      { displayName: 'Мира' },
      { displayName: '美咲' },
      { displayName: 'Ελένη' }
    ]
  });

  assert(
    state.characters.length === 3,
    `three differently named characters should stay three (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    new Set(state.characters.map(character => character.id)).size === 3,
    `their ids should differ (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters.every(character => character.id !== 'character-'),
    `no id should be the bare prefix (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters.some(character => character.id === 'character-мира'),
    `a Cyrillic name should stay legible in its id (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
}

/** Threads and artifacts are slugged by the same function, so they collided the same way. */
function testThreadsAndArtifactsStayDistinct(): void {
  const state = mergeNames({
    threads: [{ label: 'Клятва' }, { label: '契約' }],
    artifacts: [{ name: 'Кинжал' }, { name: '鏡' }]
  });

  assert(
    new Set(state.threads.map(thread => thread.id)).size === 2,
    `two differently labelled threads should keep two ids (got ${JSON.stringify(state.threads.map(thread => thread.id))})`
  );
  assert(
    new Set(state.artifacts.map(artifact => artifact.id)).size === 2,
    `two differently named artifacts should keep two ids (got ${JSON.stringify(state.artifacts.map(artifact => artifact.id))})`
  );
}

/**
 * A name with nothing to slug at all still has to land somewhere distinct: the
 * digest fallback is unreadable but keeps the merge honest.
 */
function testNamesWithNoSluggableCharactersStayDistinct(): void {
  const state = mergeNames({
    characters: [{ displayName: '???' }, { displayName: '!!!' }]
  });

  assert(
    new Set(state.characters.map(character => character.id)).size === 2,
    `punctuation-only names should not merge into one character (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
}

/** ASCII names keep the readable, stable ids they always had. */
function testAsciiNamesKeepTheirExistingIds(): void {
  const state = mergeNames({
    characters: [{ displayName: 'Mira Vale' }],
    threads: [{ label: 'The Blood Oath' }]
  });

  assert(
    state.characters[0]?.id === 'character-mira-vale',
    `an ASCII name should slug exactly as before (got ${state.characters[0]?.id})`
  );
  assert(
    state.threads[0]?.id === 'thread-the-blood-oath',
    `an ASCII label should slug exactly as before (got ${state.threads[0]?.id})`
  );
}

/** A model-supplied id still wins, and the same name merges onto itself. */
function testExplicitIdsAndRepeatedNamesStillMerge(): void {
  const state = mergeNames({
    characters: [
      { id: 'character-fixed', displayName: 'Мира' },
      { displayName: 'Мира', summary: 'Second mention of the same character.' },
      { displayName: 'Мира', currentGoal: 'Break the oath.' }
    ]
  });

  assert(
    state.characters.length === 2,
    `the two unnamed-id mentions of one name should merge (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters.some(character => character.id === 'character-fixed'),
    'an id the model supplied should be preserved'
  );
}

function main(): void {
  testNonAsciiNamesStayDistinct();
  testThreadsAndArtifactsStayDistinct();
  testNamesWithNoSluggableCharactersStayDistinct();
  testAsciiNamesKeepTheirExistingIds();
  testExplicitIdsAndRepeatedNamesStillMerge();

  console.log('Story Lab continuity merge tests passed');
}

main();
