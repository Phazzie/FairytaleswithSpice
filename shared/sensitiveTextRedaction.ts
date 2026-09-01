// Created: 2026-06-05 03:42 EDT

export const REDACTED_SENSITIVE_TEXT = '[REDACTED]';

const API_KEY_PREFIXES = ['xai-', 'xai_', 'sk-', 'sk_', 'api-', 'api_'];

export function redactSensitiveTextTokens(value: string): string {
  return redactUrls(redactEmailAddresses(redactApiKeys(redactBearerTokens(value))));
}

function redactBearerTokens(value: string): string {
  const marker = 'bearer';
  const credentialArrays = new CredentialArrayCursor(findCredentialValueSpans(value));
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

    // The full stop that ends the sentence belongs to the sentence, not to the
    // run -- and `.` is a `b64token` character, so the scan above swallowed it.
    // `the bearer returned.` was read as the credential-shaped `returned.` and
    // lost both the word and the mark that ended the line, which is this
    // module's own defect one character further along.
    const tokenEnd = endBeforeSentenceStops(value, tokenStart, cursor);

    if (tokenEnd === tokenStart) {
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
      !credentialArrays.contains(found) &&
      !isCredentialShapedBearerToken(
        stripBalancedEmphasis(value.slice(tokenStart, tokenEnd)),
        cursor - tokenStart
      )
    ) {
      redacted += value.slice(found, cursor);
      index = cursor;
      continue;
    }

    redacted += `Bearer ${REDACTED_SENSITIVE_TEXT}`;
    index = tokenEnd;
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
export const BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH = 16;

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
 * Nouns that a human-readable label ends in, where the field name is the word
 * before them: `Invalid Authorization header: Bearer …`. Never sufficient
 * alone -- `header: Bearer of the seal` carries no field name and stays prose.
 */
const BEARER_CREDENTIAL_FIELD_SUFFIXES = new Set(['header', 'headers']);

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
  const separator = skipBackOverSeparatorPadding(value, index - 1);
  if (separator < 0 || !BEARER_CREDENTIAL_INTRODUCERS.has(value[separator] ?? '')) {
    return false;
  }

  return readCredentialFieldBefore(value, separator) !== null;
}

/**
 * The authorization field name that owns this `:` or `=`, or `null` if the
 * separator belongs to a label rather than to a header.
 *
 * The start index is returned as well as the verdict because the *escaping
 * depth* of the whole serialization is read off this name -- see
 * {@link delimiterBackslashesBefore}. The name and the value it introduces were
 * written by the same serializer, so whatever wraps the name is the spelling a
 * delimiter has in this text.
 */
function readCredentialFieldBefore(value: string, separator: number): { start: number } | null {
  const label = readFieldNameBefore(value, separator - 1);
  if (isCredentialFieldName(label.name)) {
    return { start: label.start };
  }

  // A human-readable label ends in the noun: `Invalid Authorization header:
  // Bearer abcdef` is a provider's error text, and the field name is the word
  // before `header` rather than the label's last word. Exactly one word of
  // lookback, and only past this suffix -- an unbounded scan would match `The
  // authorization ceremony: Bearer of the seal`, which is prose.
  if (!BEARER_CREDENTIAL_FIELD_SUFFIXES.has(label.name)) {
    return null;
  }
  const field = readFieldNameBefore(value, label.start - 1);
  return isCredentialFieldName(field.name) ? { start: field.start } : null;
}

/**
 * The spans of every *value* whose field is an authorization field:
 * `{"authorization":["Bearer abcdef","Bearer ghijkl"]}` and
 * `{"authorization":"Bearer abcdef, Bearer ghijkl"}`.
 *
 * A repeated header is a `string[]` in this repository's own request contracts,
 * and a joined one is a comma-separated string, so both are shapes a serialized
 * error really carries. Either defeats {@link isIntroducedAsCredential} from the
 * second credential onwards: the walk back from the scheme reaches the `,`
 * between elements or values rather than the field's `:`, and the first element
 * reaches the `[`. The field context belongs to the whole value, so it is
 * established once here and applied to everything inside it, rather than each
 * credential trying to walk back to a field name past the ones before it.
 *
 * **This is not a third entry in a suffix set.** A serialized value is closed
 * grammar -- a bracket or a quote, and its matching partner -- where a
 * human-readable label is open-ended English, which is why that enumeration was
 * stopped and this one is not.
 *
 * The gate is the same one, applied to the field's separator instead of to the
 * scheme, so this cannot loosen the rule: `Title: ["Bearer of the seal"]`
 * reaches the label `title`, matches no field name, and stays prose.
 *
 * **Driven by the separator rather than by the opener, and that is what makes
 * it linear.** Testing every `[` cost one backward walk per bracket; testing
 * every quote as well -- which the joined-value shape needs -- would have cost
 * one per quote, and a run of quotes or of whitespace would then be quadratic.
 * A separator is not padding, so the walk back from one stops at or before the
 * previous separator and the walk forward stops at or before the next: the
 * regions are disjoint and the whole pass is one sweep.
 *
 * Skipping a separator that is already inside a recorded span keeps the spans
 * disjoint and in ascending order, which is what {@link CredentialArrayCursor}
 * relies on.
 *
 * A value left unterminated by a truncated log runs to the end of the string,
 * which is the fail-closed reading and the deliberate opposite of what `shared/
 * storyTextBlocks.ts` does with an unterminated comment. The two differ because
 * the trades differ: there, dropping the tail loses a story from the word
 * count; here, keeping it only over-redacts inside text the writer labelled an
 * authorization value.
 */
