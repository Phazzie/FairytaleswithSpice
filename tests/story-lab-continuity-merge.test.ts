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

/**
 * A combining mark belongs to the word it is attached to, not between words.
 *
 * Reading marks as separators cut a Devanagari or Thai name apart at every
 * vowel sign, which is the same collapse the ASCII-only pattern caused one step
 * in: `मीरा` and `मिरा` differ only in their vowel sign, so both slugged to the
 * same `म-र` and the merge kept one character for two.
 */
function testCombiningMarksStayInsideTheirWord(): void {
  const state = mergeNames({
    characters: [{ displayName: 'मीरा' }, { displayName: 'मिरा' }],
    threads: [{ label: 'เรื่องของฉัน' }]
  });

  assert(
    new Set(state.characters.map(character => character.id)).size === 2,
    `two names differing only in a vowel sign should keep two ids (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters.some(character => character.id === 'character-मीरा'),
    `a Devanagari name should keep its marks in its id (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.threads[0]?.id === 'thread-เรื่องของฉัน',
    `a Thai label should keep its tone marks in its id (got ${state.threads[0]?.id})`
  );
}

/**
 * The merge exists to fold a re-mentioned name back into the entry it already
 * has, and `é` written as one code point and as `e` plus a combining acute are
 * different strings. Without normalizing, one character mentioned across two
 * batches became two half-populated entries in the state the next continuation
 * prompt is built from.
 */
function testEquivalentSpellingsOfOneNameMerge(): void {
  // Written as escapes so the two spellings survive any editor or tool that
  // normalizes this file: they have to be different strings for the test to be
  // testing anything.
  const precomposed = 'Jos\u00E9';
  const decomposed = 'Jose\u0301';
  assert(precomposed !== decomposed, 'the two spellings must be different strings');

  const state = mergeNames({
    characters: [
      { displayName: precomposed, summary: 'Precomposed mention.' },
      { displayName: decomposed, currentGoal: 'Decomposed mention.' }
    ]
  });

  assert(
    state.characters.length === 1,
    `both spellings of one name should merge (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters[0]?.id === 'character-josé',
    `the merged id should be the normalized spelling (got ${state.characters[0]?.id})`
  );
}

/**
 * A mark left on its own is not a word. An emoji carries a variation selector,
 * which is a nonspacing mark, so retaining marks must not turn `❤️` into a slug
 * of one invisible character that every other emoji name also collides with.
 */
function testMarkOnlyNamesStillReachTheDigest(): void {
  const state = mergeNames({
    characters: [{ displayName: '❤️' }, { displayName: '🌙' }]
  });

  assert(
    new Set(state.characters.map(character => character.id)).size === 2,
    `emoji-only names should not merge into one character (got ${JSON.stringify(state.characters.map(character => character.id))})`
  );
  assert(
    state.characters.every(character => /^character-[0-9a-f]{12}$/.test(character.id)),
    `an emoji-only name should fall back to a digest id (got ${JSON.stringify(state.characters.map(character => character.id))})`
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

/**
 * `relationships` and `spiceCompatibilities` were cast rather than checked, so
 * `Array.isArray` was the whole guard and the array's contents were whatever
 * the model wrote. The Angular continuity panel iterates the stored edges and
 * reads `relationship.characterId` off each one with no guard of its own, so a
 * `null` in that array is a `TypeError` thrown while rendering it.
 */
function testMalformedRelationshipEdgesAreDropped(): void {
  const state = mergeNames({
    characters: [
      {
        displayName: 'Mira',
        relationships: [
          null,
          'Dorian',
          { characterId: 'character-dorian' },
          { characterId: 'character-dorian', relationship: 'mentor' },
          { characterId: '   ', relationship: 'lover', notes: 'blank id' },
          { characterId: ' character-dorian ', relationship: 'lover', notes: '  Sworn enemies.  ' }
        ] as never
      }
    ]
  });

  const [character] = state.characters;
  assert(
    character.relationships.length === 1,
    `only the well-formed edge should survive (got ${JSON.stringify(character.relationships)})`
  );
  assert(
    character.relationships[0].characterId === 'character-dorian'
      && character.relationships[0].relationship === 'lover'
      && character.relationships[0].notes === 'Sworn enemies.',
    `the surviving edge should be trimmed and typed (got ${JSON.stringify(character.relationships[0])})`
  );
  assert(
    character.relationships.every(edge => edge && typeof edge === 'object'),
    'no entry that a panel would dereference should be null'
  );
}

/**
 * `spiceCompatibilities` is a `SpicyLevel[]` — the `1 | 2 | 3 | 4 | 5` union the
 * whole app is dialled in. `[0]`, `[9]`, and `["3"]` all satisfied the old
 * `Array.isArray` cast and were stored as levels under a type saying they
 * cannot be.
 */
function testSpiceCompatibilitiesStayInsideTheScale(): void {
  const state = mergeNames({
    characters: [
      { displayName: 'Mira', spiceCompatibilities: [0, 3, '4', 9, 5, 3] as never },
      { displayName: 'Dorian', spiceCompatibilities: ['hot', null] as never },
      { displayName: 'Elena' }
    ]
  });

  const byName = new Map(state.characters.map(character => [character.displayName, character]));
  assert(
    JSON.stringify(byName.get('Mira')?.spiceCompatibilities) === JSON.stringify([3, 5]),
    `out-of-scale levels should be dropped and duplicates collapsed (got ${JSON.stringify(byName.get('Mira')?.spiceCompatibilities)})`
  );
  assert(
    JSON.stringify(byName.get('Dorian')?.spiceCompatibilities) === JSON.stringify([3]),
    `an array holding no usable level should fall back to the default (got ${JSON.stringify(byName.get('Dorian')?.spiceCompatibilities)})`
  );
  assert(
    JSON.stringify(byName.get('Elena')?.spiceCompatibilities) === JSON.stringify([3]),
    'a character the model gave no compatibility for should keep the default'
  );
}

/**
 * The fallback path has to stay intact: a continuation whose model output says
 * nothing about a character's edges must not erase the edges already stored.
 */
function testExistingEdgesSurviveASilentUpdate(): void {
  const first = mergeNames({
    characters: [
      {
        id: 'character-mira',
        displayName: 'Mira',
        relationships: [{ characterId: 'character-dorian', relationship: 'rival', notes: 'Court debt.' }],
        spiceCompatibilities: [4, 5]
      }
    ]
  });

  const second = mergeAiContinuity(
    first,
    { characters: [{ id: 'character-mira', displayName: 'Mira', currentGoal: 'Break the oath.' }] },
    NOW
  );

  const [character] = second.characters;
  assert(
    character.relationships.length === 1 && character.relationships[0].relationship === 'rival',
    `stored edges should survive an update that does not mention them (got ${JSON.stringify(character.relationships)})`
  );
  assert(
    JSON.stringify(character.spiceCompatibilities) === JSON.stringify([4, 5]),
    `stored spice levels should survive the same way (got ${JSON.stringify(character.spiceCompatibilities)})`
  );
}

function main(): void {
  testNonAsciiNamesStayDistinct();
  testThreadsAndArtifactsStayDistinct();
  testNamesWithNoSluggableCharactersStayDistinct();
  testAsciiNamesKeepTheirExistingIds();
  testCombiningMarksStayInsideTheirWord();
  testEquivalentSpellingsOfOneNameMerge();
  testMarkOnlyNamesStillReachTheDigest();
  testExplicitIdsAndRepeatedNamesStillMerge();
  testMalformedRelationshipEdgesAreDropped();
  testSpiceCompatibilitiesStayInsideTheScale();
  testExistingEdgesSurviveASilentUpdate();

  console.log('Story Lab continuity merge tests passed');
}

main();
