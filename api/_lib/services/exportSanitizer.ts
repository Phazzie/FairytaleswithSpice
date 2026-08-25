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

const DANGEROUS_TAGS = new Set(DANGEROUS_CONTAINER_TAGS);
const DANGEROUS_BLOCK_TAGS = new Set([
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
]);
/**
 * The tags whose closing puts a line break into the plain-text export.
 *
 * Anything not named here falls through to the single space every other tag is
 * replaced with, so the break a reader sees is silently downgraded to a word
 * gap. The list stopped at `h3`, so `<h4>The Vault</h4><div>She opened the
 * door.</div>` exported as the one line `The Vault She opened the door.` — the
 * heading run into the prose under it, in the `.txt` and `.pdf` documents and
 * in the `.docx` body, which are the only renderings that go through here. The
 * remaining heading levels, the generic containers, the list and definition
 * wrappers, and the table row and cell elements are all block-level in the
 * markup the generator emits, so every one of them is a break.
 *
 * This is the same list `splitStoryIntoTextBlocks` reads for the scanners, and
 * it is complete for the same reason: a boundary left off it is not left to the
 * enclosing tag, it is deleted. `normalizePlainText` caps consecutive newlines
 * at two, so nested closings such as `</li></ul>` still end one paragraph
 * rather than opening a run of blank lines.
 */
const PLAIN_TEXT_BREAK_TAGS = new Set([
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
const PLAIN_TEXT_VOID_BREAK_TAGS = new Set(['br', 'hr']);
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
  return tokenizeHtml(removeDangerousHtml(html))
    .map(token => {
      if (!token) {
        return '';
      }

      if (token.startsWith('<') && token.endsWith('>')) {
        return sanitizeStoryTag(token);
      }

      return escapeStoryText(token);
    })
    .join('')
    .trim();
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

  for (const token of tokenizeHtml(removeDangerousHtml(html))) {
    if (token.startsWith('<') && token.endsWith('>')) {
      const parsed = parseHtmlTag(token);
      if (!parsed) {
        text += ' ';
        continue;
      }

      if (PLAIN_TEXT_VOID_BREAK_TAGS.has(parsed.tagName) && !parsed.isClosing) {
        text += '\n';
        continue;
      }

      if (parsed.isClosing && PLAIN_TEXT_BREAK_TAGS.has(parsed.tagName)) {
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

function removeDangerousHtml(html: string): string {
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

    if (DANGEROUS_TAGS.has(parsed.tagName)) {
      if (!parsed.isClosing && DANGEROUS_BLOCK_TAGS.has(parsed.tagName) && !parsed.isSelfClosing) {
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

function normalizePlainText(value: string): string {
  let normalized = '';
  let pendingSpace = false;
  let newlineCount = 0;

  for (const character of value) {
    if (character === '\n') {
      normalized = normalized.trimEnd();
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
