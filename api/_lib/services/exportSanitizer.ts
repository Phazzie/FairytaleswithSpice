// Created: 2026-06-05 02:20 EDT

// The tag reading this module is built on lives in `shared/htmlTagScanner`,
// moved there unchanged so the three other readers that had each spelled their
// own `[^>]*>` can call it rather than respell it a fifth time. See #296.
import { ParsedHtmlTag, parseHtmlTag, tokenizeHtml } from '../../../shared/htmlTagScanner';

const ALLOWED_STORY_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'h1',
  'h2',
  'h3',
  'section',
  'article',
  'ul',
  'ol',
  'li',
  'blockquote'
]);

const DANGEROUS_CONTAINER_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base'
];

const DANGEROUS_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'form',
  'button',
  'textarea',
  'select'
];

/**
 * Elements whose text describes the document rather than telling the story.
 *
 * Dropped with their contents for a different reason than the tags above —
 * nothing here is dangerous — but by the same mechanism, because the question
 * both lists answer is the same: is the text inside this element part of the
 * story being exported?
 *
 * `<title>` is the case that reaches the exports. `buildStoryHtmlDocument`
 * hands `/api/export/save` a whole HTML document, and its `<head>` names the
 * story: `<title>The Vampire's Bargain</title>` sits a few tags above
 * `<h1>The Vampire's Bargain</h1>`. `<meta>`, `<link>`, and `<base>` are
 * already dropped and `<style>` takes its contents with it, so `<title>` was
 * the one head element whose text survived — and, having no break of its own,
 * it arrived welded to the heading below it. Every `.txt`, `.pdf`, `.epub`,
 * and `.docx` export opened on the title run into itself, and the `.html`
 * export opened on a stray unheaded copy above the real `<h1>`.
 *
 * The title is not lost by dropping it: every format writes it from
 * `input.title`, which is what the field is for.
 */
const DOCUMENT_METADATA_CONTAINER_TAGS = ['title'];

/** Every tag dropped rather than exported, whichever list it came from. */
const DROPPED_TAGS = new Set([...DANGEROUS_CONTAINER_TAGS, ...DOCUMENT_METADATA_CONTAINER_TAGS]);
/** Those of them that take their contents with them. */
const DROPPED_BLOCK_TAGS = new Set([...DANGEROUS_BLOCK_TAGS, ...DOCUMENT_METADATA_CONTAINER_TAGS]);
/**
 * The block-level tags a reader sees a break at.
 *
 * In the plain-text export, the closing of one of these writes a line break;
 * anything not named here falls through to the single space every other tag is
 * replaced with, so the break a reader sees is silently downgraded to a word
 * gap. The list stopped at `h3`, so `<h4>The Vault</h4><div>She opened the
 * door.</div>` exported as the one line `The Vault She opened the door.` — the
 * heading run into the prose under it, in the `.txt` and `.pdf` documents and
 * in the `.docx` body. The remaining heading levels, the generic containers,
 * the list and definition wrappers, and the table row and cell elements are all
 * block-level in the markup the generator emits, so every one of them is a
 * break.
 *
 * The HTML export reads the same list, for the same reason and against a worse
 * failure: it replaces a tag outside `ALLOWED_STORY_TAGS` with nothing at all,
 * so the words on either side were welded rather than merely run together —
 * that same heading exported as `The VaultShe opened the door.`, and
 * `<td>One</td><td>Two</td>` as `OneTwo`, while the plain-text export of the
 * one story put each on its own line. This is the `door.</p><p>Blood` welding
 * `splitStoryIntoTextBlocks` exists to prevent, on the last path that still had
 * it.
 *
 * This is the same list `splitStoryIntoTextBlocks` reads for the scanners, and
 * it is complete for the same reason: a boundary left off it is not left to the
 * enclosing tag, it is deleted. `normalizePlainText` caps consecutive newlines
 * at two and `sanitizeStoryHtmlForExport` collapses a run of boundaries to one
 * `<br>`, so nested closings such as `</li></ul>` still end one paragraph
 * rather than opening a run of blank lines.
 */
