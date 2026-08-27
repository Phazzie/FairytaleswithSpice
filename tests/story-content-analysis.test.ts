#!/usr/bin/env tsx
// Created: 2026-08-27 00:39 UTC
//
// Direct unit coverage for the pure content-analysis/formatting helpers
// extracted out of `StoryService` into `storyContentAnalysis.ts`. Every
// function here is a plain string transformation, so every test calls it
// directly — no `StoryService` instance, no API key, no `as any` cast.
//
// `extractCharacterNames`, `extractPlotThreads`, `extractChapterTitleAndBody`,
// `createContextExcerpt`, `getCreatureDisplayName`, `getSpicyLabel`, and
// `formatChapterContent` had no dedicated tests before this file: they were
// only reachable through the full `generateStory`/`continueChapter` pipeline.

import {
  analyzeEmotionalTone,
  createContextExcerpt,
  extractCharacterNames,
  extractChapterTitleAndBody,
  extractLastChapterSummary,
  extractPlotThreads,
  extractSpicyLevelFromContent,
  extractThemesFromContent,
  formatChapterContent,
  getCreatureDisplayName,
  getSpicyLabel,
  stripSpeakerTagsForDisplay
} from '../api/_lib/services/storyContentAnalysis';
import { VALIDATION_RULES } from '../api/_lib/types/contracts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// ==================== extractCharacterNames ====================
// No dedicated test existed for this before now.

assert(
  JSON.stringify(extractCharacterNames(
    '[Lord Damien, voice: velvet-smoke]: "Come closer."'
    + '[Lord Damien]: "You are safe here."'
    + '[Narrator]: The candles guttered.'
    + '[Mira, emotion: afraid]: "Are you certain?"'
  )) === JSON.stringify(['Lord Damien', 'Mira']),
  'character names should be deduplicated and exclude the Narrator'
);

assert(
  extractCharacterNames('<p>No speaker tags in this passage at all.</p>').length === 0,
  'prose with no speaker tags should report no characters'
);

// ==================== extractPlotThreads ====================
// No dedicated test existed for this before now.

assert(
  extractPlotThreads('<p>A pleasant walk through the market square.</p>').length === 2,
  'neutral content should fall back to the two default threads rather than an empty list'
);

assert(
  extractPlotThreads('<p>She kept his forbidden secret, though the danger grew.</p>')
    .includes('Unresolved mystery or secret'),
  'a mention of a secret should be read as an unresolved mystery thread'
);

assert(
  extractPlotThreads('<p>She kept his forbidden secret, though the danger grew.</p>')
    .includes('Active threat or danger'),
  'a mention of danger should be read as an active-threat thread'
);

// The last scan in this module still reading the markup and matching
// substrings, and the last of its own five checks already used `\b`.
assert(
  !extractPlotThreads('<p>The secretary showed her into the empty office.</p>')
    .includes('Unresolved mystery or secret'),
  '`secretary` is not the word `secret`, so it should not open a mystery thread'
);

assert(
  !extractPlotThreads('<p>She was powerless, and the room was uncontrollable.</p>')
    .includes('Power dynamics in play'),
  '`powerless` and `uncontrollable` are not the words `power` and `control`'
);

assert(
  extractPlotThreads('<p>Her powers frightened him, and she controlled the room.</p>')
    .includes('Power dynamics in play'),
  '`powers` and `controlled` are inflections that must still be read as power dynamics'
);

assert(
  extractPlotThreads('<p>Something dangerous was threatening the house.</p>')
    .includes('Active threat or danger'),
  '`dangerous` and `threatening` are inflections that must still be read as a threat'
);

// The one multi-word pattern needs whitespace between its two words, and a
// paragraph break puts markup there instead — so the question the scan exists
// to notice was invisible whenever the model wrote it across one.
assert(
  extractPlotThreads('<p>She wondered what</p><p>if he had been lying all along.</p>')
    .includes('Unresolved questions'),
  'a question split across a paragraph break is still a question'
);

// ==================== extractChapterTitleAndBody ====================
// No dedicated test existed for this before now.

{
  const { title, body } = extractChapterTitleAndBody(
    '<h3>Chapter 3: The Deeper Shadows</h3><p>The door creaked open.</p>',
    3
  );
  assert(title === 'The Deeper Shadows', `expected the chapter-number prefix stripped from the title, got ${JSON.stringify(title)}`);
  assert(body === '<p>The door creaked open.</p>', `expected the heading removed from the body, got ${JSON.stringify(body)}`);
}

{
  const { title } = extractChapterTitleAndBody('<p>No heading here.</p>', 5);
  assert(title === 'Untitled Chapter 5', `expected a fallback title, got ${JSON.stringify(title)}`);
}

// ==================== createContextExcerpt ====================
// No dedicated test existed for this before now.

{
  const long = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
  const excerpt = createContextExcerpt(`<p>${long}</p>`, 40);
  assert(excerpt.length <= 40, `excerpt should not exceed the requested length, got ${excerpt.length}`);
  assert(long.endsWith(excerpt.split(' ').slice(-1)[0]), 'excerpt should be a tail of the source text');
}

// ==================== getCreatureDisplayName / getSpicyLabel ====================
// No dedicated tests existed for these before now.

assert(getCreatureDisplayName('vampire') === 'Vampire', 'known creature ids should map to a display name');
assert(getCreatureDisplayName('not-a-real-creature') === 'Creature', 'unknown creature ids should fall back to "Creature"');
assert(getSpicyLabel(1) === 'Storybook romance', 'level 1 should read as the mildest label');
assert(getSpicyLabel(5) === 'Inferno', 'level 5 should read as the hottest label');
assert(getSpicyLabel(99) === 'Spicy', 'an out-of-range level should fall back to "Spicy"');

