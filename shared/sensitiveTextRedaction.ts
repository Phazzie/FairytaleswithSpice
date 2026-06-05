// Created: 2026-06-05 03:42 EDT

export const REDACTED_SENSITIVE_TEXT = '[REDACTED]';

const API_KEY_PREFIXES = ['xai-', 'xai_', 'sk-', 'sk_', 'api-', 'api_'];

export function redactSensitiveTextTokens(value: string): string {
  return redactUrls(redactEmailAddresses(redactApiKeys(redactBearerTokens(value))));
}

function redactBearerTokens(value: string): string {
  const marker = 'bearer';
  let redacted = '';
  let index = 0;

  while (index < value.length) {
    const found = indexOfIgnoreCase(value, marker, index);
    if (found < 0) {
      redacted += value.slice(index);
      break;
    }

    redacted += value.slice(index, found);

    let cursor = found + marker.length;
    const whitespaceStart = cursor;
    while (cursor < value.length && isWhitespace(value[cursor] ?? '')) {
      cursor += 1;
    }

    if (cursor === whitespaceStart) {
      redacted += value.slice(found, cursor);
      index = cursor;
      continue;
    }

    const tokenStart = cursor;
    while (cursor < value.length && isBearerTokenChar(value[cursor] ?? '')) {
      cursor += 1;
    }

    if (cursor === tokenStart) {
      redacted += value.slice(found, cursor);
      index = cursor;
      continue;
    }

    redacted += `Bearer ${REDACTED_SENSITIVE_TEXT}`;
    index = cursor;
  }

  return redacted;
}

function redactApiKeys(value: string): string {
  let redacted = '';
  let index = 0;

  while (index < value.length) {
    const prefix = findApiKeyPrefix(value, index);
    if (!prefix || !hasApiTokenBoundaryBefore(value, index)) {
      redacted += value[index] ?? '';
      index += 1;
      continue;
    }

    let cursor = index + prefix.length;
    while (cursor < value.length && isApiKeyTokenChar(value[cursor] ?? '')) {
      cursor += 1;
    }

    const tokenTailLength = cursor - index - prefix.length;
    if (tokenTailLength >= 8 && hasApiTokenBoundaryAfter(value, cursor)) {
      redacted += REDACTED_SENSITIVE_TEXT;
      index = cursor;
      continue;
    }

    redacted += value[index] ?? '';
    index += 1;
  }

  return redacted;
}

function redactEmailAddresses(value: string): string {
  let redacted = '';
  let index = 0;

  while (index < value.length) {
    const char = value[index] ?? '';
    if (!isEmailCandidateChar(char)) {
      redacted += char;
      index += 1;
      continue;
    }

    const start = index;
    while (index < value.length && isEmailCandidateChar(value[index] ?? '')) {
      index += 1;
    }

    const candidate = value.slice(start, index);
    const { core, trailing } = splitTrailingEmailPunctuation(candidate);
    redacted += isEmailAddress(core) ? `${REDACTED_SENSITIVE_TEXT}${trailing}` : candidate;
  }

  return redacted;
}

function redactUrls(value: string): string {
  let redacted = '';
  let index = 0;

  while (index < value.length) {
    if (startsWithIgnoreCase(value, 'http://', index) || startsWithIgnoreCase(value, 'https://', index)) {
      let cursor = index;
      while (cursor < value.length && !isUrlDelimiter(value[cursor] ?? '')) {
        cursor += 1;
      }
      redacted += REDACTED_SENSITIVE_TEXT;
      index = cursor;
      continue;
    }

    redacted += value[index] ?? '';
    index += 1;
  }

  return redacted;
}

function indexOfIgnoreCase(value: string, search: string, fromIndex: number): number {
  for (let index = fromIndex; index <= value.length - search.length; index += 1) {
    if (startsWithIgnoreCase(value, search, index)) {
      return index;
    }
  }
  return -1;
}

function startsWithIgnoreCase(value: string, search: string, index: number): boolean {
  return value.slice(index, index + search.length).toLowerCase() === search;
}

function findApiKeyPrefix(value: string, index: number): string | undefined {
  return API_KEY_PREFIXES.find(prefix => startsWithIgnoreCase(value, prefix, index));
}

function hasApiTokenBoundaryBefore(value: string, index: number): boolean {
  return index === 0 || !isApiKeyTokenChar(value[index - 1] ?? '');
}

function hasApiTokenBoundaryAfter(value: string, index: number): boolean {
  return index >= value.length || !isApiKeyTokenChar(value[index] ?? '');
}

function splitTrailingEmailPunctuation(candidate: string): { core: string; trailing: string } {
  let end = candidate.length;
  while (end > 0 && candidate[end - 1] === '.') {
    end -= 1;
  }
  return {
    core: candidate.slice(0, end),
    trailing: candidate.slice(end)
  };
}

function isEmailAddress(candidate: string): boolean {
  const atIndex = candidate.indexOf('@');
  if (atIndex <= 0 || atIndex !== candidate.lastIndexOf('@') || atIndex >= candidate.length - 1) {
    return false;
  }

  const localPart = candidate.slice(0, atIndex);
  const domain = candidate.slice(atIndex + 1);
  if (!isValidEmailLocalPart(localPart)) {
    return false;
  }

  const labels = domain.split('.');
  const finalLabel = labels[labels.length - 1] ?? '';
  return labels.length >= 2 && finalLabel.length >= 2 && labels.every(isValidEmailDomainLabel);
}

function isValidEmailLocalPart(value: string): boolean {
  return value.length > 0 && Array.from(value).every(isEmailLocalChar);
}

function isValidEmailDomainLabel(value: string): boolean {
  if (value.length === 0 || value.startsWith('-') || value.endsWith('-')) {
    return false;
  }
  return Array.from(value).every(char => isAsciiLetterOrDigit(char) || char === '-');
}

function isEmailCandidateChar(char: string): boolean {
  return isAsciiLetterOrDigit(char) || char === '.' || char === '_' || char === '%' || char === '+' || char === '-' || char === '@';
}

function isEmailLocalChar(char: string): boolean {
  return isAsciiLetterOrDigit(char) || char === '.' || char === '_' || char === '%' || char === '+' || char === '-';
}

function isBearerTokenChar(char: string): boolean {
  return isAsciiLetterOrDigit(char) || char === '.' || char === '_' || char === '~' || char === '+' || char === '/' || char === '=' || char === '-';
}

function isApiKeyTokenChar(char: string): boolean {
  return isAsciiLetterOrDigit(char) || char === '_' || char === '-';
}

function isUrlDelimiter(char: string): boolean {
  return isWhitespace(char) || char === '"' || char === '\'' || char === '<' || char === '>';
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f' || char === '\v';
}

function isAsciiLetterOrDigit(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}
