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

// --- #296, row 3: a tag ends at the first `>` outside a quoted value ---
//
// The two patterns this module used to read markup with both ended a tag at the
// first `>`, wherever it was. Every case below came back carrying the rest of
// the attribute as reader-visible prose, and this module is what every quality
// scanner in the repository reads — so the fragment reached word counts, the
// last-paragraph cliffhanger scan, image prompts, continuity excerpts and the
// text the app copies to the clipboard.

// A block-level tag: the remnant used to open the block, as `b">Alpha.`.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p title="a>b">Alpha.</p><p>Beta.</p>')) ===
    JSON.stringify(['Alpha.', 'Beta.']),
  'a quoted `>` in a block tag attribute should not leak into the block'
);

// An inline tag: the remnant used to weld into the middle of a sentence, as
// `He was y">certain of it.` — one that then miscounts and mis-splits.
assert(
  splitStoryIntoTextBlocks('<p>He was <em title="x>y">certain</em> of it.</p>')[0] ===
    'He was certain of it.',
  'a quoted `>` in an inline tag attribute should not weld into the sentence'
);

// A self-closing tag: the truncation cost the `/` as well, so the remnant
// arrived as `2"/>Two.`
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<p>One.<br data-x="1>2"/>Two.</p>')) ===
    JSON.stringify(['One.', 'Two.']),
  'a quoted `>` in a self-closing tag should leave neither remnant nor missing break'
);

// Single quotes delimit a value too.
assert(
  JSON.stringify(splitStoryIntoTextBlocks("<p title='a>b'>Alpha.</p>")) ===
    JSON.stringify(['Alpha.']),
  "a quoted `>` in a single-quoted attribute should not leak into the block"
);

// --- the rules that keep the widened scan from eating prose ---

// An unterminated quote must not pair with an apostrophe in the sentence and
// delete the words between them. Losing prose the reader wrote would be worse
// than the fragment this change removes.
assert(
  splitStoryIntoTextBlocks("<p class='unterminated>It's dangerous > here.</p>")[0] ===
    "It's dangerous > here.",
  'an unterminated attribute quote should not swallow the sentence after it'
);

// A `<` with no `>` after it anywhere closes no tag, so it is text the reader
// typed and stays visible.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Alpha < Beta')) === JSON.stringify(['Alpha < Beta']),
  'a `<` that closes nothing should stay as text'
);

// ...and a tag-shaped span must not reach across a blank line to find its `>`.
// Marking boundaries runs over the whole story, because a block tag can span
// one; removing what is left runs per block, after the split, because
// `<[^<>]*>` never could. Doing both in one pass over the whole string lets
// this match from the `<` to the `>` two paragraphs later and deletes the
// paragraph between them.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Alpha <\n\nBeta > Gamma')) ===
    JSON.stringify(['Alpha <', 'Beta > Gamma']),
  'a malformed tag-shaped span should not consume across a blank line'
);

// ...and the same `<` must survive a *later* real tag, which is the harder
// case. A first-`>` reading runs from the `<` a reader typed to the `>` of the
// `<em>` and swallows ` < Beta <em>` whole, leaving `Alpha Gamma`. Deleting
// words the reader wrote is the one outcome worse than the fragment this
// change removes.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('Alpha < Beta <em>Gamma</em>')) ===
    JSON.stringify(['Alpha < Beta Gamma']),
  'a literal `<` before a later real tag should not swallow the prose between them'
);

// --- classification, unchanged from the pattern it replaces ---

// The tag name is matched case-insensitively, as the old `i` flag did.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<P>One.</P><P>Two.</P>')) ===
    JSON.stringify(['One.', 'Two.']),
  'block tag names should still match regardless of case'
);

// `h1`..`h6` are a boundary. They were the one `h[1-6]` alternative in the
// pattern and are six separate entries in the name set now, so each level is
// checked — and checked with no other tag to supply the break, or a `<p>`
// beside it hides a missing heading name entirely.
for (let level = 1; level <= 6; level += 1) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(`<h${level}>Title</h${level}>Body.`)) ===
      JSON.stringify(['Title', 'Body.']),
    `<h${level}> should be a block boundary`
  );
}

// Every name in the set, each with no other tag beside it to supply the break.
// Losing any one of them welds two paragraphs into a single token, which is the
// `door.Blood` fault this module exists to prevent.
for (const name of [
  'br', 'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main',
  'nav', 'blockquote', 'pre', 'hr', 'li', 'ul', 'ol', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'caption',
  'tr', 'td', 'th'
]) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(`One.<${name}>Two.`)) ===
      JSON.stringify(['One.', 'Two.']),
    `<${name}> should be a block boundary`
  );
}

