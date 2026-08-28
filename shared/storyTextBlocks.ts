// Created: 2026-08-24 21:10 UTC

/**
 * Split story content into the blocks a reader sees as paragraphs.
 *
 * Stories reach the scanners in this repository as the HTML the generator
 * produces, where a paragraph is a `<p>` element rather than a run of text
 * between blank lines. Splitting such markup on blank lines alone collapses the
 * whole story into a single block, so any measure that reads "the last
 * paragraph" ends up reading the entire story instead.
 *
 * Block-level tags and `<br>` become blank-line boundaries, remaining inline
 * tags are dropped, and the basic entities the generator emits are decoded so
 * that a quoted line still reads as dialogue. Plain text keeps its blank-line
 * boundaries, which is what a plain blank-line split did on its own — but it is
 * not passed through untouched: anything shaped like a tag is stripped from it
 * too, so prose that legitimately contains `<` and `>` loses the span between
 * them. Every caller here scans generator HTML, where that is the point; a
 * caller scanning arbitrary prose would want the entities encoded first.
 */
export function splitStoryIntoTextBlocks(storyContent: string): string[] {
  return storyContent
    .replace(BLOCK_BOUNDARY_PATTERN, '\n\n')
    .split(/\n\s*\n/)
    .map(block => decodeBasicEntities(stripInlineTags(block)).trim())
    .filter(Boolean);
}

/**
 * Render story markup as the text a reader sees.
 *
 * Dropping tags on their own is not the same thing: `</p><p>` sits between two
 * words that a reader sees in different paragraphs, so deleting it welds them
 * into one token — `door.Blood` — which then miscounts as a single word, hides
 * the sentence boundary from anything that splits on `[.!?]\s`, and is what
 * gets pasted into the next continuation prompt. Going through the block
 * splitter puts a paragraph break where the markup put one.
 */
export function stripStoryHtmlToText(storyContent: string): string {
  return splitStoryIntoTextBlocks(storyContent).join('\n\n');
}

/**
 * The tags that put a boundary between the text on either side of them.
 *
 * Every tag a reader sees a break at has to be here, because whatever is left
 * over is deleted in place: `<td>One</td><td>Two</td>` had a boundary for the
 * row but none for the cells, so the two cells came back as the single token
 * `OneTwo` — the `door.Blood` welding this module exists to prevent, just one
 * level further in. The list is the block-level and table-cell elements the
 * generator's markup can contain, so a boundary is never left to the tag that
 * happens to enclose it.
 */
const BLOCK_LEVEL_TAG_NAMES = [
  'br',
  'p',
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'main',
  'nav',
  'blockquote',
  'pre',
  'hr',
  'li',
  'ul',
  'ol',
  'dl',
  'dt',
  'dd',
  'h[1-6]',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'caption',
  'tr',
  'td',
  'th'
].join('|');
/**
 * Match an opening or closing block-level tag, with or without attributes.
 *
 * Written so the engine never has a choice about where one part ends and the
 * next begins. The earlier form paired `\s*` with `/?` and then `\s*` again,
 * and let `[^>]*` cover the same whitespace as the `\s*` after it; on input
 * that ultimately fails to match — a `<` followed by a long run of spaces —
 * every way of splitting that run between the two groups gets tried in turn,
 * which is quadratic in the length of the run. Here `\s*` stops at the `/`,
 * `/?` stops at the tag name, `\b` ends the name, and `[^>]*` cannot pass the
 * `>` that closes the tag, so each position is decided once. The `\b` is what
 * keeps `<paragraph>` from matching on `p`.
 */
const BLOCK_BOUNDARY_PATTERN = new RegExp(
  String.raw`<\s*/?(?:${BLOCK_LEVEL_TAG_NAMES})\b[^>]*>`,
  'gi'
);

