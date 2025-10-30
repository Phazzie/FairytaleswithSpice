#!/usr/bin/env node
/**
 * COMPREHENSIVE STORY GENERATION TESTS (NODE)
 *
 * Updated for multi-chapter batches.
 * Run: node tests/story-service.test.mjs
 */

import { StoryService } from '../api/lib/services/storyService.js';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'cyan') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title);
  console.log('='.repeat(80));
}

function assert(condition, successMsg, failureMsg) {
  if (!condition) {
    throw new Error(failureMsg || successMsg);
  }
  log(`✅ ${successMsg}`, 'green');
}

async function basicGeneration() {
  section('Basic Story Generation');
  const service = new StoryService();
  const input = {
    creature: 'vampire',
    themes: ['forbidden_love', 'desire'],
    userInput: 'A vampire lord meets a mortal librarian',
    spicyLevel: 3,
    wordCount: 700,
    requestedChapterCount: 1
  };

  const result = await service.generateStory(input);
  assert(result && typeof result === 'object', 'Received response object');
  assert(result.success, 'Story generation succeeded', `Story generation failed: ${result.error?.message}`);
  const story = result.data;

  assert(Array.isArray(story.chapters) && story.chapters.length === 1, 'Received exactly one chapter');
  const chapter = story.chapters[0];
  assert(typeof chapter.content === 'string' && chapter.content.length > 0, 'Chapter has content');
  assert(story.totalWordCount > 0, `Total word count recorded (${story.totalWordCount})`, 'Total word count missing');

  log(`Story title: ${story.title}`);
  log(`Total words: ${story.totalWordCount}`);
}

async function multiChapterBatch() {
  section('Multi-Chapter Batch Generation');
  const service = new StoryService();
  const counts = [1, 2, 3];

  for (const count of counts) {
    log(`\nRequesting ${count} chapter(s)...`);
    const input = {
      creature: 'werewolf',
      themes: ['adventure'],
      userInput: 'Pack politics threaten a budding romance',
      spicyLevel: 2,
      wordCount: 900,
      requestedChapterCount: count
    };

    const result = await service.generateStory(input);
    assert(result.success, `Generated story for ${count} chapter(s)`, `Failed to generate ${count} chapter(s): ${result.error?.message}`);
    const story = result.data;
    assert(Array.isArray(story.chapters) && story.chapters.length === count, `Received ${count} chapter(s)`);
    const numbers = story.chapters.map(ch => ch.chapterNumber);
    const expected = Array.from({ length: count }, (_, idx) => idx + 1);
    assert(JSON.stringify(numbers) === JSON.stringify(expected), `Chapter numbering sequential: ${numbers.join(', ')}`);
    log(`Total words across batch: ${story.totalWordCount}`);
    if (story.failedChapters?.length) {
      log(`⚠️  Partial failures: ${story.failedChapters.map(fc => `Chapter ${fc.chapterNumber}`).join(', ')}`, 'yellow');
    }
  }
}

async function continuationBatch() {
  section('Continuation Batch Generation');
  const service = new StoryService();

  const initial = await service.generateStory({
    creature: 'fairy',
    themes: ['adventure'],
    userInput: 'A fairy diplomat navigating dangerous courts',
    spicyLevel: 2,
    wordCount: 900,
    requestedChapterCount: 2
  });

  assert(initial.success, 'Initial story generated', `Initial generation failed: ${initial.error?.message}`);
  const baseStory = initial.data;

  const continuation = await service.continueChapter({
    storyId: baseStory.storyId,
    currentChapterCount: baseStory.chapters.length,
    existingContent: baseStory.appendedToStory,
    maintainTone: true,
    userInput: 'Escalate political intrigue',
    requestedChapterCount: 2
  });

  assert(continuation.success, 'Continuation request succeeded', `Continuation failed: ${continuation.error?.message}`);
  const contData = continuation.data;
  assert(Array.isArray(contData.chapters) && contData.chapters.length === 2, 'Continuation returned requested chapters');

  const expectedNumbers = [baseStory.chapters.length + 1, baseStory.chapters.length + 2];
  const actualNumbers = contData.chapters.map(ch => ch.chapterNumber);
  assert(JSON.stringify(actualNumbers) === JSON.stringify(expectedNumbers), `Continuation numbering sequential: ${actualNumbers.join(', ')}`);
}

(async () => {
  try {
    await basicGeneration();
    await multiChapterBatch();
    await continuationBatch();
    section('All tests completed successfully');
    process.exit(0);
  } catch (error) {
    log(`❌ ${error.message}`, 'red');
    process.exit(1);
  }
})();
