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

const BLOCK_LEVEL_TAG_NAMES = 'p|div|section|article|blockquote|li|ul|ol|h[1-6]|figure|figcaption|table|tr';
const BLOCK_BOUNDARY_PATTERN = new RegExp(
  String.raw`<\s*br\s*/?\s*>|<\s*/?\s*(?:${BLOCK_LEVEL_TAG_NAMES})(?:\s[^>]*)?\s*/?\s*>`,
  'gi'
);

function stripInlineTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
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
