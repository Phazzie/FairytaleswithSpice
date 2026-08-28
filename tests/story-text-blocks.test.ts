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

// The same rule with a `>` between the two quotes, which is the case that
// discriminates. An earlier form of this pattern paired quote characters
// wherever they appeared, so `b"` and `c"` became a quoted run, the tag was
// read past its own `>`, and `c">` — text a browser shows the reader —
// disappeared from the title. HTML ends this tag at the first `>`, because
// `b"` is an unquoted value that merely contains a quote.
assert(
  readTag('<h3 a=b">c">Title</h3>') === '<h3 a=b">',
  'a quote inside an unquoted value must not pair with a later quote across the tag end'
);

assert(
  readTag("<h3 a=b'>c'>Title</h3>") === "<h3 a=b'>",
  'the same holds for single quotes'
);

// An unquoted value may still contain a quote after its first character, which
// is what lets the tag above end in the right place rather than fall back.
assert(
  readTag('<h3 a=b" c="d>e">Title</h3>') === '<h3 a=b" c="d>e">',
  'an unquoted value carrying a quote should not stop a later quoted value being read whole'
);

// A `/` inside a value is an ordinary character. HTML gives the slash a meaning
// only in the state *before* an attribute name, so once a value has begun,
// `//b="c` is all one unquoted value and the tag ends at the very next `>`.
// Treating the slash as an attribute separator instead — which this pattern did
// first — read `b="c>d"` as a second attribute, ran through the second `>`, and
// deleted the `d">` a reader sees.
assert(
  readTag('<h3 a=//b="c>d">Title</h3>') === '<h3 a=//b="c>',
  'a slash after an assignment belongs to the value, not to the separator'
);

assert(
  readTag('<h3 a=b/c>Title</h3>') === '<h3 a=b/c>',
  'a slash inside an unquoted value should not split it into two attributes'
);

// The corresponding cost, taken deliberately: a slash that a browser *would*
// treat as a separator no longer is one, so this markup has no reading here and
// falls back — the same answer `[^>]*>` gives. Coverage, not correctness.
assert(
  readTag('<h3 a="b>c"/>Title</h3>') === '<h3 a="b>',
  'a trailing self-closing slash is no longer a separator and should fall back'
);

// The attribute loop must not backtrack exponentially. Two separate mistakes
// made it do so, both on a tag that never closes: an optional separator between
// attributes let an n-character name be divided into attributes in 2^n ways,
// and an unquoted value permitted to *begin* with a quote gave `a="b"` one
// reading per alternation branch.
//
// Twenty-four attributes is deliberately small. It is a blowup detector, not a
// throughput measure: the current pattern reads them in ~0.01ms, while either
// mistake takes ~1.6s — so a regression fails this in under two seconds rather
// than hanging a CI run, which a length chosen for realism would do. At 80,000
// attributes the current pattern is still linear, at ~14ms.
{
  const unclosed = '<h3' + ' a="b"'.repeat(24);
  const startedAt = Date.now();
  new RegExp(String.raw`<h3${TAG_ATTRIBUTES_PATTERN}`, 'i').test(unclosed);
  const elapsedMs = Date.now() - startedAt;
  assert(elapsedMs < 250, `reading an unclosed tag's attributes should not backtrack exponentially, took ${elapsedMs}ms`);
}

// The other half of the same guard, which the input above does not reach: it
// supplies a separator before every attribute, so it cannot detect a separator
// that has become optional. One long name and no `>` does — 0.01ms here
// against 1.5s once the separator may match nothing.
{
  const unclosedLongName = '<h3 ' + 'a'.repeat(28);
  const startedAt = Date.now();
  new RegExp(String.raw`<h3${TAG_ATTRIBUTES_PATTERN}`, 'i').test(unclosedLongName);
  const elapsedMs = Date.now() - startedAt;
  assert(elapsedMs < 250, `one long attribute name should not be divisible exponentially, took ${elapsedMs}ms`);
}

// The third shape, and the fourth ambiguity of this kind: an attribute whose
// value is missing. With whitespace permitted after the `=`, a value could
// begin past the separator and consume the next attribute's name, so ` a= a=`
// reads either as one attribute valued `a` or as two valueless ones — 2^n
// partitions once the tag never closes. 32 repeats took 275ms, 36 took 2.0s.
{
  const unclosedMissingValues = '<h3' + ' a='.repeat(32);
  const startedAt = Date.now();
  new RegExp(String.raw`<h3${TAG_ATTRIBUTES_PATTERN}`, 'i').test(unclosedMissingValues);
  const elapsedMs = Date.now() - startedAt;
  assert(elapsedMs < 250, `attributes with missing values should not be divisible exponentially, took ${elapsedMs}ms`);
}

// The narrow, deliberate cost of that disambiguation: whitespace between the
// `=` and an opening quote leaves the markup with no reading here, so it takes
// the fallback and answers as `[^>]*>` does.
assert(
  readTag('<h3 a = "b>c">Title</h3>') === '<h3 a = "b>',
  'whitespace between `=` and an opening quote should take the fallback'
);

// Whitespace *before* the `=` is still read, so the asymmetry is real and not
// a blanket refusal of spacing around the assignment.
assert(
  readTag('<h3 a ="b>c">Title</h3>') === '<h3 a ="b>c">',
  'whitespace before `=` should still be read'
);

// Tag whitespace is space, tab, LF, FF and CR — not everything JavaScript's
// `\s` accepts. An NBSP between two attributes is an ordinary attribute-name
// character to a browser, not a separator, so this markup is the "missing
// whitespace between attributes" recovery case and has no well-formed reading
// here; it takes the fallback and answers exactly as `[^>]*>` does.
//
// Pinned because `\s` would instead read the tag whole. That is not obviously
// wrong — a browser does end this tag at the last `>` — but it means treating
// a character HTML does not call whitespace as a separator, which is how #295
// deleted reader-visible text. The conservative reading is chosen deliberately,
// and it is never worse than `main`.
assert(
  readTag('<h3 a="b>c" d="e>f">Title</h3>') === '<h3 a="b>',
  'an NBSP between attributes is not tag whitespace and should take the fallback'
);

// A tag with no `>` at all is not a tag.
assert(readTag('<h3 data-x=a') === null, 'a tag with no `>` should not match');

console.log('Story text block tests passed');
