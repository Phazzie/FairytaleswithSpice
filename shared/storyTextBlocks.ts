// Created: 2026-08-24 21:10 UTC

import { findTagEnd, parseHtmlTag } from './htmlTagScanner';

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
 * **Only the tag boundary changes.** `findTagEnd` is called rather than
 * `tokenizeHtml`, and the difference is comments. `tokenizeHtml` drops a
 * comment whole, which is what a browser does and is better than what this
 * module does — but it also still ends one only at `-->`, and the other three
 * endings HTML allows are #307's row of #296, unmerged. Adopting it today would
 * take `<h3>Visible <!--> Title</h3>` down to `Visible`, a regression
 * `tests/chapter-heading-reader.test.ts` catches. `findTagEnd` has no comment
 * rule at all: it hands back the first `>` for anything it cannot read as a
 * tag, which is exactly what the two patterns did. So `<!-- note: a > b -->`
 * still leaks `b -->` as a visible block here, unchanged and still #296's to
 * settle. Once #307 lands this module can call `tokenizeHtml` and inherit the
 * whole comment reading, which is the move this one sets up.
 */
function markBlockBoundaries(storyContent: string): string {
  const pieces: string[] = [];
  let index = 0;

  while (index < storyContent.length) {
    const tagStart = storyContent.indexOf('<', index);
    if (tagStart === -1) {
      pieces.push(storyContent.slice(index));
      break;
    }

    if (tagStart > index) {
      pieces.push(storyContent.slice(index, tagStart));
    }

    // A `<` with no `>` after it anywhere closes no tag, so it is text the
    // reader typed. The old pass kept it for the same reason — neither pattern
    // could match without a `>` — and so does this.
    const tagEnd = findTagEnd(storyContent, tagStart);
    if (tagEnd === -1) {
      pieces.push(storyContent.slice(tagStart));
      break;
    }

    // A tag the scanner will not name is a comment, a declaration, a processing
    // instruction, or a `<` the reader typed that happens to close. None of
    // them is a paragraph break, and all of them were dropped in place before,
    // so they still are.
    const tag = parseHtmlTag(storyContent.slice(tagStart, tagEnd + 1));
    if (tag !== null && BLOCK_LEVEL_TAG_NAMES.has(tag.tagName)) {
      pieces.push('\n\n');
    }

    index = tagEnd + 1;
  }

  return pieces.join('');
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

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}
