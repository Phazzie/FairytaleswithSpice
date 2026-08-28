#!/usr/bin/env tsx
// Created: 2026-08-28 04:45 UTC
//
// The two chapter-heading readers, against a browser rather than against the
// pattern they replace.
//
// `extractChapterTitleAndBody` and `stripLeadingChapterHeading` used to spell
// the heading as `<h3[^>]*>(.*?)</h3>`, which ends the opening tag at the first
// `>` even when that `>` is inside a quoted attribute value. Issue #296 filed
// it; PRs #295 and #302 each tried to repair it with a better pattern and each
// withdrew, between them shipping six defects — three exponential-backtracking
// blowups and three that deleted text a reader wrote. Both concluded the same
// thing: use the scanner, which consumes each character once and cannot have
// the fault.
//
// The oracle here is the one #302 arrived at after its own metric hid a live
// defect through three rounds. "Never worse than `[^>]*>`" scores a *deleted*
// prefix as a remnant correctly removed, so the reading that deleted `d">` —
// text a browser shows — scored clean. `referenceTagEnd` below is an
// independent implementation of the WHATWG start-tag states, written from the
// spec rather than from `findTagEnd`, and the comparison is on where the tag
// ends.

import { extractChapterTitleAndBody, stripHtml, stripLeadingChapterHeading } from '../api/_lib/services/storyContentAnalysis';
import { findTagEnd } from '../shared/htmlTagScanner';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: string, expected: string, message: string): void {
  assert(actual === expected, `${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
}

// ==================== The oracle ====================

type TagState =
  | 'tagName'
  | 'beforeAttributeName'
  | 'attributeName'
  | 'afterAttributeName'
  | 'beforeAttributeValue'
  | 'attributeValueDouble'
  | 'attributeValueSingle'
  | 'attributeValueUnquoted'
  | 'afterAttributeValueQuoted'
  | 'selfClosingStartTag';

function isSpaceCharacter(character: string | undefined): boolean {
  return character === '\t' || character === '\n' || character === '\f' || character === '\r' || character === ' ';
}

/**
 * Where a browser ends the tag opening at `tagStart`, or `-1` if it emits no
 * tag there at all.
 *
 * WHATWG 13.2.5.6 onwards, transcribed state by state. Deliberately written
 * from the specification and not from `findTagEnd`, so that agreement between
 * the two is evidence rather than a tautology. Only the tag's end position is
 * tracked — attribute values are not collected, since nothing here reads them.
 */
function referenceTagEnd(value: string, tagStart: number): number {
  let index = tagStart + 1;

  if (value[index] === '/') {
    index += 1;
  }

  // Tag open state: anything but an ASCII letter here is not a tag.
  if (!/[a-zA-Z]/.test(value[index] ?? '')) {
    return -1;
  }

  let state: TagState = 'tagName';
  index += 1;

  while (index < value.length) {
    const character = value[index];

    switch (state) {
      case 'tagName':
        if (isSpaceCharacter(character)) {
          state = 'beforeAttributeName';
        } else if (character === '/') {
          state = 'selfClosingStartTag';
        } else if (character === '>') {
          return index;
        }
        break;

      case 'beforeAttributeName':
        if (isSpaceCharacter(character)) {
          break;
        }
        if (character === '/') {
          state = 'selfClosingStartTag';
          break;
        }
        if (character === '>') {
          return index;
        }
        // An `=` here is a parse error and becomes the attribute's *name*.
        state = 'attributeName';
        break;

      case 'attributeName':
        if (isSpaceCharacter(character)) {
          state = 'afterAttributeName';
          break;
        }
        if (character === '/') {
          state = 'selfClosingStartTag';
          break;
        }
        if (character === '>') {
          return index;
        }
        if (character === '=') {
          state = 'beforeAttributeValue';
        }
        break;

      case 'afterAttributeName':
        if (isSpaceCharacter(character)) {
          break;
        }
        if (character === '/') {
          state = 'selfClosingStartTag';
          break;
        }
        if (character === '=') {
          state = 'beforeAttributeValue';
          break;
        }
        if (character === '>') {
          return index;
        }
        state = 'attributeName';
        break;

      case 'beforeAttributeValue':
        if (isSpaceCharacter(character)) {
          break;
        }
        if (character === '"') {
          state = 'attributeValueDouble';
          break;
        }
        if (character === "'") {
          state = 'attributeValueSingle';
          break;
        }
        // Missing-attribute-value parse error: the tag is emitted here.
        if (character === '>') {
          return index;
        }
        state = 'attributeValueUnquoted';
        break;

      case 'attributeValueDouble':
        if (character === '"') {
          state = 'afterAttributeValueQuoted';
        }
        break;

      case 'attributeValueSingle':
        if (character === "'") {
          state = 'afterAttributeValueQuoted';
        }
        break;

      case 'attributeValueUnquoted':
        if (isSpaceCharacter(character)) {
          state = 'beforeAttributeName';
          break;
        }
        if (character === '>') {
          return index;
        }
        break;

      case 'afterAttributeValueQuoted':
        if (isSpaceCharacter(character)) {
          state = 'beforeAttributeName';
          break;
        }
        if (character === '/') {
          state = 'selfClosingStartTag';
          break;
        }
        if (character === '>') {
          return index;
        }
        // Missing-whitespace-between-attributes: reconsume.
        state = 'beforeAttributeName';
        index -= 1;
        break;

      case 'selfClosingStartTag':
        if (character === '>') {
          return index;
        }
        // Unexpected-solidus-in-tag: reconsume.
        state = 'beforeAttributeName';
        index -= 1;
        break;
    }

    index += 1;
  }

  // EOF in tag: a browser emits nothing.
  return -1;
}

/** The heading title a browser would show for `content`, or `null` for no heading. */
function referenceTitle(content: string): string | null {
  const tagEnd = referenceTagEnd(content, 0);
  if (tagEnd === -1) {
    return null;
  }

  const closing = content.indexOf('</h3>', tagEnd + 1);

  return closing === -1 ? content.slice(tagEnd + 1) : content.slice(tagEnd + 1, closing);
}

// ==================== The two rows #296 filed ====================

// Row 1, exactly as filed. `[^>]*>` ends the tag at the `>` inside the quoted
// value, so `b">` survives into the title `stripHtml` cannot clean — there is
// no tag left in it to strip.
{
  const content = '<h3 data-x="a>b">Real Title</h3><p>Body prose.</p>';
  const { title, body } = extractChapterTitleAndBody(content, 4);

  assertEqual(title, 'Real Title', 'row 1: the title is the heading text, not the tail of the opening tag');
  assertEqual(title, referenceTitle(content) as string, 'row 1: the title is what a browser shows');
  assertEqual(body, '<p>Body prose.</p>', 'row 1: the body is the chapter, with no remnant of the opening tag');
}

// Row 2, with the premise corrected on #296: the lazy `.*?` runs on to the real
// `</h3>`, so a truncated opening tag alone still strips. It fails when a
// newline falls between the truncation point and the `</h3>`, because `.`
// cannot cross one — nothing matches, and the chapter ships carrying two
// headings.
{
  const content = '<h3 data-x="a>b">Real\nTitle</h3>\n<p>Body prose.</p>';

  assertEqual(
    stripLeadingChapterHeading(content),
    '<p>Body prose.</p>',
    'row 2: a heading containing a newline is still stripped'
  );
}

{
  const content = '<h3>Chapter 4: Real\nTitle</h3>\n<p>Body prose.</p>';

  assertEqual(
    stripLeadingChapterHeading(content),
    '<p>Body prose.</p>',
    'row 2: the newline alone is enough to reproduce it — no attribute needed'
  );
}

// ==================== The shapes the two withdrawn patterns broke on ====================
//
// The data-loss family #302 shipped twice and was handed a third time: a `"`
// that is a *character* inside an unquoted attribute value rather than a
// delimiter. A browser ends the tag at the very next `>`, so what follows is
// text a reader sees; a pattern that pairs that quote with a later one reads
// past the tag's real end and deletes the prose between them.
//
// The scanner has to end the tag exactly where a browser does on all of these
// — which for most of them is also where `[^>]*>` ended it, since the whole
// point is that the repair must not regress the shapes the old reading got
// right. The three exponential-backtracking defects are pinned by the timing
// guard below.

/**
 * The title `extractChapterTitleAndBody` should return, derived from the
 * browser reference: its two post-steps — dropping a leading `chapter N` and
 * the `Untitled Chapter N` fallback — applied to the heading text a browser
 * shows. Neither post-step is what is under test here; where the tag ends is.
 */
function referenceReaderTitle(content: string, chapterNumber: number): string {
  const inner = referenceTitle(content);
  let title = inner === null ? '' : stripHtml(inner).trim();

  if (title.toLowerCase().startsWith(`chapter ${chapterNumber}`)) {
    title = title.slice(`chapter ${chapterNumber}`.length).replace(/^\s*:?/, '').trim();
  }

  return title || `Untitled Chapter ${chapterNumber}`;
}

const WITHDRAWN_PATTERN_CASES: ReadonlyArray<{ label: string; content: string; title: string }> = [
  {
    label: 'a quote inside an unquoted value, paired anywhere by #302 revision 1',
    content: '<h3 a=b">Chapter 4: Real Title</h3>',
    title: 'Real Title'
  },
  {
    label: 'the same through a single quote',
    content: "<h3 a=b'>Chapter 4: Real Title</h3>",
    title: 'Real Title'
  },
  {
    label: 'a slash after an assignment, read as a separator by revision 2',
    content: '<h3 a=//b="c>d">Chapter 4: Real Title</h3>',
    title: 'd">Chapter 4: Real Title'
  },
  {
    label: 'a bare `=` whose empty value let the rest re-partition, in revision 4',
    content: '<h3 a= b="c>d">Chapter 4: Real Title</h3>',
    title: 'd">Chapter 4: Real Title'
  },
  {
    label: 'the newline variant of it, which is what actually reproduced',
    content: '<h3 a=\nb="c>d">Chapter 4: Real Title</h3>',
    title: 'd">Chapter 4: Real Title'
  },
  {
    label: 'whitespace around `=`, which revision 3 surrendered to the fallback',
    content: '<h3 a = "b>c">Real Title</h3>',
    title: 'Real Title'
  }
];

for (const { label, content, title } of WITHDRAWN_PATTERN_CASES) {
  const read = extractChapterTitleAndBody(content, 4).title;

  assertEqual(read, title, `${label}: the pinned browser answer`);
  assertEqual(
    referenceReaderTitle(content, 4),
    title,
    `${label}: the pinned answer is what the reference states, so a wrong reference cannot hide a wrong reader`
  );
}

// The recovery class this reader deliberately declines, recorded so nobody
// reads it later as a defect. `a="b>c"d="e>f"` has a closing quote followed by
// a word character, which `findTagEnd` refuses rather than hunt for a later
// partner in the prose — so there is no well-formed reading and the fallback
// answers exactly as `[^>]*>` always did. A browser recovers and reads on.
{
  const content = '<h3 a="b>c"d="e>f">Real Title</h3>';

  assertEqual(
    extractChapterTitleAndBody(content, 4).title,
    'c"d="e>f">Real Title',
    'an unseparated second attribute takes the fallback: coverage forgone, never prose deleted'
  );
  assert(
    referenceReaderTitle(content, 4) === 'Real Title',
    'and this is a case where a browser does better, which is what makes it forgone coverage'
  );
}

// ==================== Ordinary markup reads exactly as it did ====================

const UNCHANGED_CASES: ReadonlyArray<{ content: string; title: string; body: string }> = [
  {
    content: '<h3>Chapter 4: Real Title</h3><p>Body prose.</p>',
    title: 'Real Title',
    body: '<p>Body prose.</p>'
  },
  {
    content: '<h3 class="chapter-title">Chapter 4: Real Title</h3>\n\n<p>Body prose.</p>',
    title: 'Real Title',
    body: '<p>Body prose.</p>'
  },
  {
    content: '<h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title',
    body: '<p>Body prose.</p>'
  },
  {
    content: '<h3><em>Real</em> Title</h3><p>Body prose.</p>',
    title: 'Real Title',
    body: '<p>Body prose.</p>'
  },
  {
    content: '<p>Body prose.</p>',
    title: 'Untitled Chapter 4',
    body: '<p>Body prose.</p>'
  }
];

for (const { content, title, body } of UNCHANGED_CASES) {
  const read = extractChapterTitleAndBody(content, 4);

  assertEqual(read.title, title, `well-formed markup keeps its title: ${content}`);
  assertEqual(read.body, body, `well-formed markup keeps its body: ${content}`);
}

// A heading that is not the first thing in the chapter is the chapter's own,
// not a title to replace. The `^\s*` anchor this replaces said the same.
assertEqual(
  stripLeadingChapterHeading('<p>Body prose.</p><h3>A heading mid-chapter</h3>'),
  '<p>Body prose.</p><h3>A heading mid-chapter</h3>',
  'only a leading heading is stripped'
);

// A second `<h3>` before the first is closed does not restart the heading. HTML
// has no nesting here, and the lazy `.*?` this replaces began at the first
// `<h3>` and ran on to the same `</h3>` — so the heading region is the whole
// span, and both words are the title rather than the second one alone. Pinned
// because "the first opening tag wins" is a one-character difference in the
// reader (`??=` against `=`) that nothing else here would catch.
{
  const content = '<h3>First<h3>Second</h3><p>Body prose.</p>';
  const { title, body } = extractChapterTitleAndBody(content, 4);

  assertEqual(title, 'First\n\nSecond', 'the heading opens at the first `<h3>`, not the last');
  assertEqual(body, '<p>Body prose.</p>', 'and the whole span is removed from the body, not just the second heading');
  assertEqual(
    content.match(/<h3[^>]*>(.*?)<\/h3>/i)?.[1] ?? '',
    'First<h3>Second',
    'which is the span the pattern being replaced also took'
  );
}

// An `<h3>` inside a comment is markup, not a heading. The `>` before it is
// what makes this discriminate: without skipping the comment whole, the walk
// ends a token at that `>`, resumes inside the comment body, and reads the
// heading there as the chapter's title. A comment with no `>` of its own does
// not separate the two readings, because `parseHtmlTag` rejects the `<!--`
// token either way.
assertEqual(
  extractChapterTitleAndBody('<!-- 4 > 3, so: <h3>Not a title</h3> --><h3>Real Title</h3>', 4).title,
  'Real Title',
  'a heading inside a comment is skipped'
);

// ==================== Where a `<` is not a tag ====================
//
// Three regressions review found in the first draft of this reader, all one
// fault: it asked `findTagEnd` where a tag ended before asking whether a tag
// started there at all. `findTagEnd` falls back to the first `>` when it has no
// well-formed reading, and that `>` can belong to markup further on — so the
// walk stepped over the very heading it was looking for.

// A literal `<` in prose. `findTagEnd` has no reading for `< 3`, falls back to
// the `>` of the real `<h3>`, and the walk resumed past it.
{
  const content = '2 < 3\n<h3>Real Title</h3><p>Body prose.</p>';
  const { title, body } = extractChapterTitleAndBody(content, 4);

  assertEqual(title, 'Real Title', 'a `<` in the prose does not hide the heading after it');
  assertEqual(body, '2 < 3\n<p>Body prose.</p>', 'and the prose containing it is kept');
}

// `< h3>` is five characters a browser shows. `parseHtmlTag` accepts it by
// skipping the space, so the reader took it for a heading and *deleted* the
// prose — the data-loss family, reintroduced one level up from the pattern.
{
  const content = '< h3>Visible prose</h3><p>Body prose.</p>';

  assertEqual(
    extractChapterTitleAndBody(content, 4).title,
    'Untitled Chapter 4',
    'a whitespace-prefixed pseudo-tag is not a heading'
  );
  assertEqual(
    extractChapterTitleAndBody(content, 4).body,
    content,
    'and none of it is removed from the body'
  );
  assertEqual(
    stripLeadingChapterHeading(content),
    content,
    'nor dropped by the append path, which is where it would vanish silently'
  );
  assert(referenceTitle(content) === null, 'a browser reads no tag there either');
}

// Three spellings close a comment, not one: `-->`, the abrupt closing of an
// empty comment (`<!-->` and `<!--->`), and the comment-end-bang `--!>`.
// Searching only for `-->` read an unterminated comment and abandoned the scan.
const COMMENT_CASES: ReadonlyArray<{ label: string; content: string; title: string }> = [
  {
    label: 'an abrupt empty comment inside the heading',
    content: '<h3>Visible <!--> Title</h3><p>Body prose.</p>',
    title: 'Visible  Title'
  },
  {
    label: '`<!--->` before the heading',
    content: '<!---><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  },
  {
    label: 'comment-end-bang before the heading',
    content: '<!-- x --!><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  },
  {
    label: 'an ordinary comment still ends where it always did',
    content: '<!-- x --><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  }
];

for (const { label, content, title } of COMMENT_CASES) {
  assertEqual(extractChapterTitleAndBody(content, 4).title, title, `${label}: the heading is still found`);
}

// A run of stray `<` costs one character each, not a scan to the next `>` per
// `<`. Deciding "is this a tag at all" before reading one is what buys this;
// asking `findTagEnd` first would make it quadratic.
{
  const startedAt = Date.now();
  extractChapterTitleAndBody(`${'<'.repeat(40_000)}>`, 4);
  const elapsed = Date.now() - startedAt;

  assert(elapsed < 2_000, `40,000 stray \`<\` took ${elapsed}ms — the walk is not linear in them`);
}

// ==================== Where markup is not markup ====================
//
// Two further regressions review found, both about reading something as markup
// that a browser reads as text.

// Inside a raw-text or RCDATA element nothing is a tag and nothing is a
// comment. Walking into one read its text as markup, and a `<!--` in there
// looked like a comment that never ends — which abandoned the scan and lost the
// real heading after it.
const RAW_TEXT_CASES: ReadonlyArray<{ label: string; content: string; title: string }> = [
  {
    label: 'a `<!--` inside `<script>` is script text, not a comment',
    content: '<script><!-- legacy script\n</script><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  },
  {
    label: 'and inside `<textarea>`',
    content: '<textarea><!--</textarea><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  },
  {
    label: 'an `<h3>` inside `<textarea>` is text a reader sees, not the title',
    content: '<textarea><h3>Not a title</h3></textarea><h3>Real Title</h3>',
    title: 'Real Title'
  },
  {
    label: 'an unclosed raw-text element runs to the end, as a browser reads it',
    content: '<script>x<h3>Real Title</h3>',
    title: 'Untitled Chapter 4'
  },
  {
    label: 'the closing tag that ends it is matched case-insensitively, as HTML matches it',
    content: '<SCRIPT><!-- legacy\n</SCRIPT><h3>Real Title</h3><p>Body prose.</p>',
    title: 'Real Title'
  },
  {
    label: 'but only its own name ends it — `</scriptx>` is more script text',
    content: '<script>a</scriptx><h3>Not in script</h3>',
    title: 'Untitled Chapter 4'
  }
];

for (const { label, content, title } of RAW_TEXT_CASES) {
  assertEqual(extractChapterTitleAndBody(content, 4).title, title, label);
}

// HTML's raw-text rules stop applying inside foreign content, where a
// self-closing `/` is honoured. The two readings are opposite and only the
// namespace separates them, which is why the reader tracks that rather than
// honouring `isSelfClosing` everywhere.
const FOREIGN_CONTENT_CASES: ReadonlyArray<{ label: string; content: string; title: string }> = [
  {
    label: 'an SVG `<title/>` closes itself and opens no raw text',
    content: '<h3><svg><title/></svg>Real Title</h3><p>Body.</p>',
    title: 'Real Title'
  },
  {
    label: 'and an SVG `<script/>`, which is an SVG element name too',
    content: '<h3><svg><script/></svg>Real Title</h3><p>Body.</p>',
    title: 'Real Title'
  },
  {
    label: 'a self-closing `<svg/>` opens no foreign content to leave',
    content: '<h3><svg/>Real Title</h3><p>Body.</p>',
    title: 'Real Title'
  },
  {
    label: 'and the namespace nests',
    content: '<h3><svg><svg><title/></svg></svg>Real Title</h3>',
    title: 'Real Title'
  },
  {
    label: 'but in HTML the `/` is ignored, so a bare `<title/>` really does open raw text',
    content: '<title/>Real Title<h3>Heading</h3>',
    title: 'Untitled Chapter 4'
  },
  // The two below are what actually discriminate the depth arithmetic, and both
  // needed an *unclosed* raw-text element to do it: a `<title>` that never
  // closes runs to the end for a browser, so the heading after it is not one.
  // Get the depth wrong and the reader leaves raw-text mode off, walks into
  // that text, and reports `Heading`. The obvious cases — `<svg/>` and nested
  // `<svg>` around a `<title/>` — pass either way, which is why they are not
  // the assertions this rests on.
  {
    label: 'a self-closing `<svg/>` leaves us in HTML, where the next `<title>` is raw text',
    content: '<svg/><title>unclosed<h3>Heading</h3>',
    title: 'Untitled Chapter 4'
  },
  {
    label: 'and a closing `</svg>` returns to HTML, where the same holds',
    content: '<svg></svg><title>unclosed<h3>Heading</h3>',
    title: 'Untitled Chapter 4'
  }
];

for (const { label, content, title } of FOREIGN_CONTENT_CASES) {
  assertEqual(extractChapterTitleAndBody(content, 4).title, title, label);
}

// A closing tag decides where the chapter's own prose resumes, so it may not
// sit on `findTagEnd`'s fallback boundary: accepting one emits the markup
// between that `>` and the tag's real end into the body as visible prose. The
// pattern this replaces required a literal `</h3>` and never produced that.
{
  const content = '<h3>Real Title</h3 data-x="a>b"class=x><p>Body prose.</p>';
  const { title, body } = extractChapterTitleAndBody(content, 4);

  assertEqual(title, 'Untitled Chapter 4', 'a closing tag with no well-formed reading is not a boundary');
  assertEqual(body, content, 'so nothing is cut from the body');
  // The failure shape was the body *beginning* at the fallback boundary, which
  // puts the rest of the opening tag at the front of the chapter's prose.
  assert(!body.startsWith('b"'), 'and the chapter does not begin on the tail of a truncated tag');
  assertEqual(
    stripLeadingChapterHeading(content),
    content,
    'and the append path does not emit it either'
  );
}

// The rule is about the *fallback*, not about attributes on a closing tag. One
// with a well-formed reading is still a boundary, `>` in a quoted value and all.
assertEqual(
  extractChapterTitleAndBody('<h3>Real Title</h3 data-x="a>b"><p>Body prose.</p>', 4).body,
  '<p>Body prose.</p>',
  'a well-formed closing tag still closes the heading'
);

// ==================== The differential ====================
//
// Every tag interior over an alphabet built from the characters the six defects
// turned on. The property asserted is the one #302's own metric could not see:
// against a browser, the scanner is never worse than the `[^>]*>` reading it
// replaces.

const ALPHABET = ['a', '=', '"', "'", '>', ' ', '/'];
const MAX_INTERIOR_LENGTH = 6;

function firstCloseAngle(value: string, tagStart: number): number {
  return value.indexOf('>', tagStart + 1);
}

let enumerated = 0;
let scannerAgrees = 0;
let patternAgrees = 0;
let scannerWorse = 0;
let scannerBetter = 0;

function measureInterior(interior: string): void {
  const content = `<h3${interior}>Real Title</h3>`;
  const reference = referenceTagEnd(content, 0);

  // A browser emits no tag here, so there is nothing to agree or disagree about.
  if (reference === -1) {
    return;
  }

  enumerated += 1;

  const scanner = findTagEnd(content, 0) === reference;
  const pattern = firstCloseAngle(content, 0) === reference;

  if (scanner) {
    scannerAgrees += 1;
  }
  if (pattern) {
    patternAgrees += 1;
  }
  if (pattern && !scanner) {
    scannerWorse += 1;
  }
  if (scanner && !pattern) {
    scannerBetter += 1;
  }
}

function walkInteriors(prefix: string): void {
  if (prefix.length > 0) {
    measureInterior(prefix);
  }

  if (prefix.length === MAX_INTERIOR_LENGTH) {
    return;
  }

  for (const character of ALPHABET) {
    walkInteriors(prefix + character);
  }
}

walkInteriors('');

assert(enumerated > 100_000, `the enumeration should be exhaustive over the alphabet, not sampled (was ${enumerated})`);
assert(
  scannerWorse === 0,
  `the scanner must never end a tag further from a browser than \`[^>]*>\` does (${scannerWorse} of ${enumerated} cases)`
);
assert(
  scannerBetter > 0,
  'the scanner must be strictly better somewhere, or this change buys nothing'
);
assert(
  scannerAgrees >= patternAgrees,
  `the scanner must agree with a browser at least as often as \`[^>]*>\` (${scannerAgrees} vs ${patternAgrees})`
);

// ==================== Linearity ====================
//
// Three of the six defects were exponential backtracking, and one of them —
// 32 repeats in 275ms, 36 in two seconds — is a serverless request that never
// returns. A scanner reads each character once, so this pins the property
// rather than hoping for it: the shapes that blew up on the pattern, at sizes
// where 2^n would be minutes.

const ADVERSARIAL_SHAPES: ReadonlyArray<{ label: string; repeat: string }> = [
  { label: 'missing value, no closing `>`', repeat: ' a=' },
  { label: 'whitespace around `=`', repeat: ' a = ' },
  { label: 'unterminated quoted value', repeat: ' a="b' },
  { label: 'slash after an assignment', repeat: ' a=//b' },
  { label: 'bare names', repeat: ' a' },
  { label: 'quote inside an unquoted value', repeat: ' a=b"' }
];

for (const { label, repeat } of ADVERSARIAL_SHAPES) {
  const content = `<h3${repeat.repeat(20_000)}`;
  const startedAt = Date.now();

  extractChapterTitleAndBody(content, 4);
  stripLeadingChapterHeading(content);

  const elapsed = Date.now() - startedAt;

  assert(elapsed < 2_000, `${label}: 20,000 repeats took ${elapsed}ms — this shape is not linear`);
}

console.log('Chapter heading reader tests passed');
console.log(
  `  differential: ${enumerated} tag interiors; scanner agrees with a browser ${scannerAgrees}, ` +
    `\`[^>]*>\` agrees ${patternAgrees}; scanner better ${scannerBetter}, worse ${scannerWorse}`
);