const BLOCK_BREAK_TAGS = new Set([
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
 * Block-level elements that have no closing tag to break on, so the break has to
 * be taken when the tag itself is seen. `<br>` has always been read this way;
 * `<hr>` separates two passages just as plainly and was being written out as a
 * space between them.
 */
const VOID_BREAK_TAGS = new Set(['br', 'hr']);
const BASIC_HTML_ENTITY_REPLACEMENTS = [
  ['&nbsp;', ' '],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&amp;', '&']
];

export function escapeHtml(value: string): string {
  return [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ].reduce((escaped, [searchValue, replacement]) => replaceEvery(escaped, searchValue, replacement), value);
}

export function sanitizeStoryHtmlForExport(html: string): string {
  let sanitized = '';
  // A boundary is held until something follows it, so it is written only where
  // it separates two pieces of story: a leading or trailing one never reaches
  // the document, and a run of them — `</td></tr></table><div>` — writes the
  // single break a reader sees rather than one per tag.
  let blockBreakPending = false;

  for (const token of removeNonStoryHtml(html)) {
    if (!token) {
      continue;
    }

    const isTag = token.startsWith('<') && token.endsWith('>');
    if (isTag && isStrippedBlockBoundary(token)) {
      blockBreakPending = blockBreakPending || sanitized.length > 0;
      continue;
    }

    const rendered = isTag ? sanitizeStoryTag(token) : escapeStoryText(token);
    if (!rendered) {
      continue;
    }

    if (blockBreakPending) {
      blockBreakPending = false;
      // Nothing to add where the markup already ends on a break of its own: a
      // `<div>` after a `</p>` is one paragraph boundary, not two.
      if (!endsWithBlockBoundary(sanitized)) {
        sanitized += '<br>';
      }
    }

    sanitized += rendered;
  }

  return sanitized.trim();
}

/**
 * Whether a tag is one the sanitizer drops but a reader still sees a break at.
 *
 * Both ends of the element count, unlike the plain-text export, which can afford
 * to break on the closing tag alone because every other tag still leaves a space
 * behind. Here the opening tag leaves nothing, so `door.<div>Blood` would weld
 * on the way in exactly as `</div>` welds on the way out.
 */
function isStrippedBlockBoundary(token: string): boolean {
  const parsed = parseHtmlTag(token);
  if (!parsed || ALLOWED_STORY_TAGS.has(parsed.tagName)) {
    return false;
  }

  return VOID_BREAK_TAGS.has(parsed.tagName)
    ? !parsed.isClosing
    : BLOCK_BREAK_TAGS.has(parsed.tagName);
}

/**
 * Whether the document written so far already ends on a break, so a dropped
 * block tag beside one does not add a second. Trailing whitespace is skipped
 * because the text between two tags is emitted before the boundary is resolved.
 */
function endsWithBlockBoundary(sanitized: string): boolean {
  const trimmed = sanitized.trimEnd();
  if (trimmed.length === 0 || trimmed.endsWith('<br>')) {
    return true;
  }

  const closingTag = /<\/([a-z0-9]+)>$/i.exec(trimmed);
  return Boolean(closingTag && BLOCK_BREAK_TAGS.has(closingTag[1].toLowerCase()));
}

/**
 * The character references the HTML export leaves alone.
 *
 * Derived from the table the plain-text export decodes, in the same lowercase
 * and fully-uppercase forms `replaceEntity` recognises, so the two exports of
 * one story agree character for character: every reference this set preserves
 * is one the plain-text path turns into the character it stands for, and every
 * reference outside it stays literal in both.
 */
const PRESERVED_CHARACTER_REFERENCES = new Set(
  BASIC_HTML_ENTITY_REPLACEMENTS.flatMap(([entity]) => [entity, entity.toUpperCase()])
);

/**
 * Match either something shaped like a character reference or one character
 * that has to be escaped on its own.
 *
 * The reference shape comes first, so an `&` that begins one is offered whole
 * rather than being taken as the bare ampersand the trailing class would
 * otherwise claim; whether it is actually preserved is decided against
 * `PRESERVED_CHARACTER_REFERENCES`, not by this pattern. The name characters
 * cannot cross the `;` that ends the reference, so a run that never reaches one
 * fails once per `&` rather than being rescanned from inside itself.
 */
const STORY_TEXT_PATTERN = /&[#0-9a-zA-Z]+;|[&<>"']/g;

/**
 * Escape story text without re-escaping the references already in it.
 *
 * The story reaches this module as the generator's HTML, where `&` and `"` are
 * written as `&amp;` and `&quot;`. Escaping every `&` re-escaped those into
 * `&amp;amp;` and `&amp;quot;`, so the exported HTML rendered the entity text
 * itself — a reader saw `feet &amp; the &quot;hunter&quot; smiled` on the page
 * — while the plain-text export of the same story decoded them and showed the
 * punctuation.
 *
 * Only the references the plain-text path decodes are preserved, and that
 * restriction is what makes preserving any of them safe. An entity-shaped
 * literal that is not a reference cannot be passed through: HTML parses a
 * named reference by its longest valid prefix, with no `;` required, so
 * `&copycat;` in the text would reach a reader as `©cat;` rather than as the
 * `&copycat;` the story says. Anything outside the set — that literal, a
 * numeric reference, a bare `&`, an unterminated `&amp` — is escaped exactly as
 * it was before, which is always safe and always what the plain-text export
 * shows.
 */
function escapeStoryText(value: string): string {
  // `replace` drives the shared pattern's `lastIndex` itself, so no state
  // survives the call — which an `exec` loop would have to reset by hand on
  // every entry and every early return.
  return value.replace(STORY_TEXT_PATTERN, token =>
    PRESERVED_CHARACTER_REFERENCES.has(token) ? token : escapeHtml(token)
  );
}

export function stripStoryHtmlForExport(html: string): string {
  let text = '';

  for (const token of removeNonStoryHtml(html)) {
    if (token.startsWith('<') && token.endsWith('>')) {
      text += plainTextForTag(parseHtmlTag(token), text);
      continue;
    }

    text += token;
  }

  return decodeBasicEntities(normalizePlainText(text));
}

/**
 * What a tag contributes to the plain-text export: a line break where a reader
 * sees a boundary, and otherwise the single space that keeps the words on either
 * side of a dropped inline tag apart.
 *
 * Named rather than spelled inline, so this reader has the shape the HTML one
 * already has — a loop over tokens, and one place that decides what each token
 * means. The boundary rules are the interesting part and they are all here:
 *
 * - A void break element (`<br>`, `<hr>`) has no closing tag, so its own tag is
 *   the boundary.
 * - A block's close is a boundary.
 * - So is a block's **open**, but only where a break is not already there.
 *   `BLOCK_BREAK_TAGS` requires every boundary a reader sees to survive into
 *   both documents, and the HTML export counts both ends; breaking on the close
 *   alone was only ever sufficient while every closing tag was recognised.
 */
function plainTextForTag(parsed: ParsedHtmlTag | null, textSoFar: string): string {
  if (!parsed) {
    return ' ';
  }

  if (VOID_BREAK_TAGS.has(parsed.tagName) && !parsed.isClosing) {
    return '\n';
  }

  if (!BLOCK_BREAK_TAGS.has(parsed.tagName)) {
    return ' ';
  }

  if (parsed.isClosing) {
    return '\n';
  }

  return endsWithLineBreak(textSoFar) ? ' ' : '\n';
}

/**
 * Whether the plain text so far already ends on a line break, ignoring the
 * spaces every dropped inline tag leaves behind.
 */
function endsWithLineBreak(text: string): boolean {
  // Walked backwards rather than trimmed. This is asked once per block tag, and
  // trimming builds a copy of everything written so far each time — quadratic in
  // the length of a story, which is the one input this module is for. Reading
  // back over the trailing spaces costs only those spaces.
  for (let index = text.length - 1; index >= 0; index -= 1) {
    const character = text[index];
    if (character === '\n') {
      return true;
    }

    if (!isInlineWhitespace(character)) {
      return false;
    }
  }

  // Nothing but the spaces dropped tags leave behind, so there is no story text
  // yet for a break to separate from.
  return true;
}

/**
 * The characters WinAnsi encodes at a byte a Latin-1 reading would not.
 *
 * WinAnsi is Latin-1 above `0xA0`, so a code point in that range is its own
 * byte. The range `0x80`-`0x9F`, which Latin-1 leaves to the C1 control
 * characters, is where Windows put the punctuation prose is actually written
 * with — and it is exactly the punctuation a language model writes: the curly
 * quotes it closes dialogue with, the em dash it breaks a sentence on, the
 * ellipsis it trails off into. Without this table those are the characters that
 * cannot be written at all.
 */
const WIN_ANSI_PUNCTUATION_BYTES = new Map<number, number>([
  [0x20ac, 0x80], // €
  [0x201a, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02c6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8a], // Š
  [0x2039, 0x8b], // ‹
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9a], // š
  [0x203a, 0x9b], // ›
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e], // ž
  [0x0178, 0x9f]  // Ÿ
]);

/** What a character WinAnsi has no byte for is written as. */
const PDF_UNMAPPABLE_CHARACTER = '?';

/**
 * The byte WinAnsi writes a character as, or `undefined` for one it cannot.
 *
 * `0x80`-`0x9F` as *code points* are the C1 controls, not the punctuation the
 * table above maps onto those bytes, so they are unmappable rather than passed
 * through as themselves.
 */
function toWinAnsiByte(codePoint: number): number | undefined {
  if (codePoint >= 0x20 && codePoint <= 0x7e) {
    return codePoint;
  }

  if (codePoint >= 0xa0 && codePoint <= 0xff) {
    return codePoint;
  }

  return WIN_ANSI_PUNCTUATION_BYTES.get(codePoint);
}

/**
 * Write one line of story text as the bytes a PDF literal string holds.
 *
 * A PDF string is bytes, and the font decides which glyph each byte names. The
 * export writes its document out as UTF-8, so every character above ASCII went
 * into the string as the two or three bytes UTF-8 spells it with — and the
 * Helvetica the document declares reads each of those bytes as a glyph of its
 * own. So `don’t` reached the reader as `donâ€™t`, `—` as `â€"`, and `café` as
 * `cafÃ©`: not an encoding a reader could switch, but the wrong number of
 * characters, in a document that otherwise looked fine. Every story this app
 * generates is affected, because a model writes curly quotes and em dashes in
 * ordinary prose.
 *
 * Both halves of the fix have to be here. `/Encoding /WinAnsiEncoding` on the
 * font (see `ExportService`) says which byte means which glyph — without it
 * Helvetica falls back to StandardEncoding, which has no accented letters at
 * all and puts the quote marks somewhere else again. And the text has to be
 * written in that encoding rather than in UTF-8, which is what this does: each
 * character becomes its WinAnsi byte, written as an octal escape wherever it is
 * not printable ASCII. Escaping rather than emitting the byte raw keeps the
 * whole document ASCII, so writing it out as UTF-8 — which `generateExportContent`
 * does, and which is what a byte above `0x7F` would be mangled by — leaves the
 * bytes exactly as they are counted in the stream's `/Length`.
 *
 * A character WinAnsi has no byte for — an emoji, a name in a non-Latin script —
 * becomes `?`. That is a real loss, and it is the loss this format has: a
 * fourteen-glyph base font cannot show a character it has no glyph for, and the
 * alternative is the mojibake above. The other four export formats are Unicode
 * throughout and keep such a story whole.
 */
export function escapePdfText(value: string): string {
  let escaped = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    // Control characters have no glyph and would end the line, or the string,
    // in the middle of the operator that shows it.
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      escaped += ' ';
      continue;
    }

    if (character === '\\' || character === '(' || character === ')') {
      escaped += `\\${character}`;
      continue;
    }

    const byte = toWinAnsiByte(codePoint);
    if (byte === undefined) {
      escaped += PDF_UNMAPPABLE_CHARACTER;
      continue;
    }

    // Printable ASCII is written as itself; everything else as the three-digit
    // octal escape, which is unambiguous however the next character begins.
    escaped += byte <= 0x7e ? String.fromCharCode(byte) : `\\${byte.toString(8).padStart(3, '0')}`;
  }

  return escaped;
}