// --- classification comes from the original pattern, not from the scanner ---
//
// The scanner says where a tag ends; the pattern says what it is. Deriving the
// name from the scanner instead drifts in both directions, and both directions
// move reader-visible text.

// `parseHtmlTag` ends a name only at whitespace, `/` or `>`, so it reads
// `</ p>` as a `p`. HTML reads `</` followed by a space as a bogus comment and
// the block pattern matched nothing, so there is no paragraph break here.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.</ p>Two.')) === JSON.stringify(['One.Two.']),
  'a malformed closing tag should not become a paragraph break'
);

// The other direction: `\b` ends a name at any non-word character, so each of
// these *was* a break and has to stay one. Deriving the name from the scanner
// made them `p"`, `p<` and `p=`, matching nothing — 894 welded paragraphs
// across the fragment enumeration.
for (const markup of ['<p">', '<p<>', '<p=>']) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(`One.${markup}Two.`)) ===
      JSON.stringify(['One.', 'Two.']),
    `${markup} should still be a block boundary`
  );
}

// `\b` is what keeps `<paragraph>` from being a `<p>`. Standing alone with no
// other tag to supply the break, so that losing the word boundary shows up as
// a break that should not be there.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.<paragraph>Two.')) ===
    JSON.stringify(['One.Two.']),
  'a longer tag name starting with a block name should not be a boundary'
);

// ...while a real name that merely starts with another one still is.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.<pre>Two.')) ===
    JSON.stringify(['One.', 'Two.']),
  '<pre> should be a boundary even though `p` is also a block name'
);

// The block pattern's `[^>]*` may cross a `<`, unlike the inline pattern's
// `[^<>]*`, so this has always been one boundary spanning to the `>` rather
// than a `<` left in the prose. The scanner refuses it — an attribute list
// cannot contain a `<` — so it is the block fallback that has to answer, and
// this is the assertion that says so.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('One.<p a<b>Two.')) ===
    JSON.stringify(['One.', 'Two.']),
  'a block tag whose attributes contain a `<` should still be one boundary'
);

// Table cells each get their own boundary, or `OneTwo` comes back as one token.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<table><tr><td>One</td><td>Two</td></tr></table>')) ===
    JSON.stringify(['One', 'Two']),
  'table cells should each be their own block'
);

// --- #296, the last row: a comment is read by `findCommentEnd` ---
//
// A comment is not a tag, so the scanner refuses it and `<[^<>]*>` used to
// answer — a pattern that ends at the first `>` and cannot cross a `<`, neither
// of which a comment body is obliged to avoid. The block above used to assert
// that this module leaked `b -->` as a visible block; it no longer does, and
// three worse faults went with it.

// Every one of these sits between the same two paragraphs and must leave both
// of them alone and contribute nothing of its own, so they are one table rather
// than one assertion apiece: what distinguishes them is the comment, and a table
// puts the comments in a column where they can be read against each other.
for (const [markup, expectation] of [
  // Dropped before this change too, and still dropped.
  ['<!-- plain -->', 'an ordinary comment should still be dropped'],

  // A `>` in the body used to end the comment early and leak `b -->`. This is
  // the row #296 filed, and it was the least of the four.
  ['<!-- note: a > b -->', 'a `>` inside a comment body should not leak the rest of the comment'],

  // A `<` in the body used to leak the *opening* instead, as `<!-- note: a`.
  ['<!-- note: a < b -->', 'a `<` inside a comment body should not leak the comment opening'],

  // The one that matters most: a commented-out paragraph was read as story
  // prose. `Hidden.` counted as a word and the `<p>` inside the comment was
  // taken as a paragraph break — in the module every quality scanner reads.
  ['<!-- <p>Hidden.</p> -->', 'a comment body should never be read as story prose'],

  // A comment carrying a blank line used to split the story across it, moving
  // every measure that reads the last paragraph. This is why the drop cannot be
  // left to `replaceTag`: the boundary pass returns a non-boundary tag as text
  // for the second pass, and the split between the passes happens in between.
  ['<!-- a\n\nb -->', 'a comment containing a blank line should not split the story'],

  // All four spellings that close a comment, read from `shared/htmlTagScanner`
  // so that this module, the export sanitizer and the chapter reader agree.
  ['<!-- x -->', '`-->` should close a comment'],
  ['<!-->', '`<!-->` should close a comment'],
  ['<!--->', '`<!--->` should close a comment'],
  ['<!-- x --!>', '`--!>` should close a comment']
]) {
  assert(
    JSON.stringify(splitStoryIntoTextBlocks(`<p>Alpha.</p>${markup}<p>Beta.</p>`)) ===
      JSON.stringify(['Alpha.', 'Beta.']),
    expectation
  );
}

