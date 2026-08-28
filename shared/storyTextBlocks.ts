// Created: 2026-08-24 21:10 UTC

import { findWellFormedTagEnd } from './htmlTagScanner';

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
  return markBlockBoundaries(storyContent)
    .split(/\n\s*\n/)
    .map(block => decodeBasicEntities(block).trim())
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
 * Replace every tag with either a blank-line boundary or nothing, leaving the
 * reader-visible text between them untouched.
 *
 * This reads the markup with `shared/htmlTagScanner`, the one left-to-right
 * reader the export sanitizer and both chapter-heading readers already share.
 * It used to be spelled here as two patterns ending in `[^>]*>` and `[^<>]*>`,
 * and that spelling ends a tag at the *first* `>` rather than at the first one
 * outside a quoted attribute value — the fault #296 filed against four readers
 * at once. This was the fourth, and the last: `<p title="a>b">Alpha.` came back
 * as the block `b">Alpha.`, and `<em title="x>y">certain` welded `y">certain`
 * into the middle of a sentence.
 *
 * That matters more here than the leaked characters suggest, because this
 * module is not an export path — it is what every quality scanner in the
 * repository reads. The same fragment reaches `countStoryWords`, the
 * last-paragraph cliffhanger scan, the scene sentence an image prompt is built
 * from, the excerpt carried into the next chapter's continuity prompt, and the
 * text the app copies to the clipboard.
 *
 * Using the scanner rather than a fifth pattern is the conclusion #296, #295
 * and #302 all reached the hard way: across those two attempts a better pattern
 * produced six defects, three of them exponential backtracking and three of
 * them deleting text a reader wrote. A scanner consumes each character once and
 * cannot have the fault at all.
 *
 * **Only the well-formed reading changes; everything else answers as before.**
 * `findWellFormedTagEnd` is the half of `findTagEnd` above its fallback, and it
 * returns `-1` rather than a boundary wherever the attribute grammar cannot
 * read the markup. That distinction is the whole of this function's shape, and
 * it is load-bearing twice over.
 *
 * Where there is a well-formed reading, its `>` ends the tag. That is the
 * repair, and it is the only thing the scanner is asked for — `readTagAt`
 * explains why the *name* still comes from the pattern.
 *
 * Where there is not, the two original patterns are asked, in their original
 * order, and they decide — so every input without a well-formed reading is
 * answered exactly as it was before this change. Taking `findTagEnd`'s
 * first-`>` fallback instead looks equivalent and is not, in two ways that both
 * cost reader-visible text:
 *
 * - **`Alpha < Beta <em>Gamma</em>`.** The first-`>` fallback runs from the `<`
 *   a reader typed to the `>` of the *later, real* `<em>`, swallowing
 *   ` < Beta <em>` whole and leaving `Alpha Gamma`. `<[^<>]*>` stops at the
 *   next `<`, so it never matches here and the prose survives. Deleting words
 *   the reader wrote is the one outcome worse than the fragment this change
 *   removes, and it is the fault #295 and #302 hit three times between them.
 * - **`One.</ p>Two.`.** HTML reads `</` followed by a space as a bogus
 *   comment, not a `</p>`, and so did the block pattern — it allows whitespace
 *   *before* the slash, never between the slash and the name, so the space
 *   sits where the name has to be and nothing matches. `parseHtmlTag` skips
 *   whitespace after the slash and answers `p`, which would insert a paragraph
 *   break a browser does not, and move every measure that reads the last
 *   paragraph.
 *
 * A `<` that none of the three readings accepts is emitted as the character it
 * is and the scan resumes one past it, which is what lets the real tag after it
 * still be found — and is why the last `>` is located once, above the loop,
 * rather than searched for at every `<`.
 *
 * **Comments do not move.** `tokenizeHtml` drops a comment whole, which is what
 * a browser does and is better than what this module does — but it still ends
 * one only at `-->`, and the other three endings HTML allows are #307's row of
 * #296, unmerged. Adopting it today would take `<h3>Visible <!--> Title</h3>`
 * down to `Visible`, a regression `tests/chapter-heading-reader.test.ts`
 * catches. A comment has no well-formed tag reading, so it falls to
 * `<[^<>]*>` exactly as before, and `<!-- note: a > b -->` still leaks `b -->`
 * as a visible block. That stays #296's to settle; once #307 lands this module
 * can call `tokenizeHtml` and inherit the whole comment reading.
 */
function markBlockBoundaries(storyContent: string): string {
  const pieces: string[] = [];
  let index = 0;

  // Every reading needs a `>` after the `<` to match at all, so past the last
  // one in the input there is nothing but text. Found once, because asking
  // `indexOf('>', tagStart)` per `<` is quadratic on the shape that asks it
  // most — `<<<<<…>`, where each `<` is rejected, the scan resumes one
  // character on, and the search runs to the same distant `>` every time. That
  // measured 260ms at 200,000 characters and 994ms at 400,000.
  const lastGreaterThan = storyContent.lastIndexOf('>');

  while (index < storyContent.length) {
    const tagStart = storyContent.indexOf('<', index);
    if (tagStart === -1) {
      pieces.push(storyContent.slice(index));
      break;
    }

    if (tagStart > index) {
      pieces.push(storyContent.slice(index, tagStart));
    }

    if (tagStart >= lastGreaterThan) {
      pieces.push(storyContent.slice(tagStart));
      break;
    }

    const tag = readTagAt(storyContent, tagStart);
    if (tag === null) {
      pieces.push('<');
      index = tagStart + 1;
      continue;
    }

    if (tag.isBlockBoundary) {
      pieces.push('\n\n');
    }

    index = tag.end + 1;
  }

  return pieces.join('');
}

