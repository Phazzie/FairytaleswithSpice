#!/usr/bin/env tsx
// Created: 2026-08-26

import {
  TAG_ATTRIBUTES_PATTERN,
  splitStoryIntoTextBlocks,
  stripStoryHtmlToText
} from '../shared/storyTextBlocks';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// A block-level tag puts a boundary where the markup put one, so two <p>
// elements come back as two blocks rather than one welded-together run.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>First.</p><p>Second.</p>')) ===
    JSON.stringify(['First.', 'Second.']),
  'adjacent <p> elements should split into separate blocks'
);

// Basic entities are decoded so a quoted line reads as dialogue, not as the
// literal entity text the generator emitted.
assert(
  splitStoryIntoTextBlocks('<p>&quot;Wait,&quot; she said &amp; ran.</p>')[0] ===
    '"Wait," she said & ran.',
  'basic entities should be decoded'
);

// Inline tags are dropped without introducing a boundary, so a run of prose
// split across a <strong> or <em> stays one block.
assert(
  splitStoryIntoTextBlocks('<p>He was <strong>certain</strong> of it.</p>')[0] ===
    'He was certain of it.',
  'inline tags should be stripped without splitting the surrounding block'
);

// Plain text with no markup keeps its own blank-line boundaries.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.\n\nTwo.')) === JSON.stringify(['One.', 'Two.']),
  'plain text should still split on blank lines'
);

// Empty and whitespace-only blocks are dropped rather than returned as blanks.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>Only.</p><p>   </p>')) === JSON.stringify(['Only.']),
  'blank blocks should be filtered out'
);

// `stripStoryHtmlToText` re-joins the same blocks with a blank line between
// them, which is what a reader sees as paragraphs.
assert(
  stripStoryHtmlToText('<p>First.</p><p>Second.</p>') === 'First.\n\nSecond.',
  'stripStoryHtmlToText should join blocks with a blank line'
);

// ==================== TAG_ATTRIBUTES_PATTERN ====================
// The primitive both chapter-heading readers in `storyContentAnalysis` compose,
// tested here on its own so the rules are pinned once rather than per caller.

// `readTag` is the shape a caller builds: a tag name, this pattern, and nothing
// else. It returns the opening tag as the pattern reads it.
const readTag = (markup: string): string | null => {
  const match = markup.match(new RegExp(String.raw`<h3${TAG_ATTRIBUTES_PATTERN}`, 'i'));
  return match ? match[0] : null;
};

// A tag ends at the first `>` that is not inside a quoted attribute value.
assert(
  readTag('<h3 data-x="a>b">Title</h3>') === '<h3 data-x="a>b">',
  'a `>` inside a double-quoted value should not end the tag'
);

assert(
  readTag("<h3 data-x='a>b'>Title</h3>") === "<h3 data-x='a>b'>",
  'a `>` inside a single-quoted value should not end the tag'
);

// Every quoted run in the tag is crossed, not only the first.
assert(
  readTag('<h3 title="a>b" class="c>d">Title</h3>') === '<h3 title="a>b" class="c>d">',
  'a second quoted value carrying `>` should also be crossed'
);

// A tag with no attributes is read exactly as before.
assert(readTag('<h3>Title</h3>') === '<h3>', 'a bare tag should be unaffected');

// A quoted run stops at `<`, so an unterminated quote cannot search forward
// until it finds a quote somewhere in the story text and swallow the words in
// between. Such markup has no well-formed reading and takes the fallback.
assert(
  readTag('<h3 data-x="a>Title</h3>') === '<h3 data-x="a>',
  'an unterminated attribute quote should fall back to the first-`>` scan'
);

// The documented cost of that bound: a value containing a literal `<` also has
// no well-formed reading and takes the same fallback, leaving the remnant the
// fallback always left. Unchanged from `[^>]*>` rather than introduced here.
assert(
  readTag('<h3 data-x="a<b>c">Title</h3>') === '<h3 data-x="a<b>',
  'a `<` inside a value is a known fallback case and should read as `[^>]*>` did'
);

// A quote that is not a delimiter — an apostrophe inside an unquoted value —
// must not open a quoted run and hunt for a partner in the prose.
assert(
  readTag("<h3 data-x=a'b>Title</h3>") === "<h3 data-x=a'b>",
  'a quote inside an unquoted value should not open a quoted run'
);

// A tag with no `>` at all is not a tag.
assert(readTag('<h3 data-x=a') === null, 'a tag with no `>` should not match');

console.log('Story text block tests passed');