/**
 * Escape text that is going into an XML document rather than an HTML one.
 *
 * XML 1.0 admits no C0 control character but tab, newline, and carriage
 * return, and a document holding one is not merely untidy — it is not
 * well-formed, so a conforming parser must refuse it. The `.epub` and `.docx`
 * exports are XML in a zip container, and both interpolated story text and the
 * story's title straight into that XML: a control character anywhere in either
 * produced a file that downloaded under the right name, at the right size, and
 * then failed to open, with the reader told only that it was corrupt.
 *
 * Nothing upstream removes them. `stripStoryHtmlForExport` treats tab, carriage
 * return, form feed, and vertical tab as whitespace and collapses them, but a
 * `BEL` or a `SUB` is not whitespace to it and travels through unchanged, and
 * the title never goes through it at all. The PDF path has replaced these with
 * a space since it was written, for its own reasons; this is the same reading
 * for the two formats that cannot survive them.
 */
export function escapeXmlText(value: string): string {
  return escapeHtml(replaceXmlForbiddenCharacters(value));
}

function replaceXmlForbiddenCharacters(value: string): string {
  let sanitized = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isAllowedWhitespace = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;

    sanitized += (codePoint <= 0x1f && !isAllowedWhitespace) || codePoint === 0x7f
      ? ' '
      : character;
  }

  return sanitized;
}

