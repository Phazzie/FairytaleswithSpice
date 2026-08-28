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

    // `bearer` only introduces a credential when it starts a word. Without this
    // guard an ordinary word that merely contains the substring (`forbearer`,
    // `torchbearer`) is rewritten to the scheme's casing and the following word
    // is swallowed as if it were a token.
    if (!hasBearerBoundaryBefore(value, found)) {
      redacted += value.slice(found, found + marker.length);
      index = found + marker.length;
      continue;
    }

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

    // A standalone `bearer` is the scheme keyword *and* an ordinary English
    // noun, so the word alone does not settle which one this is. Only redact
    // when something beyond the keyword says "credential" -- otherwise this is
    // prose and the next word is left alone. See the two arms below.
    if (
      !isIntroducedAsCredential(value, found) &&
      !isCredentialShapedBearerToken(value.slice(tokenStart, cursor))
    ) {
      redacted += value.slice(found, cursor);
      index = cursor;
      continue;
    }

    redacted += `Bearer ${REDACTED_SENSITIVE_TEXT}`;
    index = cursor;
  }

  return redacted;
}

/**
 * Characters that put `bearer` in a *header* position rather than in a
 * sentence: the value side of `Authorization: Bearer x` and
 * `Authorization=Bearer x`.
 *
 * Deliberately two, and the set is the delicate part of this module. What
 * this app logs is story content -- HTML (`<p>Bearer of the seal</p>`), quoted
 * dialogue (`"Bearer of bad news," she said`), parentheticals, markdown tables
 * -- so `>`, `"`, `'`, `(`, `[`, `{` and `|` all sit immediately before an
 * ordinary capitalized noun far more often than before a credential. Admitting
 * any of them reintroduces exactly the defect this function exists to avoid,
 * on the most common shape story text takes. Sentence punctuation (`.` `,` `;`
 * `!` `?` `-`) is absent for the same reason.
 *
 * Nothing is lost by keeping the set small: a credential that appears after a
 * quote or a tag is still redacted by {@link isCredentialShapedBearerToken},
 * which is the arm that carries the general case. This one exists only to catch
 * a credential too short and too alphabetic to have a shape -- and such a value
 * cannot be a configured `API_KEYS` entry, whose token body must reach
 * `API_KEY_MINIMUM_LENGTH` (16), nor a provider token, which carries `-`, `_`
 * or `.` and is long.
 *
 * `&` is deliberately *not* here even though `?auth=1&bearer=xyz` is a real
 * credential position: the scheme must be followed by whitespace to be read at
 * all (see the caller), and a query parameter has `=` there instead. Adding it
 * would be dead configuration that reads as coverage. That query-string form is
 * unredacted before this change and after it; a full URL is redacted whole by
 * {@link redactUrls}, and closing the bare fragment is a separate change.
 */
const BEARER_CREDENTIAL_INTRODUCERS = new Set([':', '=']);

/**
 * The shortest *purely alphabetic* run that is taken for a credential on its
 * length alone.
 *
 * Sixteen, and not a number of this module's own choosing: it is
 * `API_KEY_MINIMUM_LENGTH`, the token-body floor `authenticateRequest` puts on
 * a configured `API_KEYS` entry. Tying the two together is the point -- what
 * the deployment will accept as a credential and what the logger will hide as
 * one are then a single number rather than two that can drift apart. The test
 * asserts they are equal. (It is duplicated rather than imported because this
 * module is bundled into the browser app, which must not pull in server
 * middleware.)
 *
 * An eight-character floor was tried first and was wrong: English has a great
 * many eight-letter words, and the ones that follow the noun `bearer` are
 * exactly the common ones -- `announced`, `delivered`, `whispered`,
 * `returned`. At eight, `the bearer announced victory` still lost its verb,
 * which is the defect this function exists to avoid.
 */
const BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH = 16;

/**
 * The field names that make a `:` or `=` an authorization header rather than a
 * label. Compared case-insensitively against the word before the separator.
 *
 * A separator alone is not enough, and assuming it was is the second way this
 * function got the same class of thing wrong: `Title: Bearer of the seal` and
 * `Chapter 3: Bearer of the Oath` are a story title and a chapter heading that
 * this app generates, and `role=bearer of bad news` is ordinary structured
 * prose. Each put a `:` or `=` immediately before the noun. Requiring the label
 * as well as the separator is what makes this arm mean "a header carried this"
 * instead of "a punctuation mark preceded this".
 */
const BEARER_CREDENTIAL_FIELD_NAMES = new Set([
  'authorization', 'auth', 'proxy-authorization',
  'apikey', 'api-key', 'api_key', 'x-api-key', 'xapikey',
  'token', 'accesstoken', 'access-token', 'access_token',
  'idtoken', 'id-token', 'id_token', 'sessiontoken', 'session-token', 'session_token',
  'credential', 'credentials'
]);

/**
 * Is the scheme keyword introduced the way a header introduces it -- an
 * authorization field name, then `:` or `=`, then the scheme?
 *
 * Whitespace and quotes between the parts belong to the serialization rather
 * than to either side, so they are skipped: `Authorization:  Bearer x`,
 * `Authorization=Bearer x` and `{"authorization": "Bearer x"}` all read alike.
 * Skipping quotes is safe *because* the field name is checked -- `He said:
 * "Bearer of the seal"` reaches the label `said` and is left alone.
 *
 * The start of the string is not an introducer: `Bearer of the seal walked in`
 * is a sentence that happens to open on the word. Neither is a separator
 * further back than the label, so `context: The bearer of bad news` is prose.
 */
