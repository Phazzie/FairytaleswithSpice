#!/usr/bin/env tsx
// Created: 2026-08-27 UTC
//
// `storyLabEngine` carried the last private HTML stripper in the repository: a
// hand-rolled `stripMarkupTags` loop that dropped anything between `<` and `>`
// and did nothing else. `shared/storyTextBlocks` is the module written for
// exactly this, and the difference between them is the one that is hardest to
// see in the code and easiest to see in the product — the loop decoded no
// entities, so `&nbsp;`, `&quot;`, `&#39;` and `&amp;` survived it as their
// literal source text.
//
// Both of that file's readers hand the result straight to the reader.
// `summarizeHtml` is the chapter excerpt shown in the library and the
// workbench, so a chapter opening on `she said &quot;no&quot;` was previewed
// with the entities showing and spent two of its 28 excerpt words on markup.
// `countWords` is the `wordCount` on a chapter the classic service did not
// count for itself, and `intense&nbsp;passion` is one token to a scan that
// cannot see the entity as the space it is.

import { buildStoryLabPayloadFromGeneratedStory } from '../api/_lib/story-lab/storyLabEngine';
import type { StoryGenerationSeam as LabGenerationSeam } from '../api/_lib/story-lab/contracts';
import type { StoryGenerationSeam as ClassicGenerationSeam } from '../api/_lib/types/contracts';
import { assert } from './assert';

const blueprint: LabGenerationSeam['input'] = {
  storyId: 'story-entities',
  creature: 'vampire',
  themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'A love that costs.' }],
  logline: 'A duel at dawn.',
  spicyLevel: 3,
  tone: 'dark_romance',
  desiredWordBudget: 900,
  chapterBatchSize: 1,
  heatContract: {
    adultOnlyConfirmed: true,
    tensionMode: 'slow_burn',
    intimacyBoundary: 'fade_to_black'
  }
} as LabGenerationSeam['input'];

// Every entity the generator writes, and one paragraph boundary with no
// whitespace around it — the `door.Blood` welding `shared/storyTextBlocks`
// exists to prevent.
const CHAPTER_HTML =
  '<p>She said &quot;no&quot; &amp; meant it, an intense&nbsp;passion she&#39;d not name.</p>'
  + '<p>He left through the door.</p><p>Blood on the sill.</p>';

function payloadForChapter(html: string, declaredWordCount: number) {
  const classicStory: ClassicGenerationSeam['output'] = {
    storyId: 'story-entities',
    title: 'A Duel At Dawn',
    content: html,
    creature: 'vampire',
    themes: ['forbidden_love'],
    spicyLevel: 3,
    actualWordCount: declaredWordCount,
    estimatedReadTime: 1,
    hasCliffhanger: false,
    generatedAt: new Date(),
    chapters: [
      {
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: 'Salt Vows',
        content: html,
        wordCount: declaredWordCount,
        generatedAt: new Date(),
        hasAudio: false,
        cliffhangerEnding: false
      }
    ],
    totalWordCount: declaredWordCount,
    appendedToStory: html
  } as ClassicGenerationSeam['output'];

  return buildStoryLabPayloadFromGeneratedStory(blueprint, classicStory, {
    requestId: 'req-entities',
    processingTime: 1,
    chaptersRequested: 1,
    chaptersGenerated: 1
  });
}

// ==================== The excerpt is the text a reader sees ====================

const summary = payloadForChapter(CHAPTER_HTML, 20).batch.chapters[0].summary;

for (const entity of ['&quot;', '&amp;', '&nbsp;', '&#39;']) {
  assert(
    !summary.includes(entity),
    `the chapter excerpt should not show ${entity} as source text: ${summary}`
  );
}
assert(
  summary.includes('She said "no" & meant it'),
  `the chapter excerpt should read as the reader sees it: ${summary}`
);
assert(
  summary.includes("she'd not name"),
  `the chapter excerpt should decode the apostrophe: ${summary}`
);
assert(
  summary.includes('intense passion'),
  `a non-breaking space should read as a space, not join two words: ${summary}`
);
assert(
  !summary.includes('door.Blood'),
  `a paragraph boundary should separate the words either side of it: ${summary}`
);

// ==================== And so is the count ====================

// `toStoryLabChapters` falls back to counting for itself whenever the classic
// chapter did not carry a count, which is the path this measures. Twenty-one
// words, and the hand-rolled stripper reported twenty: `&nbsp;` was not a space
// to it, so `intense&nbsp;passion` was a single token. The other entities here
// sit inside a token rather than between two, which is why one non-breaking
// space is the whole of the difference — and why it went unnoticed.
const counted = payloadForChapter(CHAPTER_HTML, 0).batch.chapters[0].wordCount;

assert(
  counted === 21,
  `a non-breaking space should separate two words in the count, got ${counted}`
);

// The classic service counts for itself with the same shared reading, so a
// count it supplied is kept rather than recomputed.
const supplied = payloadForChapter(CHAPTER_HTML, 20).batch.chapters[0].wordCount;
assert(supplied === 20, `a supplied word count should survive, got ${supplied}`);

console.log('Story Lab chapter text tests passed');
