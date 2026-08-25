#!/usr/bin/env tsx
// Created: 2026-08-25 05:20 UTC

import type { StoryIterationPayload } from '../api/_lib/story-lab/contracts';
import {
  getTransientStorySnapshot,
  MAX_TRANSIENT_STORY_SNAPSHOTS,
  persistStoryIteration,
  resetTransientStorySnapshots
} from '../api/_lib/story-lab/stateStore';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * The smallest payload the store actually reads: the story id it keys on, the
 * revision the receipt echoes, and one chapter to stand in for the story HTML
 * a real snapshot holds. Everything else on the contract is carried through
 * untouched, so filling it in would only make the assertions harder to read.
 */
function buildPayload(storyId: string, revision = 1): StoryIterationPayload {
  return {
    summary: { storyId, title: `Story ${storyId}` },
    state: { revision, continuityWarnings: [] },
    batch: {
      chapters: [
        {
          chapterId: `${storyId}-chapter-1`,
          chapterNumber: 1,
          title: 'Chapter One',
          htmlContent: `<p>${storyId}</p>`
        }
      ]
    }
  } as unknown as StoryIterationPayload;
}

// The store used to grow by one whole story per generation and never shrink. On
// the long-lived Node/Docker deployment that is a day of story HTML held live
// until a restart, so the count is now bounded.
function testTheStoreIsBounded(): void {
  resetTransientStorySnapshots();

  const overflow = MAX_TRANSIENT_STORY_SNAPSHOTS + 25;
  for (let index = 0; index < overflow; index += 1) {
    persistStoryIteration(buildPayload(`story-${index}`));
  }

  const newest = getTransientStorySnapshot(`story-${overflow - 1}`);
  assert(newest !== null, 'the most recently persisted story should still be readable');

  const evicted = getTransientStorySnapshot('story-0');
  assert(evicted === null, 'the oldest stories should have been evicted once the bound was passed');

  let retained = 0;
  for (let index = 0; index < overflow; index += 1) {
    if (getTransientStorySnapshot(`story-${index}`) !== null) {
      retained += 1;
    }
  }
  assert(
    retained === MAX_TRANSIENT_STORY_SNAPSHOTS,
    `the store should hold exactly the bound (held ${retained}, bound is ${MAX_TRANSIENT_STORY_SNAPSHOTS})`
  );
}

// Eviction is by last use rather than by age, because a serial someone is still
// writing is the one snapshot that must not be dropped for a newer, abandoned
// one. A continuation reads the snapshot it is about to extend, so a read
// counts as a use.
function testReadingAStoryKeepsIt(): void {
  resetTransientStorySnapshots();

  for (let index = 0; index < MAX_TRANSIENT_STORY_SNAPSHOTS; index += 1) {
    persistStoryIteration(buildPayload(`story-${index}`));
  }

  // `story-0` is the oldest by insertion, so it is next to be evicted until it
  // is read.
  assert(getTransientStorySnapshot('story-0') !== null, 'story-0 should be present before the overflow');

  persistStoryIteration(buildPayload('story-new'));

  assert(
    getTransientStorySnapshot('story-0') !== null,
    'a story that was just read should outlive one that was not'
  );
  assert(
    getTransientStorySnapshot('story-1') === null,
    'the least recently used story should be the one evicted'
  );
}

// Re-persisting a story replaces its snapshot rather than adding a second
// entry, so a long serial cannot evict the rest of the store on its own.
function testRepersistingDoesNotGrowTheStore(): void {
  resetTransientStorySnapshots();

  for (let revision = 1; revision <= MAX_TRANSIENT_STORY_SNAPSHOTS * 2; revision += 1) {
    persistStoryIteration(buildPayload('story-serial', revision));
  }

  persistStoryIteration(buildPayload('story-other'));

  const serial = getTransientStorySnapshot('story-serial');
  assert(serial !== null, 'the serial should still be held');
  assert(
    serial.state.revision === MAX_TRANSIENT_STORY_SNAPSHOTS * 2,
    `the newest revision should win (got ${serial.state.revision})`
  );
  assert(
    getTransientStorySnapshot('story-other') !== null,
    'a second story should still fit beside a heavily revised one'
  );
}

function main(): void {
  testTheStoreIsBounded();
  testReadingAStoryKeepsIt();
  testRepersistingDoesNotGrowTheStore();

  resetTransientStorySnapshots();
  console.log('Story Lab transient state store tests passed');
}

main();