function findCredentialValueSpans(value: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let recordedEnd = -1;

  for (let separator = 0; separator < value.length; separator += 1) {
    if (separator <= recordedEnd || !BEARER_CREDENTIAL_INTRODUCERS.has(value[separator] ?? '')) {
      continue;
    }
    const field = readCredentialFieldBefore(value, separator);
    if (!field) {
      continue;
    }

    const delimiterBackslashes = delimiterBackslashesBefore(value, field.start);
    const opener = findValueOpener(value, separator + 1, delimiterBackslashes);
    if (!opener) {
      continue;
    }

    const end = opener.isArray
      ? findArrayEnd(value, opener.index, delimiterBackslashes)
      : findQuotedValueEnd(value, opener.index, delimiterBackslashes);
    spans.push({ start: opener.index, end });
    recordedEnd = end;
  }

  return spans;
}

/**
 * How many backslashes a delimiting quote carries in this text, read off the
 * field name rather than guessed at the value.
 *
 * **This is the whole repair, and the reason the readings no longer have to be
 * compared.** Each time a payload is embedded in a string, every delimiter
 * gains a backslash and every literal quote gains more, so at depth 0 a
 * delimiter is `"`, at depth 1 it is `\"`, at depth 2 it is `\\\"` -- and a
 * literal quote *inside* an element at depth 1 is spelled `\\\"` too, which is
 * identical to a depth-2 delimiter. Nothing inside the value says which depth
 * it is, so five rounds of review found five ways for a scan that guessed to
 * end in the wrong place: twice a credential in the clear, three times the
 * prose after the value destroyed.
 *
 * The depth was never actually unknowable, only unavailable where it was being
 * looked for. The field name and the value it introduces were written by the
 * same serializer at the same depth, and the field name is *already* being read
 * -- so the quote wrapping it answers the question outright. `"authorization":`
 * is depth 0, `\"authorization\":` is depth 1, `\\\"authorization\\\":` is
 * depth 2, and an unquoted `Authorization:` is depth 0 because nothing has been
 * escaped at all.
 *
 * One reading follows from one fact about the text, so there is no candidate
 * set, no comparison, and no "longest end wins" rule to be wrong about.
 */
function delimiterBackslashesBefore(value: string, fieldStart: number): number {
  const quote = fieldStart - 1;
  if (quote < 0 || !isQuote(value[quote] ?? '')) {
    return 0;
  }

  let run = 0;
  let cursor = quote - 1;
  while (cursor >= 0 && value[cursor] === '\\') {
    run += 1;
    cursor -= 1;
  }
  return run;
}

/**
 * The `[` or the opening quote of the value this separator introduces, or
 * `null` when the value is neither -- `Authorization: Bearer abcdef` is a bare
 * credential, and {@link isIntroducedAsCredential} already reads it.
 *
 * Whitespace between the separator and the value belongs to the serialization.
 * Backslashes are counted rather than skipped, because they are how the opening
 * quote spells itself at depth: at depth 1 the value opens `\"`, and a quote
 * carrying the wrong number of them is not this serialization's delimiter.
 */
function findValueOpener(
  value: string,
  from: number,
  delimiterBackslashes: number
): { index: number; isArray: boolean } | null {
  let run = 0;

  for (let cursor = from; cursor < value.length; cursor += 1) {
    const char = value[cursor] ?? '';
    if (char === '\\') {
      run += 1;
      continue;
    }
    if (isWhitespace(char)) {
      run = 0;
      continue;
    }
    if (char === '[') {
      return { index: cursor, isArray: true };
    }
    if (isQuote(char) && isDelimiterQuote(run, delimiterBackslashes)) {
      return { index: cursor, isArray: false };
    }
    return null;
  }

  return null;
}