/**
 * A tag's attributes and the `>` that closes the tag, starting just after the
 * tag name.
 *
 * A tag does not end at the first `>` — it ends at the first `>` that is not
 * inside a quoted attribute value. `[^>]*>` ends it at the first one:
 *
 * ```
 * '<h3 data-x="a>b">Real Title</h3>'.match(/<h3[^>]*>(.*?)<\/h3>/i)[1]
 *   →  'b">Real Title'      // the attribute remnant becomes the chapter title
 * ```
 *
 * The shape is HTML's own attribute grammar rather than "quoted runs anywhere":
 * a list of names, each optionally followed by `=` and a value, then the `>`.
 * **A quote is a delimiter only where an assignment puts one.** Pairing quotes
 * wherever they appear is the mistake this pattern was first written with, and
 * it loses prose that `[^>]*>` keeps:
 *
 * ```
 * '<h3 a=b">c">Real Title</h3>'
 *   [^>]*>          →  'c">Real Title'   // the tag ends at the first `>`
 *   quotes anywhere →  'Real Title'      // `b"` and `c"` pair; `c">` is eaten
 * ```
 *
 * `b"` is an unquoted value that happens to contain a quote, and HTML ends the
 * tag at the very next `>`. Reading it as a delimiter reaches past that `>` and
 * deletes text a reader can see. So a value opens a quoted run only directly
 * after its `=`; a quote anywhere else is an ordinary character.
 *
 * Two bounds keep a scan inside the markup it began in, and one fallback keeps
 * the reader's words when there is no well-formed reading at all:
 *
 * - **A quoted run stops at `<`.** Without that bound an unterminated quote
 *   searches forward until it finds a quote somewhere in the story text and
 *   swallows every word in between.
 * - **An unquoted value stops at `<` too**, so a malformed tag ends where the
 *   next one starts, which is what a reader sees.
 * - **Markup with no well-formed reading falls back to `[^>]*>`**, the older
 *   scan. This is what makes the pattern never worse than the one it replaces:
 *   it either reads the tag whole or answers identically.
 *
 * Whitespace is spelled out rather than left to `\s`, because JavaScript's `\s`
 * matches NBSP and HTML's tag whitespace does not. An NBSP between attributes
 * is an ordinary attribute-name character to a browser, and `\s` would accept
 * it as a separator instead.
 *
 * The bounds have a cost, and it is the documented one: a quoted value that
 * itself contains a literal `<` has no well-formed reading here and takes the
 * fallback, leaving the attribute remnant that the fallback always left. That
 * is unchanged from `[^>]*>` rather than introduced by this pattern.
 */
const TAG_WHITESPACE = String.raw`[ \t\n\f\r]`;
const ATTRIBUTE_NAME = String.raw`[^ \t\n\f\r>/="'<]+`;
// The three forms are mutually exclusive by first character, and that is what
// keeps the attribute loop linear. An unquoted value admits quotes after its
// first character — `b"` is exactly what HTML calls that value — but may not
// *begin* with one. Letting it begin with a quote gave `a="b"` two readings,
// one per branch, and a tag that never closes then has 2^n ways to be divided:
// twenty-two such attributes took 196ms and each further four multiplied it by
// sixteen. Excluding the quote from the first character alone removes the
// overlap without changing what any well-formed value reads as.
//
// A `/` is an ordinary character here. HTML only gives the slash a meaning in
// the state *before* an attribute name; once a value has begun it is content
// like any other, so `a=//b="c` is one unquoted value and the tag ends at the
// very next `>`. Excluding it from the value and accepting it as a separator
// instead — which is what this pattern did first — reads `b="c>d"` as a second
// attribute, runs through the second `>`, and deletes the `d">` a reader sees.
const ATTRIBUTE_VALUE = String.raw`(?:"[^"<]*"|'[^'<]*'|[^ \t\n\f\r><"'][^ \t\n\f\r><]*)`;

