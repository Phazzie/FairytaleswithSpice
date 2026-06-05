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

const DANGEROUS_CONTAINER_PATTERN = new RegExp(
  String.raw`<\s*(${DANGEROUS_CONTAINER_TAGS.join('|')})\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>`,
  'gi'
);
const DANGEROUS_SINGLE_TAG_PATTERN = new RegExp(
  String.raw`<\s*\/?\s*(?:${DANGEROUS_CONTAINER_TAGS.join('|')})\b[^>]*>`,
  'gi'
);
const HTML_TOKEN_PATTERN = /(<[^>]*>)/g;
const HTML_TAG_PATTERN = /^<\s*(\/)?\s*([a-zA-Z0-9:-]+)(?:\s[^>]*)?\/?\s*>$/;

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
  return removeDangerousHtml(html)
    .split(HTML_TOKEN_PATTERN)
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
    .replace(/\s+\n/g, '\n')
    .trim();
}

export function stripStoryHtmlForExport(html: string): string {
  return decodeBasicEntities(
    removeDangerousHtml(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(?:p|h1|h2|h3|li|blockquote|section|article)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
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
  return html
    .replace(DANGEROUS_CONTAINER_PATTERN, '')
    .replace(DANGEROUS_SINGLE_TAG_PATTERN, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function sanitizeStoryTag(token: string): string {
  const match = HTML_TAG_PATTERN.exec(token);
  if (!match) {
    return '';
  }

  const isClosingTag = Boolean(match[1]);
  const tagName = match[2]?.toLowerCase();
  if (!tagName || !ALLOWED_STORY_TAGS.has(tagName)) {
    return '';
  }

  if (tagName === 'br') {
    return isClosingTag ? '' : '<br>';
  }

  return isClosingTag ? `</${tagName}>` : `<${tagName}>`;
}

function replaceEvery(value: string, searchValue: string, replacement: string): string {
  return value.split(searchValue).join(replacement);
}

function replacePdfControlCharacters(value: string): string {
  let sanitized = '';

  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    sanitized += codePoint <= 0x1f || codePoint === 0x7f ? ' ' : character;
  }

  return sanitized;
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
