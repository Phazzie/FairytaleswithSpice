#!/usr/bin/env tsx
// Created: 2026-08-26 UTC

import { readStreamingProgressEstimate } from '../shared/streamingProgressEstimate';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// The streaming panel derived its "words/sec" from the word count alone —
// `Math.floor(wordsGenerated / 20)` — so the number it printed was a function of
// how far through the story the stream was and of nothing else. Two streams at
// the same percentage but three seconds and thirty seconds in reported the same
// speed, which is the one thing a speed exists to tell them apart by.
function testSpeedReflectsElapsedTime(): void {
  const fast = readStreamingProgressEstimate({ percentage: 50, targetWords: 900, elapsedMs: 15_000 });
  const slow = readStreamingProgressEstimate({ percentage: 50, targetWords: 900, elapsedMs: 45_000 });

  assert(fast.wordsGenerated === 450, `half of a 900-word budget is 450 words, got ${fast.wordsGenerated}`);
  assert(slow.wordsGenerated === 450, `the same percentage is the same word count, got ${slow.wordsGenerated}`);
  assert(fast.generationSpeed === 30, `450 words in 15s is 30 words/sec, got ${fast.generationSpeed}`);
  assert(slow.generationSpeed === 10, `450 words in 45s is 10 words/sec, got ${slow.generationSpeed}`);
  assert(
    fast.generationSpeed > slow.generationSpeed,
    'a stream three times faster must report a faster speed than the slow one'
  );
}

// The time remaining followed from the fabricated speed, so it cancelled down to
// a constant: at any percentage of any budget the panel said the same number of
// seconds however the connection was actually behaving.
function testTimeRemainingFollowsTheMeasuredSpeed(): void {
  const fast = readStreamingProgressEstimate({ percentage: 50, targetWords: 900, elapsedMs: 15_000 });
  const slow = readStreamingProgressEstimate({ percentage: 50, targetWords: 900, elapsedMs: 45_000 });

  assert(fast.estimatedWordsRemaining === 450, `450 words are left, got ${fast.estimatedWordsRemaining}`);
  assert(fast.estimatedSecondsRemaining === 15, `450 words at 30/sec is 15s, got ${fast.estimatedSecondsRemaining}`);
  assert(slow.estimatedSecondsRemaining === 45, `450 words at 10/sec is 45s, got ${slow.estimatedSecondsRemaining}`);
}

// `Math.max(..., 1)` meant a stream that had produced nothing at all still
// claimed one word per second and counted down from a finish it was not
// approaching. Nothing measured is reported as nothing measured.
function testAStreamWithNothingToMeasureReportsNoSpeed(): void {
  const beforeAnyProgress = readStreamingProgressEstimate({ percentage: 0, targetWords: 900, elapsedMs: 8_000 });
  assert(beforeAnyProgress.generationSpeed === 0, `no words means no speed, got ${beforeAnyProgress.generationSpeed}`);
  assert(
    beforeAnyProgress.estimatedSecondsRemaining === null,
    `no speed means no estimate, got ${beforeAnyProgress.estimatedSecondsRemaining}`
  );

  const firstChunk = readStreamingProgressEstimate({ percentage: 10, targetWords: 900, elapsedMs: 0 });
  assert(firstChunk.generationSpeed === 0, `no elapsed time means no speed, got ${firstChunk.generationSpeed}`);
  assert(
    firstChunk.estimatedSecondsRemaining === null,
    `no speed means no estimate, got ${firstChunk.estimatedSecondsRemaining}`
  );
}

// A finished stream has nothing left to wait for, and says so with a number
// rather than with the "unknown" the two cases above answer with.
function testAFinishedStreamHasNoTimeLeft(): void {
  const done = readStreamingProgressEstimate({ percentage: 100, targetWords: 900, elapsedMs: 30_000 });

  assert(done.wordsGenerated === 900, `a complete stream has the whole budget, got ${done.wordsGenerated}`);
  assert(done.estimatedWordsRemaining === 0, `nothing is left, got ${done.estimatedWordsRemaining}`);
  assert(done.estimatedSecondsRemaining === 0, `nothing is left to wait for, got ${done.estimatedSecondsRemaining}`);
}

// The percentage arrives from the server and the budget from a form, so neither
// is guaranteed to be the number it is typed as. A `NaN` percentage put `NaN`
// words on screen; a percentage past 100 counted a negative remainder.
function testUnreadableInputsDoNotReachTheScreen(): void {
  const notANumber = readStreamingProgressEstimate({
    percentage: Number.NaN,
    targetWords: 900,
    elapsedMs: 5_000
  });
  assert(notANumber.wordsGenerated === 0, `an unreadable percentage counts no words, got ${notANumber.wordsGenerated}`);
  assert(
    notANumber.estimatedWordsRemaining === 900,
    `the whole budget is still to come, got ${notANumber.estimatedWordsRemaining}`
  );

  const overshoot = readStreamingProgressEstimate({ percentage: 140, targetWords: 900, elapsedMs: 5_000 });
  assert(overshoot.wordsGenerated === 900, `progress is capped at the budget, got ${overshoot.wordsGenerated}`);
  assert(overshoot.estimatedWordsRemaining === 0, `a capped count leaves nothing negative, got ${overshoot.estimatedWordsRemaining}`);

  const noBudget = readStreamingProgressEstimate({ percentage: 50, targetWords: Number.NaN, elapsedMs: 5_000 });
  assert(noBudget.wordsGenerated === 0, `an unreadable budget counts no words, got ${noBudget.wordsGenerated}`);
  assert(noBudget.generationSpeed === 0, `no words means no speed, got ${noBudget.generationSpeed}`);

  const negativeElapsed = readStreamingProgressEstimate({ percentage: 50, targetWords: 900, elapsedMs: -1_000 });
  assert(negativeElapsed.generationSpeed === 0, `time cannot run backwards into a speed, got ${negativeElapsed.generationSpeed}`);
}

function main(): void {
  testSpeedReflectsElapsedTime();
  testTimeRemainingFollowsTheMeasuredSpeed();
  testAStreamWithNothingToMeasureReportsNoSpeed();
  testAFinishedStreamHasNoTimeLeft();
  testUnreadableInputsDoNotReachTheScreen();

  console.log('✅ streaming progress estimate tests passed');
}

main();
