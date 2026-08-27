#!/usr/bin/env tsx
// Created: 2026-08-26

import {
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

// A tag ends at the first `>` that is not inside a quoted attribute value.
// Reading it as `[^>]*>` stopped at the one inside the attribute and left the
// tag's own remaining text behind as prose, so the reader saw `b">Hello.`.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p title="a>b">Hello.</p>')) ===
    JSON.stringify(['Hello.']),
  'a `>` inside a double-quoted attribute should not end the tag'
);

assert(
  JSON.stringify(splitStoryIntoTextBlocks("<p title='a>b'>Hello.</p>")) ===
    JSON.stringify(['Hello.']),
  'a `>` inside a single-quoted attribute should not end the tag'
);

// The boundary is still seen — the tag is read whole, not skipped. Were it
// skipped, these two words would weld into the single token `To becontinued`.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>To be<br data-note="x>y">continued.</p>')) ===
    JSON.stringify(['To be', 'continued.']),
  'a <br> carrying such an attribute should still put a boundary between the words'
);

// Inline tags are read the same way, or the remnant simply moves to them.
assert(
  splitStoryIntoTextBlocks('<p>He was <em title="a>b">certain</em> of it.</p>')[0] ===
    'He was certain of it.',
  'an inline tag carrying such an attribute should be stripped whole'
);

// Markup whose quote never closes has no well-formed reading, so it is
// answered exactly as it was before rather than left in the text as a raw tag.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p title="unclosed>Text. <br>after')) ===
    JSON.stringify(['Text.', 'after']),
  'an unterminated attribute quote should fall back to the older reading'
);

// And the boundary is what the fallback is for. Recognising no tag there would
// leave the inline strip to delete it in place, welding the words on either
// side into `Before.After.` — the `door.Blood` defect this module exists to
// prevent, arriving through the one input with no well-formed reading.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Before.<p title="unclosed>After.')) ===
    JSON.stringify(['Before.', 'After.']),
  'an unterminated attribute quote should still put a boundary between the words'
);

// Prose is where this runs, and a bare `<` in prose is not markup. Letting a
// quoted run reach across it would delete more of the sentence than the older
// reading did, so the tag-shaped reading is offered only to a `<` that begins
// a tag name. Here the older reading stops at the first `>`, keeping `b"`.
assert(
  splitStoryIntoTextBlocks('Price < 5 "a > b" > done.')[0] === 'Price  b" > done.',
  'a bare `<` in prose should not let a quoted run reach across the sentence'
);

// Each position is still decided once: the unquoted runs and the quoted
// alternatives cannot start on the same character, so no input has two ways to
// match. Adversarial runs that have no match at all must not become quadratic.
for (const [shape, input] of [
  ['a run of quotes', `<p ${'"'.repeat(40000)}${' '.repeat(40000)}`],
  ['a run of spaces', `<p ${' '.repeat(200000)}`],
  ['a run of `<`', '<'.repeat(200000)]
] as [string, string][]) {
  const startedAt = Date.now();
  splitStoryIntoTextBlocks(input);
  const elapsed = Date.now() - startedAt;
  assert(elapsed < 1000, `${shape} should not backtrack (took ${elapsed}ms)`);
}

console.log('Story text block tests passed');
