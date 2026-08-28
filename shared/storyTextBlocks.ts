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
 * Match the attributes of a tag whose name has already been read.
 *
 * A tag does not end at the first `>` — it ends at the first `>` that is not
 * inside a quoted attribute value. Reading it as `[^>]*>` stops early on
 * `<p title="a>b">`, so the tag's own remaining text (`b">`) was left behind as
 * prose and reached the reader: through `stripStoryHtmlToText` that is what the
 * client's plain-text download renders, and what the continuity excerpts and
 * the next continuation prompt are built from. (The server's own exports go
 * through `stripStoryHtmlForExport` instead, which has its own copy of this
 * defect and is not fixed here.)
 *
 * **This describes a whole well-formed tag, and that shape is the point.** Only
 * markup that parses as one is read this way; everything else falls to the
 * `[^>]*>` reading the module has always used. So the question a reader of this
 * module should ask — "what happens to malformed markup?" — has one answer for
 * every malformed shape rather than one per shape: it is answered exactly as it
 * was before attributes were understood at all.
 *
 * That property is worth more than it looks, because the alternative was tried
 * first and did not hold. The earlier form matched the *inside* of a tag and
 * added a rule for each way prose could be mistaken for it — the value must
 * open after `=`, must close before whitespace, must not cross `<`. Each rule
 * was correct HTML and each closed a real hole, and review kept finding another
 * shape that satisfied all of them and still swallowed a sentence:
 * `<p ">…`, `<p.foo="…`, `<p ="…`, `<p x=y="…`. Enumerating what malformed
 * markup looks like does not terminate. Describing what well-formed markup
 * looks like does, and everything else is the fallback by construction.
 *
 * The pieces are ordinary HTML: a tag is a run of attributes, each a name with
 * an optional `=` and a value, quoted or bare, ending in an optional `/` and
 * the `>`. Every piece excludes `<`, because a well-formed tag never contains
 * one — which also bounds an unterminated quote to the markup it began in
 * rather than letting it hunt through the story's dialogue for a partner.
 *
 * Each position is still decided once: `\s+` and the name characters are
 * disjoint, so there is never a choice about where one attribute ends and the
 * next begins, and every iteration consumes at least two characters.
 *
 * **Known limit.** An attribute value legitimately containing `<` —
 * `<p title="1 < 2 and 3 > 2">` — is therefore not read whole; it falls to the
 * older reading and keeps the remnant, exactly as it did before, so it is an
 * unfixed case rather than a new one. Admitting `<` was measured rather than
 * guessed, and it costs more than it repairs: it lets a run reach *across*
 * tags, which is the failure this module most needs not to have. The generator
 * emits `<p>`, `<em>` and `<h3>` with at most a class, so an attribute carrying
 * a literal `<` is not a shape it produces, while a truncated tag is.
 */
/**
 * What a name may be built from, in a tag or an attribute.
 *
 * Excludes the characters that end or delimit a name — whitespace, `/`, `>`,
 * `=` and both quotes — and `<`, which cannot appear inside a well-formed tag
 * at all.
 */
const TAG_NAME_CHARACTER = String.raw`[^\s/<>"'=]`;

/**
 * An attribute's value: quoted, where it may contain the `>` this whole change
 * is about, or bare, where it may not contain anything that would end the tag.
 */
const ATTRIBUTE_VALUE = `"[^"<]*"|'[^'<]*'|${TAG_NAME_CHARACTER}+`;

const WELL_FORMED_TAG_ATTRIBUTES =
  String.raw`(?:\s+${TAG_NAME_CHARACTER}+(?:=(?:${ATTRIBUTE_VALUE}))?)*\s*/?`;

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
  String.raw`<\s*/?(?:${BLOCK_LEVEL_TAG_NAMES})\b(?:${WELL_FORMED_TAG_ATTRIBUTES}>|[^>]*>)`,
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
 * `b">` behind either. It has to be read here as well as in the boundary
 * pattern: a malformed tag the block reader declines to see is left for this
 * one, so a reading either of them gets wrong deletes the same prose.
 *
 * The well-formed reading is offered only to a `<` that begins a tag name,
 * because prose is where this runs: `Price < 5. "x > y."` is not markup, and
 * letting a quoted value reach across it would delete more of the sentence than
 * the older reading did. Tag-shaped or not, the `[^<>]*>` alternative still
 * answers exactly as before.
 */
function stripInlineTags(value: string): string {
  return value.replace(INLINE_TAG_PATTERN, '');
}

const INLINE_TAG_PATTERN = new RegExp(
  String.raw`<\s*/?[a-zA-Z]${TAG_NAME_CHARACTER}*${WELL_FORMED_TAG_ATTRIBUTES}>|<[^<>]*>`,
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
