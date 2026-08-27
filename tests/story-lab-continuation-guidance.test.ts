#!/usr/bin/env tsx
// Created: 2026-08-27 03:10 UTC

/**
 * Direct, no-AI, no-service-instantiation coverage for the "Continuity
 * Courtroom" prompt-guidance subsystem in `continuationGuidance.ts`.
 *
 * Before this file, the ~700-line activation-scoring/pressure-selection/
 * cliche-alarm logic that decides what hidden guidance gets appended to a
 * continuation brief had no unit tests of its own — it was only reachable
 * indirectly through `story-lab-real-engine.test.ts`/
 * `story-lab-continuity-merge.test.ts`, which exercise it only through the
 * two route entry points (`generateStoryLabGenesis`/`continueStoryLab`).
 */

import {
  previewStoryLabContinuationGuidance,
  stripStoryMemoryCardSections,
  withContinuationStrategyBrief
} from '../api/_lib/story-lab/continuationGuidance';
import type { StoryStateSnapshot } from '../api/_lib/story-lab/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const STORY_ID = 'story-continuation-guidance';
const NOW = '2026-08-27T03:10:00.000Z';

function baseState(overrides: Partial<StoryStateSnapshot> = {}): StoryStateSnapshot {
  return {
    storyId: STORY_ID,
    revision: 2,
    characters: [
      {
        id: 'character-mira',
        displayName: 'Mira',
        archetype: 'protagonist',
        summary: 'A witch bound to the manor.',
        currentGoal: 'Break the binding.',
        internalConflict: 'Wants freedom but fears the cost.',
        externalConflict: 'The manor itself resists her.',
        secrets: [],
        relationships: [{
          characterId: 'character-corvin',
          relationship: 'rival',
          notes: 'Corvin holds the debt that binds her.'
        }],
        spiceCompatibilities: [3]
      },
      {
        id: 'character-corvin',
        displayName: 'Corvin',
        archetype: 'antagonist',
        summary: 'The manor lord.',
        currentGoal: 'Collect on the bargain.',
        internalConflict: 'Desire complicates the threat he represents.',
        externalConflict: 'Mira wants to escape him.',
        secrets: [],
        relationships: [],
        spiceCompatibilities: [3]
      }
    ],
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
        status: 'dormant',
        description: 'An old promise nobody has mentioned in chapters.',
        foreshadowedDevices: [],
        lifetime: 'series'
      }
    ],
    artifacts: [{
      id: 'artifact-locket',
      name: 'The silver locket',
      significance: 'Proof of the binding, hidden in the east wing.',
      introducedInChapter: 1,
      lifetime: 'series'
    }],
    beats: [],
    continuityWarnings: ['Mira’s eye color has been described two different ways.'],
    narrativeVoice: 'dark romance',
    lastUpdatedAt: NOW,
    ...overrides
  };
}

/**
 * A brief that names a thread by its own words should surface that thread
 * with a positive activation score and the "matched" reason — not the
 * unresolved-priority fallback every thread got before Unicode-aware
 * normalization existed (see `normalizeActivationText`'s docblock).
 */
function testBriefMentioningThreadActivatesIt(): void {
  const state = baseState();
  const preview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Make Mira confront the binding debt tonight.',
    storyState: state
  });

  const debtEntry = preview.contextSourceMap.find(entry => entry.label === 'The binding debt');
  assert(debtEntry, `the mentioned thread should appear in the context source map (got ${JSON.stringify(preview.contextSourceMap.map(e => e.label))})`);
  assert(debtEntry.activationScore > 0, `a mentioned thread should score above zero (got ${debtEntry.activationScore})`);
  assert(
    debtEntry.reason === 'Matched words from the continuation brief.',
    `a mentioned thread's reason should say so (got "${debtEntry.reason}")`
  );
  assert(
    preview.hiddenGuidance.includes('binding debt'),
    'the hidden guidance sent to the model should mention the activated thread'
  );
}

/** With no brief text to match against, unresolved threads still surface, credited to priority rather than a match. */
function testNoBriefFallsBackToUnresolvedPriority(): void {
  const state = baseState();
  const preview = previewStoryLabContinuationGuidance({
    continuationBrief: undefined,
    storyState: state
  });

  assert(preview.contextSourceMap.length > 0, 'unresolved threads/artifacts should still be selected with no brief');
  assert(
    preview.contextSourceMap.every(entry => entry.reason === 'Included by unresolved-story priority.'),
    `every entry should credit priority rather than a match (got ${JSON.stringify(preview.contextSourceMap.map(e => e.reason))})`
  );
  assert(
    preview.contextSourceMap.every(entry => entry.activationScore === 0),
    'every entry should score zero when there is nothing to match against'
  );
}

