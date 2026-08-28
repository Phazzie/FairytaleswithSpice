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
 * Match the rest of a tag once its name has been read, attributes and all.
 *
 * A tag does not end at the first `>` — it ends at the first `>` that is not
 * inside a quoted attribute value. Reading it as `[^>]*>` stops early on
 * `<p title="a>b">`, so the tag's own remaining text (`b">`) was left behind as
 * prose and reached the reader: through `stripStoryHtmlToText` that is what
 * gets exported and pasted into the next continuation prompt.
 *
 * This is the unrolled form of "unquoted runs separated by quoted ones". The
 * unquoted run and the two quoted alternatives can never start on the same
 * character, so each position is still decided once and no input has two ways
 * to match. A quoted run stops at `<` because an unterminated quote must not
 * be allowed to swallow the story's own dialogue looking for a partner: `<` is
 * where the next tag starts, and that bounds the damage to the markup it began
 * in.
 */
function tagAttributesPattern(unquotedRun: string): string {
  return `${unquotedRun}*(?:(?:"[^"<]*"|'[^'<]*')${unquotedRun}*)*`;
}

/**
 * What each reader may cross while it is not inside a quoted attribute value.
 *
 * The two differ in one character, and the difference is the inline reader's
 * existing protection against a run of `<`, kept here rather than dropped: see
 * `stripInlineTags` below for why it excludes `<` and the block reader does not.
 */
const BLOCK_TAG_UNQUOTED_RUN = "[^>\"']";
const INLINE_TAG_UNQUOTED_RUN = "[^<>\"']";

/**
 * Match an opening or closing block-level tag, with or without attributes.
 *
 * Written so the engine never has a choice about where one part ends and the
 * next begins. The earlier form paired `\s*` with `/?` and then `\s*` again,
 * and let `[^>]*` cover the same whitespace as the `\s*` after it; on input
 * that ultimately fails to match — a `<` followed by a long run of spaces —
 * every way of splitting that run between the two groups gets tried in turn,
 * which is quadratic in the length of the run. Here `\s*` stops at the `/`,
 * `/?` stops at the tag name, and `\b` ends the name, so each position is
 * decided once. The `\b` is what keeps `<paragraph>` from matching on `p`.
 *
 * The `[^>]*>` alternative is the older reading, kept as a fallback rather
 * than as an equal: markup whose quote never closes has no well-formed reading
 * at all, and answering it exactly as before is better than declining to see a
 * boundary there and leaving the raw tag in the text.
 */
const BLOCK_BOUNDARY_PATTERN = new RegExp(
  String.raw`<\s*/?(?:${BLOCK_LEVEL_TAG_NAMES})\b(?:${tagAttributesPattern(BLOCK_TAG_UNQUOTED_RUN)}>|[^>]*>)`,
  'gi'
);

/**
 * Drop what is left of the markup once the block boundaries are marked.
 *
 * The character class excludes `<` as well as `>` so that a run of unmatched
 * `<` costs one step each rather than a scan to the end of the story: with
 * `[^>]*`, every `<` in `<<<<<…` starts a scan that runs to the end before it
 * fails for want of a `>`. Excluding `<` also ends a malformed tag where the
 * next one starts, which is what a reader sees; well-formed markup, where no
 * `<` appears inside a tag, is unaffected either way.
 *
 * An inline tag ends where a block-level one does — past its quoted attribute
 * values, not at the first `>` inside one — so `<em title="a>b">` leaves no
 * `b">` behind either. That reading is offered only to a `<` that begins a tag
 * name, because prose is where this runs: `Price < 5. "x > y."` is not markup,
 * and letting a quoted run reach across it would delete more of the sentence
 * than the older reading did. Tag-shaped or not, the `[^<>]*>` alternative
 * still answers exactly as before.
 */
function stripInlineTags(value: string): string {
  return value.replace(INLINE_TAG_PATTERN, '');
}

const INLINE_TAG_PATTERN = new RegExp(
  String.raw`<\s*/?[a-zA-Z]${tagAttributesPattern(INLINE_TAG_UNQUOTED_RUN)}>|<[^<>]*>`,
  'g'
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