/**
 * The tokens of `html` that are part of the story, with the dropped elements and
 * their contents removed.
 *
 * Returns the surviving **tokens** rather than a rejoined string, and the
 * callers iterate them directly. Rejoining and re-tokenizing is not a no-op: the
 * survivors of a fallback reading can sit next to each other in a way the
 * original markup never did, and the second pass then reads that seam as
 * markup. `<p x=">"<> Visible > After.</p>` tokenizes to `<p x=">`, `"`, `<>`
 * and prose; drop the `<>` and the rejoined string is `<p x=">" Visible >
 * After.</p>`, in which the quote and the sentence now look like an attribute
 * list — so the sentence is read as part of a tag and never reaches the reader.
 *
 * Handing the tokens straight through means text a recovery pass preserved
 * cannot be re-read as markup on a second look.
 */
function removeNonStoryHtml(html: string): string[] {
  const kept: string[] = [];
  const skip: SkipState = { tag: null, depth: 0, integrationPointDepth: 0 };

  for (const token of tokenizeHtml(html)) {
    if (!token.startsWith('<') || !token.endsWith('>')) {
      if (!skip.tag) {
        kept.push(token);
      }
      continue;
    }

    const parsed = parseHtmlTag(token);
    if (!parsed) {
      continue;
    }

    // A tag met inside a skip is consumed by it, unless it is the HTML tag that
    // ends the skip — which is then read below as if the element had closed.
    if (skip.tag && advanceSkip(skip, parsed)) {
      continue;
    }

    if (DROPPED_TAGS.has(parsed.tagName)) {
      openSkipIfBlock(skip, parsed);
      continue;
    }

    kept.push(token);
  }

  return kept;
}

