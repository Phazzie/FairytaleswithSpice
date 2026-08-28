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

// Stopping the quoted run at `<` is not enough on its own: prose is full of
// apostrophes, so a malformed attribute quote can find its partner inside a
// contraction and swallow the sentence between them. An attribute value's
// closing quote is always followed by whitespace, `/`, or `>` — never by a
// word character — and that is what refuses this reading. Losing story text is
// the worse failure of the two: the defect being fixed leaves visible junk
// behind, while over-reading silently removes what the reader wrote.
assert(
  JSON.stringify(splitStoryIntoTextBlocks("Before.<p title='unclosed>It's dangerous >After.")) ===
    JSON.stringify(['Before.', "It's dangerous >After."]),
  'a malformed attribute quote should not consume prose at the next apostrophe'
);

assert(
  JSON.stringify(splitStoryIntoTextBlocks('Before.<p title="unclosed>She said "hi" >After.')) ===
    JSON.stringify(['Before.', 'She said "hi" >After.']),
  'nor at the next quotation mark'
);

// Only markup that parses as a whole well-formed tag is read past its first
// `>`. Everything else falls to the reading this module has always used, so
// there is one answer for every malformed shape rather than one per shape.
// These are the shapes that each defeated an earlier, narrower rule: a stray
// quote with no `=`, a tag name run into punctuation, an `=` with no attribute
// name, and a second `=` inside a bare value. None is a tag, so on all four the
// answer is the older reading's — which is also the browser's.
for (const [shape, markup] of [
  ['a stray quote with no `=`', 'Before.<p ">Visible" >After.'],
  ['a tag name run into punctuation', 'Before.<p.foo="oops>Visible" >After.'],
  ['an `=` with no attribute name', 'Before.<p ="oops>Visible" >After.'],
  ['a second `=` inside a bare value', 'Before.<p x=y="oops>Visible" >After.']
] as [string, string][]) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(markup)) ===
      JSON.stringify(['Before.', 'Visible" >After.']),
    `${shape} is not a tag, so its prose should survive`
  );
}

// The same, one level in: the inline reader must refuse it too, or the prose is
// deleted after the block reader has already declined to see a boundary.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Before.<em.foo="oops>Visible" >After.')) ===
    JSON.stringify(['Before.Visible" >After.']),
  'the inline reader should refuse a malformed tag as well'
);

// The other side of that line, stated so it is a decision rather than a
// surprise. When the quote *does* close where an attribute value may close,
// the tag has a well-formed reading and this module follows it — which is what
// the browser does too, and the app renders chapters through `[innerHTML]`, so
// text parsed as an attribute value is text the reader never saw. Following
// the markup is what "the text a reader sees" means; the older reading kept
// those words in the extraction and the reader still never read them.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Before.<p title="unclosed>Hidden " id="x">After.')) ===
    JSON.stringify(['Before.', 'After.']),
  'text inside a well-formed attribute value is not part of the story'
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
// match. These are the adversarial runs the module's docblocks worry about,
// each of which has no match at all — the shape that makes a backtracking
// engine explore every way of splitting it.
//
// What is asserted first is the answer, which is deterministic and does not
// depend on how loaded the machine is: none of these is markup, so every one
// comes back as its own text with nothing removed.
for (const [shape, input, expected] of [
  ['a run of quotes', `<p ${'"'.repeat(400)}`, `<p ${'"'.repeat(400)}`],
  ['a run of spaces', `<p ${' '.repeat(400)}`, '<p'],
  ['a run of `<`', '<'.repeat(400), '<'.repeat(400)]
] as [string, string, string][]) {
  assert(
    splitStoryIntoTextBlocks(input).join('') === expected,
    `${shape} is not markup and should come back unchanged`
  );
}

// The timing check below is a tripwire against reintroducing a pattern that
// backtracks, not a proof of complexity — a proof is not something a wall clock
// can give, and a deadline tight enough to be one would fail on a loaded
// runner instead. So the deadline is deliberately enormous: these scans take
// about a millisecond, and quadratic behaviour on this input does not take
// slightly longer, it takes minutes. Anything in between is not a runner
// having a bad day.
const backtrackingTripwireMs = 30000;
for (const [shape, input] of [
  ['a run of quotes', `<p ${'"'.repeat(40000)}${' '.repeat(40000)}`],
  ['a run of spaces', `<p ${' '.repeat(200000)}`],
  ['a run of `<`', '<'.repeat(200000)]
] as [string, string][]) {
  const startedAt = Date.now();
  splitStoryIntoTextBlocks(input);
  const elapsed = Date.now() - startedAt;
  assert(
    elapsed < backtrackingTripwireMs,
    `${shape} should not backtrack (took ${elapsed}ms)`
  );
}

console.log('Story text block tests passed');
