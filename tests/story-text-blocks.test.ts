#!/usr/bin/env tsx
// Created: 2026-08-26

import {
  splitStoryIntoRenderedParagraphs,
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

// A `<br>` and a `</p><p>` both end a block, and the grouped reading is what
// tells them apart: the `<br>` wraps a line inside the paragraph already open,
// so its two blocks stay in one group.
assert(
  JSON.stringify(splitStoryIntoRenderedParagraphs('<p>First<br>line.</p><p>Second.</p>')) ===
    JSON.stringify([['First', 'line.'], ['Second.']]),
  'a <br> should end a block without starting a new rendered paragraph'
);

// The flat list is defined as the flattening of the grouped one, so the two
// cannot disagree about where a boundary falls. Asserted across every shape the
// splitter is documented to handle, because the grouped reading was introduced
// underneath an existing function and its whole claim is that nothing changed.
for (const storyContent of [
  '<p>First.</p><p>Second.</p>',
  '<p>First<br>line.</p><p>Second.</p>',
  'One.\n\nTwo.',
  '<p>Only.</p><p>   </p>',
  '<p>He was <strong>certain</strong> of it.</p>',
  '<div>Outer<br><br>gap</div><li>Item</li>',
  'text<br><p>after</p>',
  '<p>A<br\n\nclass="x">B</p>',
  '<p>To be<br>\n\ncontinued</p>',
  ''
]) {
  assert(
    JSON.stringify(splitStoryIntoRenderedParagraphs(storyContent).flat()) ===
      JSON.stringify(splitStoryIntoTextBlocks(storyContent)),
    `the flat blocks should be the grouped blocks flattened (${JSON.stringify(storyContent)})`
  );
}

// A paragraph whose every block is blank is dropped rather than returned as an
// empty group, so "the last rendered paragraph" is never an empty list while
// real text sits above it.
assert(
  JSON.stringify(splitStoryIntoRenderedParagraphs('<p>Only.</p><p>   <br>  </p>')) ===
    JSON.stringify([['Only.']]),
  'blank rendered paragraphs should be filtered out'
);

// Whitespace inside a boundary tag's own attributes is part of the tag, not
// text around it, so where the attributes wrap cannot change what comes back.
// Caught by Codex on this PR: marking the two boundary kinds in two passes left
// the second one searching text the first had already cut up, so a `<br>` whose
// attributes contained a blank line was torn in half by the paragraph split and
// its halves survived into the blocks as raw markup (`A<br`, `class="x">B`).
// That is a change in `splitStoryIntoTextBlocks`, which every scanner reads.
for (const [wrapped, inline] of [
  ['<p>A<br\n\nclass="x">B</p>', '<p>A<br class="x">B</p>'],
  ['<p\n\nclass="y">A</p><p>B</p>', '<p class="y">A</p><p>B</p>'],
  ['<div\n\nid="d">One</div><div>Two</div>', '<div id="d">One</div><div>Two</div>']
]) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(wrapped)) ===
      JSON.stringify(splitStoryIntoTextBlocks(inline)),
    `a blank line inside a tag's attributes is part of the tag (${JSON.stringify(wrapped)} gave ${JSON.stringify(splitStoryIntoTextBlocks(wrapped))})`
  );
  assert(
    !splitStoryIntoTextBlocks(wrapped).some(block => /[<>]/.test(block)),
    `no block should carry a fragment of a boundary tag (${JSON.stringify(wrapped)})`
  );
}

// Which kind of boundary a tag is depends on the tag's own name and on nothing
// in its attributes. Caught by Codex on this PR: `[^>]*` stops at the first
// `>`, so a quoted attribute carrying a tag hands the classifier a truncated
// match — `<div title="Use <br>` — and a classifier that searched it found the
// attribute's `<br>` and called the `<div>` a line wrap. Two rendered
// paragraphs then merged into one group, which is a consumer joining across a
// real block boundary: the one thing the grouping exists to prevent.
//
// Asserted as the rule rather than as the example, by comparing the *shape* of
// the grouping — how many blocks in how many groups — against the same markup
// with a bare tag. The text differs, because the truncated attribute leaves a
// remnant; the structure must not.
const groupingShape = (storyContent: string) =>
  JSON.stringify(splitStoryIntoRenderedParagraphs(storyContent).map(group => group.length));

for (const [withAttribute, bare] of [
  // A paragraph-level tag stays one however much its attributes look otherwise.
  ['Prelude<div title="Use <br> here">A</div>', 'Prelude<div>A</div>'],
  ['<p>One</p><p title="a <br> b">Two</p>', '<p>One</p><p>Two</p>'],
  // And the mirror: a real `<br>` stays a line wrap with a `<p>` in its
  // attributes, which is the same mistake pointing the other way.
  ['A<br title="<p>">B', 'A<br>B'],
  ['<p>To be<br title="</p>">continued</p>', '<p>To be<br>continued</p>']
]) {
  assert(
    groupingShape(withAttribute) === groupingShape(bare),
    `a tag's attributes must not change what kind of boundary it is (${JSON.stringify(withAttribute)} grouped ${groupingShape(withAttribute)}, bare grouped ${groupingShape(bare)})`
  );
}

// A `\0` cannot appear in rendered prose and is how a line wrap is carried
// internally, so one arriving from a caller must not be able to forge a
// boundary inside a paragraph.
assert(
  JSON.stringify(splitStoryIntoRenderedParagraphs('<p>To be\0continued</p>')) ===
    JSON.stringify([['To becontinued']]),
  'a caller-supplied \\0 should not forge a block boundary'
);

// Known limit, asserted rather than left to be rediscovered: a raw blank line
// is read as a paragraph boundary even inside an open `<p>`, where a browser
// collapses it as ordinary whitespace. That is the flat splitter's own
// long-standing conflation — blank lines have always ended a block, which is
// what plain-text callers depend on — so unpicking it changes the flat output
// every scanner reads and is a slice of its own. It errs safely: extra
// boundaries make the final paragraph smaller, so a caller joining within one
// can only miss a repair, never invent one.
assert(
  JSON.stringify(splitStoryIntoRenderedParagraphs('<p>To be<br>\n\ncontinued</p>')) ===
    JSON.stringify([['To be'], ['continued']]),
  'a raw blank line inside a <p> still starts a rendered paragraph (known limit)'
);

console.log('Story text block tests passed');
