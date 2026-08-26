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

export function escapePdfText(value: string): string {
  return [
    ['\\', String.raw`\\`],
    ['(', String.raw`\(`],
    [')', String.raw`\)`]
  ].reduce(
    (escaped, [searchValue, replacement]) => replaceEvery(escaped, searchValue, replacement),
    replacePdfControlCharacters(value)
  );
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

function replacePdfControlCharacters(value: string): string {
  let sanitized = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    sanitized += codePoint <= 0x1f || codePoint === 0x7f ? ' ' : character;
  }

  return sanitized;
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

    const tagEnd = value.indexOf('>', tagStart + 1);
    if (tagEnd === -1) {
      tokens.push(value.slice(tagStart));
      break;
    }

    tokens.push(value.slice(tagStart, tagEnd + 1));
    index = tagEnd + 1;
  }

  return tokens;
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