/** A resolved thread has already paid off; it should never be offered back to the model as unfinished business. */
function testResolvedThreadsAreExcluded(): void {
  const state = baseState({
    threads: [{
      id: 'thread-resolved',
      label: 'The finished bargain',
      status: 'resolved',
      description: 'Already paid off in a previous chapter.',
      foreshadowedDevices: [],
      lifetime: 'book'
    }]
  });

  const preview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Revisit the finished bargain.',
    storyState: state
  });

  assert(
    !preview.contextSourceMap.some(entry => entry.label === 'The finished bargain'),
    'a resolved thread should not be offered back to the model as unresolved business'
  );
}

/**
 * Ending-pressure and cliche-alarm scoring blend the brief with the story
 * state's own unresolved thread/artifact text (`buildContinuationPressureSource`
 * folds both in), so these tests use a state with no debt/secret/danger
 * language of its own — otherwise the state's fixture text, not the brief,
 * would decide the outcome.
 */
function neutralState(): StoryStateSnapshot {
  return baseState({
    threads: [{
      id: 'thread-market-day',
      label: 'The morning market',
      status: 'active',
      description: 'A weekly errand with nothing at stake yet.',
      foreshadowedDevices: [],
      lifetime: 'book'
    }],
    artifacts: [],
    continuityWarnings: []
  });
}

/** Brief keywords pointing at a threat/deadline should steer the ending pressure toward "Danger escalation". */
function testDangerKeywordsChooseDangerEscalation(): void {
  const guidance = withContinuationStrategyBrief('The hunters are closing in and the deadline is tonight.', neutralState()) ?? '';

  assert(
    guidance.includes('Chosen: Danger escalation'),
    `danger/threat language should choose the danger-escalation ending (got:\n${guidance})`
  );
}

/** Brief keywords pointing at a secret/bargain should steer the ending pressure toward "Secret exposed". */
function testSecretKeywordsChooseSecretExposed(): void {
  const guidance = withContinuationStrategyBrief('Reveal the hidden bargain and the debt behind it.', neutralState()) ?? '';

  assert(
    guidance.includes('Chosen: Secret exposed'),
    `secret/bargain language should choose the secret-exposed ending (got:\n${guidance})`
  );
}

/** The cliche alarm should name a distinct avoidance path for a bargain-flavored brief vs. a romance-flavored one. */
function testClicheAlarmPathVariesWithContent(): void {
  const state = neutralState();
  const bargainGuidance = withContinuationStrategyBrief('The formal debt and bargain must be repaid.', state) ?? '';
  const romanceGuidance = withContinuationStrategyBrief('She wants to confess her desire and kiss him.', state) ?? '';

  assert(bargainGuidance.includes('Cliche Alarm:'), 'guidance should include a Cliche Alarm section');
  assert(
    bargainGuidance.includes('formal demand with no personal cost'),
    `bargain-flavored text should avoid the formal-demand cliche (got:\n${bargainGuidance})`
  );
  assert(
    romanceGuidance.includes('confession of what they already know'),
    `romance-flavored text should avoid the confession cliche (got:\n${romanceGuidance})`
  );
}

/** The internal "Accepted/Pinned Memory Cards:" bookkeeping must never reach a reader-facing suggested prompt. */
function testStripStoryMemoryCardSectionsDropsBookkeeping(): void {
  const withCards = 'Pay off the locket reveal.\nAccepted Memory Cards:\n- Mira knows about the debt\nPinned Memory Cards:\n- The oath';
  const stripped = stripStoryMemoryCardSections(withCards);

  assert(stripped === 'Pay off the locket reveal.', `only the public prefix should remain (got "${stripped}")`);
  assert(stripStoryMemoryCardSections(undefined) === undefined, 'an undefined brief should stay undefined');
  assert(stripStoryMemoryCardSections('   ') === undefined, 'a blank brief should normalize to undefined');
}

/**
 * A non-Latin brief has to activate the same way an English one does —
 * this is the regression `normalizeActivationText`'s Unicode-property
 * matching exists to prevent (see its docblock).
 */
function testNonLatinBriefStillActivatesThreads(): void {
  const state = baseState({
    threads: [{
      id: 'thread-oath',
      label: 'Клятва Миры',
      status: 'active',
      description: 'An oath sworn in another script.',
      foreshadowedDevices: [],
      lifetime: 'series'
    }]
  });

  const preview = previewStoryLabContinuationGuidance({
    continuationBrief: 'Она должна вспомнить клятва миры прямо сейчас.',
    storyState: state
  });

  const oathEntry = preview.contextSourceMap.find(entry => entry.label === 'Клятва Миры');
  assert(oathEntry, 'a non-Latin thread should still be selectable');
  assert(oathEntry.activationScore > 0, `a matching non-Latin brief should score above zero (got ${oathEntry.activationScore})`);
}

function main(): void {
  testBriefMentioningThreadActivatesIt();
  testNoBriefFallsBackToUnresolvedPriority();
  testResolvedThreadsAreExcluded();
  testDangerKeywordsChooseDangerEscalation();
  testSecretKeywordsChooseSecretExposed();
  testClicheAlarmPathVariesWithContent();
  testStripStoryMemoryCardSectionsDropsBookkeeping();
  testNonLatinBriefStillActivatesThreads();

  console.log('Story Lab continuation guidance tests passed');
}

main();
