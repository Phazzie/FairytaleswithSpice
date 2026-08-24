#!/usr/bin/env tsx
// Created: 2026-08-25 00:05 UTC

import { buildContinuityPrompt, type ContinuityExtractionInput } from '../api/_lib/story-lab/continuityExtractor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createInput(htmlContent: string): ContinuityExtractionInput {
  const now = new Date().toISOString();

  return {
    storyId: 'story-continuity-prompt',
    currentState: {
      storyId: 'story-continuity-prompt',
      revision: 1,
      characters: [],
      threads: [],
      artifacts: [],
      narrativeVoice: 'tense romantic fantasy',
      continuityWarnings: [],
      lastUpdatedAt: now
    },
    chapters: [{
      chapterId: 'chapter-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      htmlContent,
      rawContent: '',
      summary: '',
      wordCount: 12,
      hasCliffhanger: true
    }],
    summary: {
      storyId: 'story-continuity-prompt',
      chaptersGenerated: 1,
      totalWordCount: 12,
      openThreads: [],
      resolvedThreads: [],
      continuityWarnings: []
    },
    useAi: true
  };
}

function chapterTextFrom(prompt: string): string {
  return (JSON.parse(prompt) as { latestChapters: string }).latestChapters;
}

// The chapter reaches the prompt as the generator's HTML. A local stripper in
// this module deleted the tags and joined everything with single spaces, so the
// model was shown prose no reader ever sees: paragraph boundaries were gone,
// and because nothing was decoded, `&amp;` and `&quot;` sat in the text as
// literal entity markup. Continuity facts extracted from that are extracted
// from the wrong text. `stripStoryHtmlToText` is the rendering the cliffhanger,
// image, and story-quality scanners already read.
const chapterText = chapterTextFrom(buildContinuityPrompt(createInput(
  '<p>She opened the door.</p><p>Salt &amp; iron, and the &quot;hunter&quot; smiled.</p>'
)));

assert(
  !chapterText.includes('&amp;') && !chapterText.includes('&quot;'),
  `entity markup should be decoded before the model sees it (got ${JSON.stringify(chapterText)})`
);
assert(
  chapterText.includes('Salt & iron, and the "hunter" smiled.'),
  `the model should be shown the punctuation the reader sees (got ${JSON.stringify(chapterText)})`
);
assert(
  chapterText.includes('She opened the door.\n\nSalt'),
  `paragraph boundaries should survive into the prompt (got ${JSON.stringify(chapterText)})`
);

// Deleting a boundary tag without putting a break in its place welds the words
// on either side of it into one token, which is what the shared renderer exists
// to prevent.
const weldCandidate = chapterTextFrom(buildContinuityPrompt(createInput(
  '<p>She opened the door.</p><p>Blood pooled on the floor.</p>'
)));

assert(
  !weldCandidate.includes('door.Blood'),
  `paragraph neighbours should not be welded together (got ${JSON.stringify(weldCandidate)})`
);

console.log('Story Lab continuity prompt tests passed');
