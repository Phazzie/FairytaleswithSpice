#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

/**
 * `varietyScore` is the one thing the continuation response says about a serial
 * repeating itself.
 *
 * `CliffhangerService.analyze` takes the hook types that came before and scores
 * 3 out of 8 when the new chapter repeats one of them. The continuation loop
 * called it with one argument, so `previousCliffhangers` defaulted to `[]` on
 * every chapter and the score could only ever be 8 — "these hooks do not
 * repeat" — including for a batch whose three chapters end on the identical
 * beat. It is not an internal number: it travels back to the caller as
 * `cliffhangerAnalysis.varietyScore`, so the field asserted variety over a story
 * that had none, always.
 *
 * The mock chapter generator is what makes this assertable without a provider:
 * it writes the same chapter every time, so a three-chapter batch is exactly the
 * repetition the score exists to report.
 */

import { StoryService } from '../api/_lib/services/storyService';
import { CliffhangerService } from '../api/_lib/services/cliffhangerService';
import { assert } from './assert';

const REPEATED_HOOK_VARIETY_SCORE = 3;
const UNREPEATED_HOOK_VARIETY_SCORE = 8;

function continuationInput(requestedChapterCount: 1 | 2 | 3) {
  return {
    storyId: 'story_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f',
    currentChapterCount: 1,
    existingContent: '<p>She opened the door.</p>',
    maintainTone: true,
    requestedChapterCount
  };
}

async function main(): Promise<void> {
  const service = new StoryService();

  const batch = await service.continueChapter(continuationInput(3));

  assert(batch.success, 'the mock continuation batch should succeed');
  assert(
    batch.data.chapters?.length === 3,
    `three chapters should be generated (got ${batch.data.chapters?.length})`
  );

  const analysis = batch.data.cliffhangerAnalysis;
  assert(analysis, 'the continuation response should carry a cliffhanger analysis');

  // The mock chapters are identical, so the third one ends on the hook the
  // first two already used. Anything other than the repeated score here means
  // the loop is not feeding the types it has already produced back into the
  // scan.
  assert(
    analysis.varietyScore === REPEATED_HOOK_VARIETY_SCORE,
    'a batch whose chapters end on the same hook should lose variety ' +
      `(got ${analysis.varietyScore})`
  );

  // The floor is the score itself, not the loop: a first chapter has nothing to
  // repeat, so a single-chapter batch still scores full variety. Without this
  // the assertion above would also pass for a loop that simply always reported
  // 3.
  const single = await service.continueChapter(continuationInput(1));

  assert(single.success, 'the single-chapter mock continuation should succeed');
  assert(
    single.data.cliffhangerAnalysis?.varietyScore === UNREPEATED_HOOK_VARIETY_SCORE,
    'the first chapter of a batch has no earlier hook to repeat ' +
      `(got ${single.data.cliffhangerAnalysis?.varietyScore})`
  );

  // What the loop feeds forward has to be a hook the scan classified. A chapter
  // that merely stops on `!` reports the `plot_twist` placeholder, and pushing
  // that would charge the next chapter with repeating a twist nothing
  // identified — the defect `CliffhangerService` guards against internally,
  // rebuilt one chapter later from outside it. `hasIdentifiedCliffhangerType`
  // is the check that keeps the placeholder out; this pins the two cases it has
  // to separate.
  const cliffhangerService = new CliffhangerService();
  const unclassified = cliffhangerService.analyze('<p>The lamps guttered.</p><p>She ran!</p>');
  const classified = cliffhangerService.analyze(
    '<p>The corridor went silent.</p><p>Footsteps stopped outside the door, and her blood froze.</p>'
  );

  assert(
    unclassified.cliffhangerDetected && unclassified.cliffhangerType === 'plot_twist',
    'a closing exclamation is a detected hook carrying the placeholder type'
  );
  assert(
    classified.cliffhangerType === 'danger',
    'a pattern-matched hook carries the type the scan identified'
  );
  assert(
    cliffhangerService.analyze('<p>The lamps guttered.</p><p>She ran!</p>', ['plot_twist']).varietyScore
      === UNREPEATED_HOOK_VARIETY_SCORE,
    'the placeholder type must never be scored against a real earlier twist'
  );

  console.log('Story continuation cliffhanger variety tests passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
