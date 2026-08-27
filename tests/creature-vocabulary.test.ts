#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// The ten creatures had seven hand-written copies: two type unions, the runtime
// table beside one of them, and four readers — the request validator, the log
// allow-list, and the two prompt builders that name the protagonist. They agreed
// only because nobody had added an eleventh creature yet.
//
// `shared/creatureVocabulary.ts` is the one table now. What this file asserts is
// the part a type cannot: that every reader is reading it, so a creature added
// to the table is accepted by the route, kept in the log, and named in both
// prompts without anyone having to remember four more files.

import { CREATURE_ARCHETYPES, isCreatureArchetype, readCreatureDisplayName, UNKNOWN_CREATURE_DISPLAY_NAME } from '../shared/creatureVocabulary';
import { CREATURE_ARCHETYPES as CONTRACT_CREATURE_ARCHETYPES } from '../api/_lib/types/contracts';
import { CREATURE_ARCHETYPES as STORY_LAB_CREATURE_ARCHETYPES } from '../api/_lib/story-lab/contracts';
import { getCreatureDisplayName } from '../api/_lib/services/storyContentAnalysis';
import { toLoggableCreature, UNRECOGNIZED_PARAMETER } from '../api/_lib/utils/loggableRequestParameters';
import { StoryService } from '../api/_lib/services/storyService';
import { assert } from './assert';

// ==================== The table has one home ====================

assert(CREATURE_ARCHETYPES.length === 10, 'the vocabulary should still be ten creatures');
assert(
  new Set<string>(CREATURE_ARCHETYPES).size === CREATURE_ARCHETYPES.length,
  'the vocabulary should not repeat a creature'
);

// Both contract files re-export the shared table rather than restating it, so
// these are the same array object, not two arrays that happen to match today.
assert(
  CONTRACT_CREATURE_ARCHETYPES === CREATURE_ARCHETYPES,
  "the API contract's CREATURE_ARCHETYPES should be the shared table itself"
);
assert(
  STORY_LAB_CREATURE_ARCHETYPES === CREATURE_ARCHETYPES,
  "the Story Lab contract's CREATURE_ARCHETYPES should be the shared table itself"
);

// ==================== Every reader reads it ====================

// `validateStoryInput` is private, so these go through the same door the tests
// for its sibling rules already use. One instance, because the constructor logs
// a warning about the absent API key it does not need to validate a field.
const storyService = new StoryService() as any;

const wellFormedInputExcept = (creature: unknown) => ({
  creature,
  themes: [],
  userInput: '',
  spicyLevel: 3,
  wordCount: 900
});

for (const creature of CREATURE_ARCHETYPES) {
  assert(isCreatureArchetype(creature), `${creature} should be recognised as a creature`);

  // The log keeps a creature from the table rather than replacing it with the
  // marker that means "the caller sent something that is not a creature".
  assert(
    toLoggableCreature(creature) === creature,
    `${creature} should be logged as itself, not as ${UNRECOGNIZED_PARAMETER}`
  );

  // The prompt names it, and names it the same way in both trees — the Angular
  // Proving Grounds copy reads the same function, which is what this asserts by
  // asserting the shared reader's answer.
  const displayName = readCreatureDisplayName(creature);
  assert(
    displayName === getCreatureDisplayName(creature),
    `${creature} should reach the prompt under one name`
  );
  assert(
    displayName.toLowerCase() === creature.toLowerCase(),
    `${creature} should be named after itself, not after another creature`
  );
  assert(
    displayName !== UNKNOWN_CREATURE_DISPLAY_NAME,
    `${creature} should have a name of its own`
  );

  // And the route accepts it.
  const rejection = storyService.validateStoryInput(wellFormedInputExcept(creature));
  assert(
    rejection === null || rejection === undefined || rejection.field !== 'creature',
    `/api/story/generate should accept ${creature}, which its own picker offers`
  );
}

// ==================== A value that is not a creature ====================

assert(!isCreatureArchetype('basilisk'), 'a creature outside the table is not one');
assert(!isCreatureArchetype(undefined), 'an absent creature is not one');
assert(
  readCreatureDisplayName('basilisk') === UNKNOWN_CREATURE_DISPLAY_NAME,
  'an unknown creature keeps the fallback name rather than reaching the prompt as caller text'
);
assert(
  toLoggableCreature('Dana is in treatment at Rosewood') === UNRECOGNIZED_PARAMETER,
  'caller prose in the creature field is still kept out of the log'
);

const rejectedCreature = storyService.validateStoryInput(wellFormedInputExcept('basilisk'));
assert(
  rejectedCreature && rejectedCreature.field === 'creature',
  '/api/story/generate should still refuse a creature outside the table'
);

console.log('creature-vocabulary tests passed');