interface ReadTag {
  /** Index of the `>` that ends it. */
  end: number;
  isBlockBoundary: boolean;
}

/**
 * Read the tag opening at `tagStart`, or `null` where nothing here is markup.
 *
 * **The scanner decides where the tag ends; the original patterns decide what
 * it means.** Separating the two is the whole correction, because the defect
 * was only ever in the span. Classification was right — and every attempt to
 * re-derive it from the scanner drifted, in both directions:
 *
 * - `parseHtmlTag` is *more* permissive about what ends a tag name. It stops
 *   only at whitespace, `/` or `>`, so it reads `</ p>` as a `p` and inserts a
 *   paragraph break where HTML has a bogus comment and the block pattern had
 *   nothing.
 * - It is also *less* permissive, because `\b` ends a name at any non-word
 *   character. `<p">`, `<p=>` and `<p<>` were all paragraph breaks under the
 *   block pattern and became names like `p"` that match nothing — 894 lost
 *   breaks across the fragment enumeration, each one welding two paragraphs.
 *
 * So the name test stays exactly the pattern it always was, and only the extent
 * of the tag comes from the scanner. Where the scanner has a well-formed
 * reading its `>` is used, which is the repair; the prefix is asked separately
 * whether that tag is a boundary. Where it has none, the two original patterns
 * answer in their original order and this module behaves precisely as it did.
 */
function readTagAt(value: string, tagStart: number): ReadTag | null {
  // The prefix alone settles the name: given a `>` somewhere after it — and
  // `wellFormedEnd` is one — the pattern's own `[^>]*>` tail cannot fail.
  const wellFormedEnd = findWellFormedTagEnd(value, tagStart);
  if (wellFormedEnd !== -1) {
    return {
      end: wellFormedEnd,
      isBlockBoundary: matchAt(LEGACY_BLOCK_TAG_PREFIX_PATTERN, value, tagStart) !== null
    };
  }

  const legacyBlockTag = matchAt(LEGACY_BLOCK_TAG_PATTERN, value, tagStart);
  if (legacyBlockTag !== null) {
    return { end: tagStart + legacyBlockTag.length - 1, isBlockBoundary: true };
  }

  const legacyAnyTag = matchAt(LEGACY_ANY_TAG_PATTERN, value, tagStart);
  if (legacyAnyTag !== null) {
    return { end: tagStart + legacyAnyTag.length - 1, isBlockBoundary: false };
  }

  return null;
}

/** The text a sticky pattern matches starting exactly at `index`, or `null`. */
function matchAt(pattern: RegExp, value: string, index: number): string | null {
  pattern.lastIndex = index;
  const match = pattern.exec(value);

  return match === null ? null : match[0];
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
 *
 * A set of names rather than a pattern alternation, now that the scanner hands
 * back the element's name instead of a matched span. `h[1-6]` is spelled out
 * for the same reason, and `parseHtmlTag` has already lowercased what is
 * checked against it.
 */
const BLOCK_LEVEL_TAG_NAMES = new Set([
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
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
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
]);

/**
 * The two original patterns, unchanged except for being anchored.
 *
 * They are kept verbatim on purpose. Their job is no longer to find tags — the
 * scanner does that — but to answer for the markup the scanner refuses, and the
 * only way to be sure that answer is the one this module has always given is
 * for it to be given by the same expressions. Rewriting them as a walk would
 * make the fallback a reimplementation to be tested rather than the original to
 * be preserved.
 *
 * Sticky rather than anchored with `^` so that each is tried at one position
 * against the whole string, never against a slice: slicing at every `<` is what
 * would make this quadratic.
 *
 * The two differ in one character class, and that difference is the reason
 * `Alpha < Beta <em>` keeps its prose: `[^>]*` may cross a `<`, `[^<>]*` may
 * not. They are asked in this order because the block pass ran first.
 */
const LEGACY_BLOCK_TAG_NAMES_PATTERN = [...BLOCK_LEVEL_TAG_NAMES].join('|');
const LEGACY_BLOCK_TAG_PATTERN = new RegExp(
  String.raw`<\s*/?(?:${LEGACY_BLOCK_TAG_NAMES_PATTERN})\b[^>]*>`,
  'iy'
);
const LEGACY_ANY_TAG_PATTERN = /<[^<>]*>/y;

/**
 * The block pattern with its `[^>]*>` tail removed — the half that names the
 * element, for use where the scanner has already found the tag's `>`.
 *
 * Splitting it this way rather than re-deriving the name is what keeps the
 * classification bit-identical: `\b` is doing real work here, ending the name
 * at `"`, `=` or `<` as well as at whitespace, and it is the reason
 * `<paragraph>` is not a `<p>` and `<p">` is.
 */
const LEGACY_BLOCK_TAG_PREFIX_PATTERN = new RegExp(
  String.raw`<\s*/?(?:${LEGACY_BLOCK_TAG_NAMES_PATTERN})\b`,
  'iy'
);

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}
