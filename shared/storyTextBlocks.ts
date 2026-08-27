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
 *
 * **The markup is walked once, and nothing is ever written into the text to
 * stand for a boundary.** Each match of `BLOCK_BOUNDARY_PATTERN` is classified
 * by its own leading tag name and ends either a block or a paragraph; the text
 * between matches is appended as it stands. Two earlier versions of this
 * function did it by rewriting the string instead, and each failed in its own
 * way, which is why it is worth stating what the walk avoids:
 *
 * - *Marking the two kinds in two passes* left the second pass searching text
 *   the first had already cut up, so `<br\n\nclass="x">` — a tag whose
 *   attributes contain a blank line — was torn in half by the paragraph split
 *   before the `<br>` pattern could see it, and its halves survived into the
 *   blocks as raw markup (`A<br`, `class="x">B`).
 * - *Marking line wraps with a sentinel character* then had to strip that
 *   character from the input so a caller could not forge a boundary with it —
 *   and stripping it is itself a change to what `splitStoryIntoTextBlocks`
 *   returns. In-band signalling cannot avoid that trade: either the sentinel is
 *   removable from the input, which alters the text, or it is not, which lets
 *   the input forge boundaries. Both `\0` and a private-use code point were
 *   tried; the problem is the technique, not the character.
 *
 * Carrying the boundary kind beside the text rather than inside it has neither
 * failure, and leaves the flat list byte-identical to what the splitter
 * returned before this function existed — for every input, not merely for
 * inputs that avoid whichever character was load-bearing.
 *
 * Known limit, inherited rather than introduced: a *raw* blank line is read as a
 * paragraph boundary even inside an open `<p>`, where a browser would collapse
 * it as ordinary whitespace. `<p>To be<br>\n\ncontinued</p>` is therefore
 * grouped as two paragraphs. That is the flat splitter's own long-standing
 * conflation — blank lines have always ended a block, which is what plain-text
 * callers depend on — and unpicking it would change `splitStoryIntoTextBlocks`'s
 * output for every scanner that reads it, so it is a slice of its own. It errs
 * safely here: extra boundaries make the final paragraph *smaller*, so a caller
 * joining within one can only miss a repair, never invent one.
 */
export function splitStoryIntoRenderedParagraphs(storyContent: string): string[][] {
  const paragraphs: string[][] = [];
  let paragraph: string[] = [];
  let pending = '';

  const endBlock = () => {
    const block = decodeBasicEntities(stripInlineTags(pending)).trim();
    if (block) {
      paragraph.push(block);
    }
    pending = '';
  };
  const endParagraph = () => {
    endBlock();
    if (paragraph.length) {
      paragraphs.push(paragraph);
      paragraph = [];
    }
  };
  // A raw blank line ends a paragraph, which is how plain text gets any
  // structure at all — see the known limit above for what that costs inside an
  // open `<p>`.
  const addText = (text: string) => {
    text.split(BLANK_LINE_PATTERN).forEach((piece, index) => {
      if (index > 0) {
        endParagraph();
      }
      pending += piece;
    });
  };

  let textStart = 0;
  for (const match of storyContent.matchAll(BLOCK_BOUNDARY_PATTERN)) {
    addText(storyContent.slice(textStart, match.index));
    if (LINE_BREAK_TAG_PATTERN.test(match[0])) {
      endBlock();
    } else {
      endParagraph();
    }
    textStart = match.index + match[0].length;
  }
  addText(storyContent.slice(textStart));
  endParagraph();

  return paragraphs;
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
 * `br` is not in this list, and is not an omission: it ends a block too, and is
 * added back into `BLOCK_BOUNDARY_PATTERN` below so the one walk still sees
 * every boundary. It is named apart because it is the one boundary here that
 * does *not* start a new paragraph, and telling the two kinds apart is what lets
 * a caller know whether two adjacent blocks are one paragraph the markup broke
 * or two the author wrote.
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
function boundaryPattern(tagNames: string, flags: string): RegExp {
  return new RegExp(String.raw`<\s*/?(?:${tagNames})\b[^>]*>`, flags);
}

/**
 * Every tag that ends a block, `br` included — the one pass, over the markup as
 * it arrived, that decides where all the boundaries are.
 */
const BLOCK_BOUNDARY_PATTERN = boundaryPattern(`${PARAGRAPH_LEVEL_TAG_NAMES}|br`, 'gi');

/**
 * Whether a tag the pass above matched is the one kind that does *not* start a
 * new paragraph.
 *
 * Reads the tag's **own leading name** and nothing else. Searching the matched
 * text for a `<br>` anywhere in it is not the same question and gets a different
 * answer: `[^>]*` stops at the first `>`, so a quoted attribute containing a tag
 * hands this a truncated match — `<div title="Use <br>` — in which an
 * unanchored search finds the attribute's `<br>` and calls the `<div>` a line
 * wrap. Two rendered paragraphs then merge into one group and a consumer joins
 * across a real block boundary, which is the one thing the grouping exists to
 * prevent.
 *
 * Deliberately not global either: `.test()` on a `g` pattern advances
 * `lastIndex` and so answers differently on the same input from one call to the
 * next, which in a classifier is a defect waiting for its second caller.
 */
const LINE_BREAK_TAG_PATTERN = /^<\s*\/?br\b/i;

/**
 * Where a reader sees a paragraph end in text that carries no markup.
 *
 * Split out because the walk above applies it to each run of text *between*
 * boundary tags, rather than to the whole document after the tags have been
 * rewritten. Nothing is ever written into the string to stand for a boundary,
 * which is the property that matters: an earlier version marked line wraps with
 * a sentinel character and had to strip that character from caller input to
 * stop it forging one, and stripping it is itself a change to what
 * `splitStoryIntoTextBlocks` returns. In-band signalling cannot avoid that
 * trade — either the sentinel is removable from input, which changes the text,
 * or it is not, which lets input forge boundaries. Carrying the boundary kind
 * beside the text instead of inside it has neither problem.
 */
const BLANK_LINE_PATTERN = /\n\s*\n/;

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