/**
 * Where does the array opened at `bracket` close?
 *
 * At the first `]` that is not inside a quoted element. An element is a string
 * and may hold anything, `]` included -- `"Digest roles=[admin]"` is a real
 * header value -- so a `]` only closes the array when no quote is open.
 *
 * A quote is closed only by **the same character that opened it**, which is
 * what lets `"it's fine"` keep its apostrophe instead of ending the element on
 * it. Which quotes delimit at all is settled before the scan starts, by
 * {@link delimiterBackslashesBefore}, so this is a single pass with nothing to
 * choose between.
 *
 * No `]` at all means a log truncated mid-array, and the span runs to the end
 * of the string -- the fail-closed direction the caller's docblock describes.
 */
function findArrayEnd(value: string, bracket: number, delimiterBackslashes: number): number {
  let openQuote = '';
  let run = 0;

  for (let cursor = bracket + 1; cursor < value.length; cursor += 1) {
    const char = value[cursor] ?? '';
    if (char === '\\') {
      run += 1;
      continue;
    }
    const isDelimiter = isQuote(char) && isDelimiterQuote(run, delimiterBackslashes);
    run = 0;

    if (openQuote) {
      if (isDelimiter && char === openQuote) {
        openQuote = '';
      }
      continue;
    }
    if (isDelimiter) {
      openQuote = char;
      continue;
    }
    if (char === ']') {
      return cursor;
    }
  }

  return value.length;
}

/**
 * Where does the string value opened at `quote` close? At the next delimiting
 * quote of the same character, and at the end of the string if the log was
 * truncated before one arrived.
 *
 * This is the shape the comma finding is about:
 * `{"authorization":"Bearer abcdef, Bearer ghijkl"}` is one value holding two
 * credentials, and the walk back from the second reaches the comma rather than
 * the field. The span carries the field context across it.
 */
function findQuotedValueEnd(value: string, quote: number, delimiterBackslashes: number): number {
  const opener = value[quote] ?? '';
  let run = 0;

  for (let cursor = quote + 1; cursor < value.length; cursor += 1) {
    const char = value[cursor] ?? '';
    if (char === '\\') {
      run += 1;
      continue;
    }
    const isDelimiter = char === opener && isDelimiterQuote(run, delimiterBackslashes);
    run = 0;
    if (isDelimiter) {
      return cursor;
    }
  }

  return value.length;
}

/**
 * Is a quote carrying `run` backslashes a delimiter, where a delimiter carries
 * `delimiterBackslashes` of them?
 *
 * Not equality, because a literal backslash immediately before a closing quote
 * adds to the run: at depth 0, `"path=C:\\"` ends in two backslashes and a
 * delimiter, and reading that quote as content left the element open, ran the
 * span to the end of the log and destroyed the sentence after it.
 *
 * One literal backslash occupies `delimiterBackslashes + 1` positions -- it is
 * escaped exactly as often as a delimiting quote is, plus the one that escapes
 * it -- so a delimiter is any run congruent to `delimiterBackslashes` modulo
 * twice that. At depth 0 that reads: an even run ends in a delimiter, an odd
 * one in an escaped quote. At depth 1: `\"` delimits, `\\\"` is a literal
 * quote, `\\\\\"` is a literal backslash and then a delimiter.
 */
function isDelimiterQuote(run: number, delimiterBackslashes: number): boolean {
  return run % (2 * (delimiterBackslashes + 1)) === delimiterBackslashes;
}

/**
 * Is this index inside one of the spans, given that the caller asks about
 * ascending indices?
 *
 * The spans are disjoint and in order -- {@link findCredentialValueSpans}
 * restarts past each one it records, which is what earns both properties -- and
 * the scheme keywords are visited left to right, so the search is a cursor that
 * only moves forward rather than a scan of the whole list per keyword. Scanning
 * would be quadratic on the shape that has one array and one credential per
 * element, which is exactly what a serialized header dump looks like.
 */
class CredentialArrayCursor {
  private position = 0;

  constructor(private readonly spans: Array<{ start: number; end: number }>) {}

  contains(index: number): boolean {
    while (this.position < this.spans.length && (this.spans[this.position]?.end ?? 0) <= index) {
      this.position += 1;
    }
    const span = this.spans[this.position];
    return span !== undefined && index > span.start && index < span.end;
  }
}