/**
 * The element currently being skipped, and how deep the reader is inside it.
 *
 * `integrationPointDepth` counts the integration points open within a foreign
 * element. Inside one, HTML tags are ordinary content and do not break out.
 */
interface SkipState {
  tag: string | null;
  depth: number;
  integrationPointDepth: number;
}

/**
 * Advance the skip past one tag.
 *
 * Returns whether the skip consumed the tag. `false` means the skip has just
 * ended on this tag and the caller should read it as HTML — which happens only
 * on a foreign-content breakout, since a closing tag ends the skip *after*
 * itself and is consumed.
 */
function advanceSkip(skip: SkipState, parsed: ParsedHtmlTag): boolean {
  const skippedBlockTag = skip.tag as string;

  if (skip.integrationPointDepth === 0 && breaksOutOfForeignContent(skippedBlockTag, parsed)) {
    skip.tag = null;
    skip.depth = 0;
    return false;
  }

  countIntegrationPoint(skip, skippedBlockTag, parsed);
  countSkippedBlock(skip, skippedBlockTag, parsed);
  return true;
}

/** Track entry to and exit from an integration point of the skipped element. */
function countIntegrationPoint(skip: SkipState, skippedBlockTag: string, parsed: ParsedHtmlTag): void {
  if (!isIntegrationPoint(skippedBlockTag, parsed)) {
    return;
  }

  if (parsed.isClosing) {
    // Never below zero: a stray closing tag must not leave the count negative,
    // where a later opener would read as depth 0 and let a breakout fire inside
    // the element it had just entered.
    skip.integrationPointDepth = Math.max(0, skip.integrationPointDepth - 1);
  } else if (!parsed.isSelfClosing) {
    // A self-closing `<desc/>` opens nothing, so counting it would hold the
    // skip open for the rest of the container.
    skip.integrationPointDepth += 1;
  }
}