// `<h3>Visible <!--> Title</h3>` is the regression the previous revision warned
// that adopting `tokenizeHtml` would cause, back when a comment ended only at
// `-->` and `<!-->` read as one that never ends. #307 gave `findCommentEnd` all
// four spellings, so the heading keeps its words.
assert(
  JSON.stringify(splitStoryIntoTextBlocks('<h3>Visible <!--> Title</h3>')) ===
    JSON.stringify(['Visible  Title']),
  'an empty comment inside a heading should not swallow the heading'
);

// --- an unterminated comment is left exactly as it was ---
//
// The one policy decision here, and a deliberate divergence from `tokenizeHtml`,
// which abandons the scan and drops the remainder. That is right for an export,
// because a browser hides that text too. It is wrong here: this module feeds
// `countStoryWords`, the cliffhanger scan, image prompts and the next chapter's
// continuity excerpt, so silently losing the tail of a story costs more than the
// `<!-- unterminated` that keeping it leaks.
for (const [input, blocks, expectation] of [
  [
    '<p>Alpha.</p><!-- unterminated <p>Beta.</p>',
    ['Alpha.', '<!-- unterminated', 'Beta.'],
    'an unterminated comment should not drop the story after it'
  ],
  [
    '<p>Alpha.</p><!-- unterminated > text',
    ['Alpha.', 'text'],
    'an unterminated comment with a later `>` should answer as it always did'
  ]
] as [string, string[], string][]) {
  assert(JSON.stringify(splitStoryIntoTextBlocks(input)) === JSON.stringify(blocks), expectation);
}

// The search for a comment ending is run at most once per string, because once
// one open has no ending no later one has either. Without that, `<!--<!--…>` is
// quadratic — every open re-scans to the end of the input for a terminator that
// is not there, which measured 8.1s at 20,000 repeats against 7ms before the
// change. Bounded rather than timed against a constant, so the assertion is
// about the shape of the growth rather than about how fast this machine is.
{
  const build = (repeats: number) => '<!--'.repeat(repeats) + 'x>';
  const elapsed = (input: string) => {
    const start = process.hrtime.bigint();
    splitStoryIntoTextBlocks(input);
    return Number(process.hrtime.bigint() - start) / 1e6;
  };

  // Best of three readings rather than one. Noise in a timing is one-sided — a
  // GC pause or a descheduled slice can only make a run look slower, never
  // faster — so the fastest of several is the reading least contaminated by
  // whatever else the machine was doing. This is the part that keeps the check
  // off a flake.
  const fastest = (repeats: number) => {
    const input = build(repeats);
    return Math.min(elapsed(input), elapsed(input), elapsed(input));
  };

  fastest(2000); // warm up, so the first timing is not the compile
  const small = Math.max(fastest(5000), 0.5);
  const large = fastest(20000);

  // Quadratic would be ~16x for a 4x input. Linear is ~4x, so 10x leaves a 2.5x
  // margin for a slow or contended machine without admitting n².
  //
  // Non-strict, so a measurement landing exactly on the bound passes. That is
  // reachable rather than theoretical: `small` is floored at 0.5ms, making
  // `small * 10` the exact value 5, and `elapsed` returns a whole number of
  // nanoseconds divided by 1e6 — a discrete ladder a timing can land on rather
  // than merely approach.
  assert(
    large <= small * 10,
    `repeated comment opens should scale linearly, not quadratically (5,000: ${small.toFixed(1)}ms, 20,000: ${large.toFixed(1)}ms)`
  );
}

// --- the downstream measure this defect actually corrupted ---
//
// A welded remnant is one token to anything that counts words or splits
// sentences, which is how a reader-invisible attribute changed a word count.
assert(
  stripStoryHtmlToText('<p>He was <em title="x>y">certain</em> of it.</p>')
    .split(/\s+/)
    .filter(Boolean).length === 5,
  'a quoted `>` in an attribute should not change the word count'
);

console.log('Story text block tests passed');