function isCredentialFieldName(name: string): boolean {
  if (BEARER_CREDENTIAL_FIELD_NAMES.has(name)) {
    return true;
  }
  // The same descriptive suffix written as one token: `authorization-header`.
  const hyphenIndex = Math.max(name.lastIndexOf('-'), name.lastIndexOf('_'));
  return hyphenIndex > 0
    && BEARER_CREDENTIAL_FIELD_SUFFIXES.has(name.slice(hyphenIndex + 1))
    && BEARER_CREDENTIAL_FIELD_NAMES.has(name.slice(0, hyphenIndex));
}

function readFieldNameBefore(value: string, from: number): { name: string; start: number } {
  let cursor = skipBackOverSeparatorPadding(value, from);
  const end = cursor + 1;
  while (cursor >= 0 && isFieldNameChar(value[cursor] ?? '')) {
    cursor -= 1;
  }
  return { name: value.slice(cursor + 1, end).toLowerCase(), start: cursor + 1 };
}

/**
 * Whitespace, quotes and the backslashes that escape them all belong to the
 * serialization rather than to either side of it.
 *
 * The backslash matters because an error message often carries a JSON payload
 * that has already been escaped once -- `payload="{\"authorization\":\"Bearer
 * abcdef\"}"`. Stopping at the escape leaves the walk short of the colon, so
 * the field name is never reached and a credential with explicit authorization
 * context around it is logged in the clear. Skipping it cannot loosen the rule
 * on its own: a field name and a separator are still both required.
 */
function skipBackOverSeparatorPadding(value: string, from: number): number {
  let cursor = from;
  let skipped = '';

  while (cursor >= 0) {
    const char = value[cursor] ?? '';
    if (!isSeparatorPadding(char)) {
      break;
    }
    // Two quotes of the same character side by side are a value that has
    // already closed, not padding around the next one. Without this the walk
    // reads straight through an empty value to the separator behind it, and
    // `authorization: "" Bearer of the seal` loses its `of` -- while
    // `authorization: "abc" Bearer of the seal` does not, because a non-empty
    // value stops the walk on its own characters. The two spellings of a
    // completed value now stop it alike.
    if (isQuote(char) && char === skipped) {
      break;
    }
    skipped = char;
    cursor -= 1;
  }

  return cursor;
}