function isIntroducedAsCredential(value: string, index: number): boolean {
  let cursor = skipBackOverSeparatorPadding(value, index - 1);
  if (cursor < 0 || !BEARER_CREDENTIAL_INTRODUCERS.has(value[cursor] ?? '')) {
    return false;
  }

  cursor = skipBackOverSeparatorPadding(value, cursor - 1);
  const fieldNameEnd = cursor + 1;
  while (cursor >= 0 && isFieldNameChar(value[cursor] ?? '')) {
    cursor -= 1;
  }

  return BEARER_CREDENTIAL_FIELD_NAMES.has(value.slice(cursor + 1, fieldNameEnd).toLowerCase());
}

function skipBackOverSeparatorPadding(value: string, from: number): number {
  let cursor = from;
  while (cursor >= 0 && (isWhitespace(value[cursor] ?? '') || isQuote(value[cursor] ?? ''))) {
    cursor -= 1;
  }
  return cursor;
}

function isQuote(char: string): boolean {
  return char === '"' || char === '\'' || char === '`';
}

function isFieldNameChar(char: string): boolean {
  return isAsciiLetterOrDigit(char) || char === '-' || char === '_';
}

/**
 * Does the run after the scheme look like a credential rather than a word?
 *
 * Two ways to qualify, either alone being enough.
 *
 * **It carries a character an English word cannot** -- a digit, or one of the
 * `._~+/=-` that RFC 6750's `b64token` allows. This is the arm that carries the
 * general case, and length does not enter into it: `a1b2c3` and `k+y/z=` are
 * credentials at six characters, and every provider token this app holds is
 * caught here (`xai-...` and `sk_...` carry `-` or `_`; a Clerk session token
 * is a JWT and carries `.`).
 *
 * **Or it is purely alphabetic and reaches
 * {@link BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH}** -- the only shape the first
 * arm cannot see, and the floor is the configured-key floor precisely so that
 * an `API_KEYS` entry can never sit below it.
 *
 * `of`, `led`, `must`, `announced` and `whispered` qualify under neither.
 */
function isCredentialShapedBearerToken(token: string): boolean {
  if (Array.from(token).some(char => !isAsciiLetter(char))) {
    return true;
  }
  return token.length >= BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH;
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
    const scheme = findUrlScheme(value, index);
    if (scheme) {
      let cursor = index;
      while (cursor < value.length && !isUrlDelimiter(value[cursor] ?? '')) {
        cursor += 1;
      }
      redacted += REDACTED_SENSITIVE_TEXT;
      index = trimTrailingUrlPunctuation(value, index + scheme.length, cursor);
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

// Deliberately narrower than `isBearerTokenChar`: the only thing this guard
// needs to reject is `bearer` sitting inside a longer *word*, so the boundary
// is letters and digits alone. Reusing the token grammar here would treat the
// delimiters that really do precede credentials -- `=` in
// `Authorization=Bearer x`, and `/` or `+` in encoded payloads -- as word
// characters and leave those credentials in the clear.
function hasBearerBoundaryBefore(value: string, index: number): boolean {
  return index === 0 || !isAsciiLetterOrDigit(value[index - 1] ?? '');
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

const URL_SCHEMES = ['https://', 'http://'];
/**
 * Punctuation that ends the sentence a URL was written into rather than the
 * URL itself. A run of it is handed back to the surrounding prose.
 */
const URL_TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?']);
/** The closing brackets that may be enclosing a URL rather than part of it. */
const URL_CLOSING_BRACKETS = new Map([[')', '('], [']', '['], ['}', '{']]);

function findUrlScheme(value: string, index: number): string | undefined {
  return URL_SCHEMES.find(scheme => startsWithIgnoreCase(value, scheme, index));
}

/**
 * Give the sentence back the punctuation a URL run swallowed.
 *
 * A URL ends at whitespace or a quote, which is where it ends in a log line
 * too — but a URL is usually written *into* a sentence, and the mark that
 * closes the sentence has none of those before it. So `See https://host/a, then
 * call` redacted the comma along with the URL and came back as `See [REDACTED]
 * then call`, and `Visit (https://host/a) now` lost the closing parenthesis and
 * left the opening one dangling: exactly the reading a log is hardest to do
 * when something has gone wrong enough to need reading.
 *
 * Trailing `.,;:!?` is always the prose's. A closing bracket is the prose's
 * only when the URL holds no unclosed opener to match it, so a path that really
 * ends in one — `/wiki/Title_(disambiguation)` — keeps it. Nothing is given
 * back past `start`, the end of the scheme, so the URL itself is never
 * partially preserved.
 */
function trimTrailingUrlPunctuation(value: string, start: number, end: number): number {
  let cursor = end;

  while (cursor > start) {
    const char = value[cursor - 1] ?? '';
    if (URL_TRAILING_PUNCTUATION.has(char)) {
      cursor -= 1;
      continue;
    }

    const opener = URL_CLOSING_BRACKETS.get(char);
    if (opener && !hasUnclosedOpener(value.slice(start, cursor - 1), opener, char)) {
      cursor -= 1;
      continue;
    }

    break;
  }

  return cursor;
}

function hasUnclosedOpener(value: string, opener: string, closer: string): boolean {
  let depth = 0;

  for (const char of value) {
    if (char === opener) {
      depth += 1;
    } else if (char === closer && depth > 0) {
      depth -= 1;
    }
  }

  return depth > 0;
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

function isAsciiLetter(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}