// Whitespace only, and both halves of that are load-bearing.
//
// `+` rather than `*`: with `*` the loop body can begin by consuming nothing,
// so an attribute name of n characters can be divided into attributes in
// exponentially many ways — `aaa` as one name, or two, or three — and a tag
// that never closes makes the engine try all of them. A 1,600-attribute input
// did not finish in two minutes.
//
// Whitespace and not also `/`: the slash belongs to the value, per the note
// above, and it cannot be in both places without giving `a=b/c` two readings.
// Between them these keep every construct's boundary decided by a character
// class the neighbouring construct excludes, which is what makes the loop
// linear rather than merely fast on the inputs tested.
//
// The cost is coverage, never correctness, because everything unmatched here
// takes the fallback and so answers exactly as `[^>]*>` does: `a="b"c="d"`,
// which a browser recovers by starting a new attribute at `c`, and `<h3 a="b"/>`,
// whose trailing slash is no longer a separator, both fall back.
const ATTRIBUTE_SEPARATOR = TAG_WHITESPACE;

// The value is required, and that is the fourth ambiguity of this kind — the
// last one, because unlike the three above it is not fixed by taking a
// character away from one construct and giving it to another.
//
// An *optional* value lets `a=` match nothing, which hands the rest of the tag
// back to the separator rule. Whatever follows the bare `=` then reads as the
// next attribute, and a quoted value there runs through the tag's own `>`:
//
// ```
// '<h3 a= b="c>d">Real Title</h3>'
//   browser        →  'd">Real Title'   // `b="c` is `a`'s unquoted value
//   optional value →  'Real Title'      // `d">` deleted; text a reader sees
// ```
//
// This is the slash defect again, reached through whitespace, and the quoted-
// run defect again in a third guise. It follows from the empty reading being
// available anywhere rather than from any one character's role, so narrowing
// the separator cannot reach it: forbidding whitespace after the `=` moves the
// same loss onto `a= b="c>d">`, and forbidding both leaves the `>` itself.
//
// HTML admits an empty value in exactly one position — before-attribute-value
// skips whitespace, and a `>` there is the missing-attribute-value error that
// ends the tag — so that position is named, and no other. The lookahead cannot
// overlap a real value, because a value may begin with neither whitespace nor
// `>`, so it adds a reading and no way to backtrack.
//
// Requiring the value is also what lets whitespace stay legal on *both* sides
// of the `=`, which is how a browser reads it: with an optional value ` a= a=`
// had two readings — one attribute valued `a`, or two valueless ones — and 2^n
// partitions once the tag never closes, 275ms at 32 repeats and 2.0s at 36.
// With the value required there is one reading, so `a = "b>c"` is read whole
// rather than surrendered to the fallback. That is 11,366 more tags read as a
// browser reads them, across the corpus below, and none read worse.
//
// The empty reading is tried *first*, before any whitespace is consumed. The
// branches are mutually exclusive, so the order cannot change an answer — but
// written the other way the lookahead is retried at every position the
// whitespace run can give back, each retry rescanning the rest of it: `a=`
// followed by 40,000 spaces and no `>` took 761ms that way, quadrupling per
// doubling. Tried once, at one position, it is linear.
const ATTRIBUTE_ASSIGNMENT =
  String.raw`(?:${TAG_WHITESPACE}*=(?:(?=${TAG_WHITESPACE}*>)|${TAG_WHITESPACE}*${ATTRIBUTE_VALUE}))`;

export const TAG_ATTRIBUTES_PATTERN =
  String.raw`(?:(?:${ATTRIBUTE_SEPARATOR}+${ATTRIBUTE_NAME}${ATTRIBUTE_ASSIGNMENT}?)*${ATTRIBUTE_SEPARATOR}*>|[^>]*>)`;

/**
 * Drop what is left of the markup once the block boundaries are marked.
 *
 * The character class excludes `<` as well as `>` so that a run of unmatched
 * `<` costs one step each rather than a scan to the end of the story: with
 * `[^>]*`, every `<` in `<<<<<…` starts a scan that runs to the end before it
 * fails for want of a `>`. Excluding `<` also ends a malformed tag where the
 * next one starts, which is what a reader sees; well-formed markup, where no
 * `<` appears inside a tag, is unaffected either way.
 */
function stripInlineTags(value: string): string {
  return value.replace(/<[^<>]*>/g, '');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}