function isSeparatorPadding(char: string): boolean {
  return isWhitespace(char) || isQuote(char) || char === '\\';
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
 * **Or the run reaches {@link BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH}** -- the
 * only shape the first arm cannot see, and the floor is the configured-key
 * floor precisely so that an `API_KEYS` entry can never sit below it.
 *
 * `of`, `led`, `must`, `announced` and `whispered` qualify under neither.
 *
 * **The shape is read off the word `body`; the length is measured on the whole
 * `run`, and the difference is load-bearing.** The marks the body drops --
 * a trailing full stop, a balanced pair of Markdown emphasis delimiters -- are
 * punctuation for the *shape* question and still characters for the *length*
 * one, because `API_KEY_CREDENTIAL_GRAMMAR` counts `.` and `_` inside a token
 * body. Dropping them from the length too would have spared
 * `Bearer abcdefghijklmno.` -- fifteen letters and a stop, a sixteen-character
 * body that `authenticateRequest` accepts -- which is a configured credential in
 * the clear. Measuring the run instead gives the arm one flat guarantee that no
 * trimming can reach past: **every run of
 * {@link BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH} characters or more is
 * redacted, whatever its shape.**
 */
function isCredentialShapedBearerToken(body: string, runLength: number): boolean {
  if (!isWordLikeRun(body)) {
    return true;
  }
  return runLength >= BEARER_ALPHABETIC_CREDENTIAL_MIN_LENGTH;
}

/**
 * The word inside a pair of Markdown emphasis delimiters, if that is what this
 * run is.
 *
 * `_` and `~` are `b64token` characters, so `the bearer _returned_ to court`
 * read `_returned_` as a run carrying marks no English word carries, and
 * destroyed it -- along with `__of__` and `~~returned~~`. This module is handed
 * story content and Markdown is how that content spells emphasis, so these are
 * ordinary prose reaching the logger, not credentials.
 *
 * **Balanced, and only balanced.** The same run of the same mark on both ends,
 * which is what emphasis is and what a credential is not: `_abcdef` keeps its
 * leading underscore and stays a credential, as `-abcdef` does, and
 * `sk_live_abcdef` carries its underscores *inside* and is untouched here. A
 * stripped body that still holds a mark -- `_a_b_` -> `a_b` -- fails the word
 * test anyway.
 *
 * This cannot spare a credential: {@link isCredentialShapedBearerToken}
 * measures length on the untrimmed run, so a wrapped run long enough to be a
 * configured key is redacted on the floor regardless.
 */
function stripBalancedEmphasis(run: string): string {
  for (const mark of MARKDOWN_EMPHASIS_MARKS) {
    let lead = 0;
    while (lead < run.length && run[lead] === mark) {
      lead += 1;
    }
    if (lead === 0) {
      continue;
    }
    let trail = 0;
    while (trail < run.length && run[run.length - 1 - trail] === mark) {
      trail += 1;
    }
    if (lead === trail && lead + trail < run.length) {
      return run.slice(lead, run.length - trail);
    }
  }
  return run;
}

/** The `b64token` characters Markdown also uses to wrap an emphasized word. */
const MARKDOWN_EMPHASIS_MARKS = ['_', '~'];

/**
 * Could this run be an English word rather than a credential?
 *
 * Letters, joined by interior single hyphens **or slashes**. Both are here for
 * the same reason and were found the same way: `re-entered`, `self-appointed`,
 * `half-turned`, `well-known` and then `and/or`, `his/her`, `either/or` are
 * ordinary words and phrases that follow the noun `bearer` in prose, and
 * reading every non-letter as proof of a credential destroyed all of them --
 * the defect this function exists to avoid.
 *
 * The slash was missed when the hyphen was added, which is the honest reading
 * of it: the rule was fixed for the instance rather than for the class, and a
 * later review found the class. Both are joiners inside an English word; a
 * credential is not spelled that way.
 *
 * Everything else still qualifies as a credential at any length, and that is
 * where the work happens: a digit, `_`, `.`, `+`, `=`, or a leading, trailing
 * or doubled joiner. Every provider token this app holds fails this test and is
 * caught regardless of length -- `xai-secret-key-123` and `a1b2c3` on their
 * digits, `sk_live_…` on its underscore, a JWT on its dots.
 *
 * What this costs, stated rather than left implied: a run of letters joined by
 * a single slash is no longer a credential on shape alone, so a purely
 * alphabetic `abc/def` under 16 characters is preserved. That is the same band
 * as the residual in `SECURITY_IMPLEMENTATION_GUIDE.md` Note 7 and is bounded
 * the same way -- #315's contract makes such a value unconfigurable, and no
 * provider issues one.
 */
function isWordLikeRun(token: string): boolean {
  let previousWasJoiner = true; // a leading joiner is not a word
  for (const char of token) {
    if (isWordJoiner(char)) {
      if (previousWasJoiner) {
        return false;
      }
      previousWasJoiner = true;
      continue;
    }
    if (!isAsciiLetter(char)) {
      return false;
    }
    previousWasJoiner = false;
  }
  return !previousWasJoiner; // a trailing joiner is not a word either
}

/** The marks that join two halves of one English word: `well-known`, `and/or`. */
function isWordJoiner(char: string): boolean {
  return char === '-' || char === '/';
}

/**
 * Where the run really ends, once the marks that end the *sentence* are given
 * back to it.
 *
 * `.` is a `b64token` character, so the token scan takes it, and every ordinary
 * sentence ending in the word after the noun was then credential-shaped on that
 * one character: `the bearer returned.` lost `returned` *and* the full stop,
 * leaving a log line ending mid-air. It is the defect this arm exists to avoid,
 * surviving one character past where the repair was looking.
 *
 * **Only `.`, and only trailing.** The other `b64token` marks are not sentence
 * punctuation and a credential really can end in them -- `abcdef/`, `abcdef-`
 * and base64's `=` padding are all asserted as credentials, so stripping those
 * would weaken the shape arm rather than sharpen it. An interior dot is
 * untouched, which is what keeps `ab.cd` and a JWT's three parts credentials.
 *
 * This cannot expose credential material: what is given back is a run of dots,
 * which carries nothing. It does widen the residual by one shape -- a
 * word-shaped run under the floor is preserved whether or not a full stop
 * follows it, so `Bearer secret.` keeps `secret` exactly as `Bearer secret`
 * does. That is the residual in `SECURITY_IMPLEMENTATION_GUIDE.md` Note 7, not
 * a new gap, and it is bounded the same way.
 *
 * The same trade the URL pass already makes one function down, where a comma or
 * a full stop after a link belongs to the sentence rather than to the link.
 */
function endBeforeSentenceStops(value: string, tokenStart: number, tokenEnd: number): number {
  let cursor = tokenEnd;
  while (cursor > tokenStart && value[cursor - 1] === '.') {
    cursor -= 1;
  }
  return cursor;
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