/** Track nesting of the skipped element itself, ending the skip when it closes. */
function countSkippedBlock(skip: SkipState, skippedBlockTag: string, parsed: ParsedHtmlTag): void {
  if (parsed.tagName !== skippedBlockTag) {
    return;
  }

  if (parsed.isClosing) {
    skip.depth -= 1;
    if (skip.depth <= 0) {
      skip.tag = null;
      skip.integrationPointDepth = 0;
    }
    return;
  }

  if (!closesItself(parsed) && !NON_NESTING_DROPPED_TAGS.has(skippedBlockTag)) {
    skip.depth += 1;
  }
}

/** Begin skipping a dropped element that takes its contents with it. */
function openSkipIfBlock(skip: SkipState, parsed: ParsedHtmlTag): void {
  if (parsed.isClosing || !DROPPED_BLOCK_TAGS.has(parsed.tagName) || closesItself(parsed)) {
    return;
  }

  skip.tag = parsed.tagName;
  skip.depth = 1;
  // `integrationPointDepth` is already 0 here and is not reset again: a skip
  // ends either on its own closing tag, which resets it, or on a breakout,
  // which can only fire at 0. A reset here would be a guard no test could fail.
}

function sanitizeStoryTag(token: string): string {
  const parsed = parseHtmlTag(token);
  if (!parsed) {
    return '';
  }

  if (!ALLOWED_STORY_TAGS.has(parsed.tagName)) {
    return '';
  }

  if (parsed.tagName === 'br') {
    return parsed.isClosing ? '' : '<br>';
  }

  return parsed.isClosing ? `</${parsed.tagName}>` : `<${parsed.tagName}>`;
}

/**
 * The dropped elements a trailing `/` really does close.
 *
 * `<svg/>` closes itself because SVG and MathML are foreign content, where the
 * self-closing slash is part of the syntax. **In HTML it is not.** A parser
 * ignores it on `<script/>`, `<style/>`, `<iframe/>` and the rest, so their
 * contents run to the matching closing tag exactly as if the slash were absent.
 *
 * Honouring it on those would put the element's contents into the export as
 * story text: `<script data-x="a>b"/>stealPrivateStory()</script>` never enters
 * block-skipping, and the script body is read as prose. This mattered only once
 * the tokenizer began reading such a tag whole — before that the truncation lost
 * the `/` and the block was skipped by accident.
 */
const SELF_CLOSING_DROPPED_TAGS = new Set(['svg', 'math', 'embed']);

/**
 * The dropped elements whose contents are text rather than markup, so they
 * cannot nest.
 *
 * `script`, `style` and `iframe` are parsed by HTML's generic raw-text
 * algorithm, and `textarea` and `title` by the escapable-raw-text one: everything between the tags is character data
 * until the matching close, and a `<script/>` written *inside* a script is a
 * string, not a tag. Counting it as one leaves the skip depth stuck above zero
 * and the closing tag then only gets it back to one — so
 * `<script>const t = "<script/>";</script>` swallows the rest of the story.
 *
 * `form`, `button` and `select` are here for a different reason with the same
 * effect. HTML ignores a `<form>` start tag while a form is open; a nested
 * `<button>` closes the button already in scope; a nested `<select>` closes the
 * active one. In all three a second opener never leaves an extra element for the
 * closing tag to account for.
 *
 * The other dropped containers really can nest — `<svg><svg></svg></svg>` is two
 * elements — which is why this is a list and not a blanket rule. Only the
 * *opening* side is affected: `</script>` inside a string does end a script
 * element, in this reader as in a browser.
 */
