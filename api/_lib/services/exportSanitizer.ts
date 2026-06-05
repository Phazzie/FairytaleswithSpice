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
const PLAIN_TEXT_BREAK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'li', 'blockquote', 'section', 'article']);

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

      return escapeHtml(token);
    })
    .join('')
    .trim();
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

      if (parsed.tagName === 'br' && !parsed.isClosing) {
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
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
