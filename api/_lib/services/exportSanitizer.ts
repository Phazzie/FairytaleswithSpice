// Created: 2026-06-05 02:20 EDT

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

interface ParsedHtmlTag {
  tagName: string;
  isClosing: boolean;
  isSelfClosing: boolean;
}

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

  for (const token of tokenizeHtml(removeNonStoryHtml(html))) {
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

  for (const token of tokenizeHtml(removeNonStoryHtml(html))) {
    if (token.startsWith('<') && token.endsWith('>')) {
      const parsed = parseHtmlTag(token);
      if (!parsed) {
        text += ' ';
        continue;
      }

      if (VOID_BREAK_TAGS.has(parsed.tagName) && !parsed.isClosing) {
        text += '\n';
        continue;
      }

      if (parsed.isClosing && BLOCK_BREAK_TAGS.has(parsed.tagName)) {
        text += '\n';
        continue;
      }

      text += ' ';
      continue;
    }

    text += token;
  }

  return decodeBasicEntities(normalizePlainText(text));
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

function removeNonStoryHtml(html: string): string {
  let output = '';
  let skippedBlockTag: string | null = null;
  let skippedBlockDepth = 0;

  for (const token of tokenizeHtml(html)) {
    if (!token.startsWith('<') || !token.endsWith('>')) {
      if (!skippedBlockTag) {
        output += token;
      }
      continue;
    }

    const parsed = parseHtmlTag(token);
    if (!parsed) {
      continue;
    }

    if (skippedBlockTag) {
      if (parsed.tagName === skippedBlockTag && !parsed.isClosing && !parsed.isSelfClosing) {
        skippedBlockDepth += 1;
      }

      if (parsed.tagName === skippedBlockTag && parsed.isClosing) {
        skippedBlockDepth -= 1;
        if (skippedBlockDepth <= 0) {
          skippedBlockTag = null;
        }
      }

      continue;
    }

    if (DROPPED_TAGS.has(parsed.tagName)) {
      if (!parsed.isClosing && DROPPED_BLOCK_TAGS.has(parsed.tagName) && !parsed.isSelfClosing) {
        skippedBlockTag = parsed.tagName;
        skippedBlockDepth = 1;
      }

      continue;
    }

    output += token;
  }

  return output;
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

function replaceEvery(value: string, searchValue: string, replacement: string): string {
  return value.split(searchValue).join(replacement);
}

function tokenizeHtml(value: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < value.length) {
    const tagStart = value.indexOf('<', index);
    if (tagStart === -1) {
      tokens.push(value.slice(index));
      break;
    }

    if (tagStart > index) {
      tokens.push(value.slice(index, tagStart));
    }

    // Comments are dropped whole: their body is markup, not story prose, so it
    // must never be scanned for tags or emitted as visible text.
    if (value.startsWith('<!--', tagStart)) {
      const commentEnd = value.indexOf('-->', tagStart + 4);
      if (commentEnd === -1) {
        break;
      }

      index = commentEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(value, tagStart);
    if (tagEnd === -1) {
      tokens.push(value.slice(tagStart));
      break;
    }

    tokens.push(value.slice(tagStart, tagEnd + 1));
    index = tagEnd + 1;
  }

  return tokens;
}

/**
 * Where the tag opening at `tagStart` ends.
 *
 * A tag does not end at the first `>` — it ends at the first `>` that is not
 * inside a quoted attribute value. Reading `<p class="a>b">Hello.</p>` with the
 * first `>` splits the tag mid-attribute, and the remainder (`b">Hello.`) is
 * then read as prose. That fragment reaches every export: `stripStoryHtmlForExport`
 * feeds `ExportService.toPlainText`, which `.txt`, `.pdf`, `.epub` and `.docx`
 * all go through, and `sanitizeStoryHtmlForExport` carries it into `.html`.
 *
 * The truncation also costs the trailing `/` of a self-closing tag, which is
 * worse than a visible fragment because it is silent: `<svg data-x="1>2"/>`
 * parsed as a plain opening tag puts `removeNonStoryHtml` into block-skipping
 * for an element that never closes, and every word after it is dropped from the
 * export.
 *
 * Prose is what this runs on, so widening what a match may cross is the risk to
 * weigh against the fragment. Two limits keep the scan inside the markup it
 * began in, and a fallback keeps malformed markup reading exactly as it did
 * before:
 *
 * 1. A quoted run stops at `<`, which is where the next tag starts.
 * 2. An attribute value's closing quote must be followed by whitespace, `/` or
 *    `>` — HTML's own syntax, never a word character. Without this,
 *    `<p class='unterminated>It's dangerous > here.</p>` finds the malformed
 *    attribute's partner in the apostrophe of `It's`, runs on to the `>` after
 *    `dangerous`, and deletes the words between them. Losing prose the reader
 *    wrote is worse than the fragment this function exists to remove.
 *
 * Where neither reading applies the caller falls back to the older first-`>`
 * scan, so markup with no well-formed reading is tokenized exactly as before.
 *
 * Returns `-1` when no `>` closes the tag at all.
 */
function findTagEnd(value: string, tagStart: number): number {
  // Only scan as a tag what could be one. `parseHtmlTag` already refuses a `<`
  // that no tag name follows, and the two have to agree: `<=">a">` is a `<` in
  // the prose, not markup, and reading a quoted value out of it lets the run
  // reach the story text after it. Anything else gets the older reading.
  const attributesStart = findAttributesStart(value, tagStart);
  if (attributesStart === -1) {
    return value.indexOf('>', tagStart + 1);
  }

  let index = attributesStart;
  // A quoted value can only begin where a value is expected: directly after the
  // `=` of an assignment, whitespace aside. A quote anywhere else is a character
  // inside an unquoted value, not a delimiter — `<p data-x=a"b>` is one such,
  // and treating its `"` as an opening quote sends the scan looking for a
  // partner in the story text after the tag.
  let valueExpected = false;
  // An `=` is only an assignment when an attribute name precedes it. A bare one
  // is not: HTML reads the `=` of `<v =">openedx">` as the attribute's *name*
  // and ends the tag at the first `>`, which is what the older scan does too.
  let attributeNameSeen = false;

  while (index < value.length) {
    const character = value[index];

    if (character === '>') {
      return index;
    }

    // The next tag starts here, so this one has no well-formed end.
    if (character === '<') {
      break;
    }

    if (character === '=' && attributeNameSeen) {
      valueExpected = true;
      attributeNameSeen = false;
      index += 1;
      continue;
    }

    if (valueExpected && (character === '"' || character === "'")) {
      const valueEnd = findAttributeValueEnd(value, index);
      if (valueEnd === -1) {
        break;
      }

      index = valueEnd + 1;
      valueExpected = false;
      attributeNameSeen = false;
      continue;
    }

    if (isWhitespace(character)) {
      // Whitespace ends an attribute name, but between `=` and its value it is
      // still the value's position.
      attributeNameSeen = false;
    } else {
      // Any other character is an attribute name, or an unquoted value — either
      // way the next quote is a character in it rather than a delimiter.
      attributeNameSeen = true;
      valueExpected = false;
    }

    index += 1;
  }

  // No well-formed reading: answer exactly as the older scan did.
  return value.indexOf('>', tagStart + 1);
}

/**
 * Where the quoted attribute value opening at `quoteStart` closes, or `-1`.
 *
 * Bounded at `<` and at the follow-set described on `findTagEnd`, which are the
 * two rules that stop an unterminated quote reaching across the story text after
 * it.
 */
function findAttributeValueEnd(value: string, quoteStart: number): number {
  const quote = value[quoteStart];
  let index = quoteStart + 1;

  while (index < value.length) {
    const character = value[index];

    if (character === '<') {
      return -1;
    }

    // The first candidate decides. A quote that the follow-set rejects means
    // this value has no well-formed end — not that the end is somewhere further
    // on, because "further on" is where the story text is. Hunting for a later
    // quote is what walks into the prose: `<p title="a>b"class=x>` has a real
    // closing quote followed by `c`, and scanning past it reaches the quote in
    // the sentence after the tag and swallows everything between.
    if (character === quote) {
      return mayEndAttributeValue(value[index + 1]) ? index : -1;
    }

    index += 1;
  }

  return -1;
}

/**
 * Where this tag's attributes begin: just past the tag name, read exactly as
 * `parseHtmlTag` reads it — optional whitespace, an optional `/`, then the
 * tag-name characters.
 *
 * Skipping the name is what makes the `=` in `<e=">openedx">` not an
 * assignment. Scanning from the `<` instead would let the name's own `e` count
 * as the attribute name before it, so the scanner would read `">openedx"` as a
 * quoted value and swallow the sentence. HTML reads that `=` as more tag name
 * and ends the tag at the first `>`, which is what the older scan already did.
 *
 * A `<` that no tag name follows — `<=">a">`, a `<` in the prose rather than
 * markup — skips nothing and starts at the character after it, where the same
 * "an `=` needs a name before it" rule in `findTagEnd` refuses it too.
 */
function findAttributesStart(value: string, tagStart: number): number {
  let index = tagStart + 1;

  while (isWhitespace(value[index])) {
    index += 1;
  }

  if (value[index] === '/') {
    index += 1;
    while (isWhitespace(value[index])) {
      index += 1;
    }
  }

  while (isTagNameCharacter(value[index])) {
    index += 1;
  }

  return index;
}

/** What may follow an attribute value's closing quote. Never a word character. */
function mayEndAttributeValue(character: string | undefined): boolean {
  return character === undefined || isWhitespace(character) || character === '/' || character === '>';
}

function parseHtmlTag(token: string): ParsedHtmlTag | null {
  if (!token.startsWith('<') || !token.endsWith('>')) {
    return null;
  }

  let index = 1;
  while (isWhitespace(token[index])) {
    index += 1;
  }

  if (token[index] === '!' || token[index] === '?') {
    return null;
  }

  const isClosing = token[index] === '/';
  if (isClosing) {
    index += 1;
  }

  while (isWhitespace(token[index])) {
    index += 1;
  }

  const tagNameStart = index;
  while (isTagNameCharacter(token[index])) {
    index += 1;
  }

  if (index === tagNameStart) {
    return null;
  }

  return {
    tagName: token.slice(tagNameStart, index).toLowerCase(),
    isClosing,
    isSelfClosing: token.slice(0, -1).trimEnd().endsWith('/')
  };
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

function isWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\n' || character === '\t' || character === '\r' || character === '\f';
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