const NON_NESTING_DROPPED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'textarea',
  'title',
  'form',
  'button',
  'select'
]);

/** Whether this tag's trailing `/` actually closes it. */
function closesItself(parsed: ParsedHtmlTag): boolean {
  return parsed.isSelfClosing && SELF_CLOSING_DROPPED_TAGS.has(parsed.tagName);
}

/**
 * The dropped elements whose contents are parsed as markup in another language.
 *
 * `svg` and `math` are the two foreign-content integration points, and they are
 * the only skipped elements a *following HTML tag* can end. Everything else on
 * `DROPPED_BLOCK_TAGS` is either raw text — where `<p>` is characters, not a tag
 * — or ordinary HTML, where an unmatched opener really does run to EOF.
 */
const FOREIGN_CONTENT_TAGS = new Set(['svg', 'math']);

/**
 * The HTML start tags that end foreign content wherever they appear inside it.
 *
 * HTML's tree construction has no way to nest these in SVG or MathML: on
 * meeting one, the parser pops every foreign element and reads the tag as HTML.
 * So `<svg>hidden</svg!><p>Story.</p>` puts the paragraph *outside* the SVG —
 * the malformed `</svg!>` never has to be understood for the story to survive
 * it, because the `<p>` breaks out on its own.
 *
 * Without this, classifying a tag by its whole name (which is right, and is what
 * keeps `</script!>` from ending a script early) made a near-miss closing tag
 * unmatchable, and the skip then ran to the end of the document taking the rest
 * of the story with it. That was a regression against the first-`>` reader this
 * module replaced, which stopped at `</svg!>` by accident of truncation.
 *
 * Spec list, minus `font` — which breaks out only when it carries `color`,
 * `face` or `size`, and which this module has no reason to treat as a boundary.
 */
const FOREIGN_CONTENT_BREAKOUT_TAGS = new Set([
  'b', 'big', 'blockquote', 'body', 'br', 'center', 'code', 'dd', 'div', 'dl',
  'dt', 'em', 'embed', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'hr', 'i',
  'img', 'li', 'listing', 'menu', 'meta', 'nobr', 'ol', 'p', 'pre', 'ruby', 's',
  'small', 'span', 'strong', 'strike', 'sub', 'sup', 'table', 'tt', 'u', 'ul',
  'var'
]);

/**
 * Whether this tag ends the foreign element currently being skipped.
 *
 * Only a start tag breaks out; `</p>` inside an `<svg>` is ignored by a parser
 * rather than treated as a boundary.
 */
function breaksOutOfForeignContent(skippedBlockTag: string, parsed: ParsedHtmlTag): boolean {
  return FOREIGN_CONTENT_TAGS.has(skippedBlockTag)
    && !parsed.isClosing
    && FOREIGN_CONTENT_BREAKOUT_TAGS.has(parsed.tagName);
}

/**
 * The elements inside foreign content whose own children are parsed as HTML.
 *
 * This is the exception the breakout list has to be read against. `<p>` pops
 * every foreign element *when it is a child of the foreign element itself* — so
 * `<svg><p>text</p></svg>` really does put the paragraph outside the SVG, which
 * is why breaking out is right. Inside an integration point it does not: the
 * children of `<foreignObject>`, of SVG's `<desc>` and `<title>`, and of
 * MathML's text integration points are HTML *within* the foreign subtree, and a
 * parser stays inside it.
 *
 * Skipping is a containment decision, so the difference is reader-visible.
 * `<svg><foreignObject><p>secret</p></foreignObject></svg>` exported `secret`
 * in all five formats: the `<p>` ended the skip, and everything after it —
 * still SVG content — was kept as story. `main` dropped it, so it was a
 * containment regression against the reader this module replaces, not a
 * pre-existing limit.
 *
 * Nesting is counted rather than flagged, because these elements nest: an
 * `<svg>` inside a `<foreignObject>` may carry another `<foreignObject>`, and a
 * single flag cleared on the first closing tag would break out inside the outer
 * one.
 *
 * `annotation-xml` is included unconditionally, which is the deliberately
 * cautious reading of a case this module cannot decide. It is an HTML
 * integration point only when its `encoding` is `text/html` or
 * `application/xhtml+xml` — an attribute, and this reader knows tag names only.
 * The two spellings want opposite answers:
 *
 * - carrying that encoding, its children are HTML *inside* the MathML, and
 *   breaking out on them exports MathML content that `main` drops. A
 *   containment regression.
 * - unadorned, its children really are outside, and holding the skip open
 *   drops text a browser shows — but `main` drops that text too, so nothing
 *   regresses; only an improvement is forgone.
 *
 * One spelling costs containment against `main`, the other costs an
 * improvement over it. This module drops `math` for containment, so it takes
 * the second. Both directions are asserted.
 */
