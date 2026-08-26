#!/usr/bin/env tsx
// Created: 2026-08-25 00:05 UTC

import { buildContinuityPrompt, type ContinuityExtractionInput } from '../api/_lib/story-lab/continuityExtractor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const STORY_ID = 'story-continuity-prompt';

function createInput(htmlContent: string): ContinuityExtractionInput {
  const now = new Date().toISOString();

  return {
    storyId: STORY_ID,
    currentState: {
      storyId: STORY_ID,
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
      storyId: STORY_ID,
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

// The chapter is capped before it reaches the prompt, and `.slice(0, 2200)`
// capped in UTF-16 code units. An astral character is two of those, so a
// chapter whose cut lands inside one left a lone surrogate in the prompt —
// `JSON.stringify` escapes it rather than refusing it, so nothing failed and
// the model was simply shown a character the chapter never held.
//
// The pair is placed so that a code-unit cut at 2200 falls between its halves:
// 2199 single-unit characters, then the pair.
const surrogatePair = '\u{1F5DD}';
const cappedChapter = chapterTextFrom(buildContinuityPrompt(createInput(
  `<p>${'a '.repeat(1099)}b${surrogatePair}${' tail'.repeat(200)}</p>`
)));

assert(
  ![...cappedChapter].some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0xd800 && code <= 0xdfff;
  }),
  'the chapter cap should never leave half of a character in the prompt'
);
// `latestChapters` is the heading line plus the capped body; the cap applies to
// the body.
const cappedBody = cappedChapter.slice(cappedChapter.indexOf('\n') + 1);
assert(
  Array.from(cappedBody).length <= 2200,
  `the cap should still bound the chapter (got ${Array.from(cappedBody).length} code points)`
);
assert(
  Array.from(cappedBody).length > 2000,
  'the cap should keep the chapter, not empty it'
);
assert(
  !/\s$/.test(cappedBody),
  'backing up to a word boundary should not leave the excerpt ending in whitespace'
);

console.log('Story Lab continuity prompt tests passed');