// ==================== formatChapterContent ====================
// No dedicated test existed for this before now.

{
  const formatted = formatChapterContent('First paragraph.\n\nSecond paragraph.');
  const paragraphCount = formatted.split('<p>').length - 1;
  assert(paragraphCount === 2, `expected 2 paragraphs, got ${paragraphCount}: ${JSON.stringify(formatted)}`);
}

assert(
  formatChapterContent('<h3>Already formatted</h3><p>Stays as-is.</p>') === '<h3>Already formatted</h3><p>Stays as-is.</p>',
  'content that already carries HTML formatting should be left untouched'
);

// ==================== extractLastChapterSummary ====================

assert(
  extractLastChapterSummary('').length > 0,
  'empty content should still return a non-empty fallback summary'
);

// ==================== analyzeEmotionalTone ====================
// Ported from the whole-word-matching regression this module inherited.

assert(
  analyzeEmotionalTone('<p>She named the terms. He was dominant in every way that counted.</p>').includes('intense'),
  'a chapter about dominance should read as an intense register'
);
assert(
  !analyzeEmotionalTone('<p>The predominant colour was red.</p>').includes('intense'),
  'a word that merely contains a keyword should not match as a whole word'
);
assert(
  analyzeEmotionalTone('<p>A quiet supper by the window.</p>') === 'romantic with building tension',
  'a chapter carrying none of the registers should fall back honestly'
);

// ==================== extractThemesFromContent ====================
// Ported from the whole-word-matching / previously-unreachable-theme regression.

{
  const detected: string[] = extractThemesFromContent(
    '<p>He knelt in submission to her dominance.</p>'
    + '<p>Temptation was a sin, and her lust was built on deceit.</p>'
  );
  for (const theme of ['dominance', 'submission', 'temptation', 'sin', 'lust', 'deceit']) {
    assert(detected.includes(theme), `theme "${theme}" was named in the prose but not detected: ${JSON.stringify(detected)}`);
  }
  for (const theme of detected) {
    assert(
      (VALIDATION_RULES.themes.allowedValues as readonly string[]).includes(theme),
      `detected theme "${theme}" is not in VALIDATION_RULES.themes.allowedValues`
    );
  }
}

{
  const substrings: string[] = extractThemesFromContent('<p>The lustre of the rising tide was using the last of the light.</p>');
  for (const theme of ['sin', 'lust', 'manipulation']) {
    assert(!substrings.includes(theme), `theme "${theme}" was matched inside a longer word: ${JSON.stringify(substrings)}`);
  }
}

// ==================== extractSpicyLevelFromContent ====================
// Ported from the substring/markup regression.

assert(
  extractSpicyLevelFromContent(
    '<p>She warmed her hands at the hearth, her wool gloves steaming.</p>'
    + '<p>The duel had been an anticlimax, and he left her untouched at the door.</p>'
  ) === 1,
  'a chaste scene should read as level 1, not be caught by substrings like "hearth"/"gloves"/"anticlimax"'
);
assert(
  extractSpicyLevelFromContent('<p>The night turned to intense&nbsp;passion.</p>') === 5,
  'a multi-word keyword spaced with an HTML entity should still be read from the rendered prose'
);

// ==================== stripSpeakerTagsForDisplay ====================
// The narrative-shift test decides where the reader sees a paragraph break in
// every chapter this app displays. It was `/^(The|As|But|However|Still)/i` with
// no word boundary beside four unanchored `includes` calls.

function paragraphsOf(display: string): number {
  return display.split('<p>').length - 1;
}

// `They`, `Butler`, and `Asked` begin with `The`, `But`, and `As`, so three
// ordinary sentences of narration were each declared a new beat and each given
// a paragraph of its own — the reader was shown a chapter chopped into
// one-sentence stubs wherever the prose used a pronoun.
{
  const raw = [
    'She set the cup down.',
    'They had not spoken since.',
    'Butler waited by the stair.',
    'Asked once, he said nothing.'
  ].join('\n');
  const display = stripSpeakerTagsForDisplay(raw);
  assert(
    paragraphsOf(display) === 1,
    `lines that merely start with a longer word should stay in one paragraph, got ${paragraphsOf(display)}: ${JSON.stringify(display)}`
  );
}

// A transition word inside a line is not a line that opens on one, and the
// break this test decides goes before the whole line — so a mid-line `Then`
// put the break somewhere the word never justified.
{
  const raw = ['She waited by the window.', 'Her cup cooled. Then he spoke.'].join('\n');
  const display = stripSpeakerTagsForDisplay(raw);
  assert(
    paragraphsOf(display) === 1,
    `a mid-line transition word should not open a paragraph on its own, got ${paragraphsOf(display)}: ${JSON.stringify(display)}`
  );
}

// The words themselves are unchanged: a line that really does open on one of
// them is still a new beat.
for (const opener of ['Later, the hall emptied.', 'Suddenly the door gave.', 'Meanwhile, he waited.', 'The manor slept.']) {
  const display = stripSpeakerTagsForDisplay(['She set the cup down.', opener].join('\n'));
  assert(
    paragraphsOf(display) === 2,
    `"${opener}" should still open a new paragraph, got ${paragraphsOf(display)}: ${JSON.stringify(display)}`
  );
}

// A blank line is still the paragraph break it is — the branch this heuristic
// sits beside, and the one this method was fixed for once already.
{
  const raw = ['[Narrator]: She opened the door.', '', '[Narrator]: Blood pooled on the floor.'].join('\n');
  const display = stripSpeakerTagsForDisplay(raw);
  assert(paragraphsOf(display) === 2, `blank-line separated lines should still be two paragraphs: ${JSON.stringify(display)}`);
}

console.log('Story content analysis tests passed');