const FOREIGN_CONTENT_INTEGRATION_POINTS: Record<string, Set<string>> = {
  svg: new Set(['foreignobject', 'desc', 'title']),
  math: new Set(['mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml'])
};

/** Whether this tag opens or closes an integration point of the skipped element. */
function isIntegrationPoint(skippedBlockTag: string, parsed: ParsedHtmlTag): boolean {
  return FOREIGN_CONTENT_INTEGRATION_POINTS[skippedBlockTag]?.has(parsed.tagName) ?? false;
}

function replaceEvery(value: string, searchValue: string, replacement: string): string {
  return value.split(searchValue).join(replacement);
}




/**
 * Drop the spaces and tabs a line ends on, and nothing else.
 *
 * `normalizePlainText` tidies the end of the text every time it writes a
 * newline, and used `String.prototype.trimEnd` to do it — which counts a
 * newline as trailing whitespace and so deleted the breaks already written.
 * That only showed once a third break arrived in a row, because the first two
 * were rewritten immediately afterwards and the third is the one the two-break
 * cap declines to rewrite: `One.\n` was trimmed back to `One.` and left that
 * way, and the paragraphs either side of the boundary were welded into
 * `One.Two.`.
 *
 * Three breaks in a row is not an edge case here — it is what the app's own
 * export sends. `buildStoryHtmlDocument` writes one tag per line, so an
 * ordinary `</p>\n<hr>\n<section>` contributes a break for the closing tag, a
 * break for each literal newline between the tags, and a break for the `<hr>`.
 * Every `.txt`, `.pdf`, `.epub`, and `.docx` export of a generated story
 * therefore lost the paragraph break at each of those boundaries, which is the
 * `door.</p><p>Blood` welding the block-boundary table above exists to prevent
 * — reintroduced one layer below it.
 */
function trimTrailingInlineWhitespace(value: string): string {
  let end = value.length;

  while (end > 0 && isInlineWhitespace(value[end - 1])) {
    end -= 1;
  }

  return value.slice(0, end);
}

function normalizePlainText(value: string): string {
  let normalized = '';
  let pendingSpace = false;
  let newlineCount = 0;

  for (const character of value) {
    if (character === '\n') {
      normalized = trimTrailingInlineWhitespace(normalized);
      if (newlineCount < 2) {
        normalized += '\n';
        newlineCount += 1;
      }
      pendingSpace = false;
      continue;
    }

    if (isInlineWhitespace(character)) {
      pendingSpace = normalized.length > 0 && newlineCount === 0;
      continue;
    }

    if (pendingSpace && normalized.length > 0 && !normalized.endsWith('\n')) {
      normalized += ' ';
    }

    normalized += character;
    pendingSpace = false;
    newlineCount = 0;
  }

  return normalized.trim();
}


function isTagNameCharacter(character: string | undefined): boolean {
  if (!character) {
    return false;
  }

  const codePoint = character.codePointAt(0) ?? 0;
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122) ||
    character === '-' ||
    character === ':'
  );
}


function isInlineWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\r' || character === '\f' || character === '\v';
}

function decodeBasicEntities(value: string): string {
  return BASIC_HTML_ENTITY_REPLACEMENTS.reduce(
    (decoded, [entity, replacement]) => replaceEntity(decoded, entity, replacement),
    value
  );
}

function replaceEntity(value: string, entity: string, replacement: string): string {
  return replaceEvery(replaceEvery(value, entity, replacement), entity.toUpperCase(), replacement);
}
