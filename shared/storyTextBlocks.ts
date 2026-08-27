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
  return splitStoryIntoRenderedParagraphs(storyContent).flat();
}

/**
 * The same blocks, still grouped by the rendered paragraph each came from.
 *
 * `splitStoryIntoTextBlocks` answers with one flat list because a `<br>` has to
 * end a block for the same reason a `</p>` does — the words on either side of
 * one would otherwise weld into a single token. But the two boundaries are not
 * the same thing to a reader: a `</p><p>` starts a new paragraph, and a `<br>`
 * only wraps a line inside the paragraph already open. The flat list cannot
 * tell them apart, so a caller joining adjacent blocks back together cannot
 * know whether it is repairing one paragraph the markup broke in half or
 * welding two paragraphs the author wrote separately.
 *
 * That distinction is not decorative. `<p>She wanted to be</p><p>continued
 * through the next trial.</p>` is two ordinary paragraphs of prose, and joining
 * them synthesizes the phrase `to be continued` that neither one contains —
 * which is exactly the false positive `EXPLICIT_CLIFFHANGER_LABELS` was pruned
 * to remove, re-entering through the repair rather than through the lexicon.
 *
 * So the outer array is what the reader sees as paragraphs and the inner one is
 * the lines a `<br>` wrapped within each. The flattening above is the whole of
 * the old function, which keeps the two from drifting: there is one definition
 * of where a boundary falls, and the flat list is derived from the grouped one
 * rather than computed a second way.
 */
export function splitStoryIntoRenderedParagraphs(storyContent: string): string[][] {
  return storyContent
    .replace(PARAGRAPH_BOUNDARY_PATTERN, '\n\n')
    .split(/\n\s*\n/)
    .map(paragraph =>
      paragraph
        .replace(LINE_BREAK_BOUNDARY_PATTERN, '\n\n')
        .split(/\n\s*\n/)
        .map(block => decodeBasicEntities(stripInlineTags(block)).trim())
        .filter(Boolean)
    )
    .filter(paragraph => paragraph.length > 0);
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
 *
 * `br` is not in this list, and is not an omission: it ends a block too, and
 * `splitStoryIntoRenderedParagraphs` applies it as its own boundary directly
 * below the paragraph split, so the flat list of blocks is unchanged. It is
 * named apart because it is the one boundary here that does *not* start a new
 * paragraph, and telling the two kinds apart is what lets a caller know whether
 * two adjacent blocks are one paragraph the markup broke or two the author
 * wrote.
 */
const PARAGRAPH_LEVEL_TAG_NAMES = [
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
 * Match an opening or closing tag from one of the lists above, with or without
 * attributes.
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
function boundaryPattern(tagNames: string): RegExp {
  return new RegExp(String.raw`<\s*/?(?:${tagNames})\b[^>]*>`, 'gi');
}

/** Where a reader sees a new paragraph begin. */
const PARAGRAPH_BOUNDARY_PATTERN = boundaryPattern(PARAGRAPH_LEVEL_TAG_NAMES);

/** Where a reader sees a line wrap inside the paragraph already open. */
const LINE_BREAK_BOUNDARY_PATTERN = boundaryPattern('br');

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
