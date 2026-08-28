// Created: 2026-08-28 04:30 UTC

/**
 * One left-to-right reader for HTML start tags, for every module that has to
 * find where a tag ends.
 *
 * This module holds no policy. It says where a tag ends, what element it names,
 * and where the text between tags is; what to do with any of that belongs to
 * its callers, which want opposite things — the export sanitizer drops
 * dangerous elements, the chapter reader keeps a heading's text.
 *
 * It exists because four readers in this repository had each spelled the same
 * reading as `<h3[^>]*>` or `<[^>]*>`, and that spelling is wrong in the same
 * way in all four: a tag does not end at the first `>`, it ends at the first
 * `>` that is not inside a quoted attribute value. Issue #296 records what
 * happened to the two attempts to repair it with a better pattern instead.
 * Both withdrew, and for the same reason: six defects across the two, every one
 * of them two constructs in the pattern able to consume the same characters,
 * three of them exponential backtracking and three of them deleting text a
 * reader wrote. There is no method for proving a regex unambiguous. A scanner
 * consumes each character exactly once and cannot have the fault at all, which
 * is a property of its shape rather than of how hard it was tested.
 *
 * The code here is moved from `exportSanitizer.ts` unchanged, where it was
 * written and then hardened across the eight review rounds of #297. Moving it
 * rather than respelling it is the point: `tests/export-sanitizer.test.ts` is
 * the evidence for this reading, and it stays pointed at the same lines.
 */

export interface ParsedHtmlTag {
  tagName: string;
  isClosing: boolean;
  isSelfClosing: boolean;
}

export function tokenizeHtml(value: string): string[] {
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
      const commentEnd = findCommentEnd(value, tagStart);
      // Nothing closes it, so the rest of the content is inside the comment —
      // which is what a browser shows too, so there is no story after it to
      // keep. This is the one reading where dropping the remainder is right.
      if (commentEnd === -1) {
        break;
      }

      index = commentEnd;
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
 * Where the comment opening at `tagStart` ends — the index just past it — or
 * `-1` if nothing closes it.
 *
 * Three spellings close a comment, not one. `-->` is the ordinary terminator;
 * `<!-->` and `<!--->` are HTML's *abrupt closing of an empty comment*, ending
 * at that `>`; and `--!>` is the comment-end-bang state. Only an EOF reached
 * with none of them seen leaves a comment genuinely unterminated, and there a
 * browser really does hide the rest of the document.
 *
 * Searching for `-->` alone therefore read the other three as comments that
 * never end, and `tokenizeHtml` abandons the scan at one of those — so
 * `<p>Alpha.</p><!--><p>Beta.</p>` exported as `Alpha.`, dropping the rest of
 * the story from **every** format. `stripStoryHtmlForExport` feeds
 * `ExportService.toPlainText`, which `.txt`, `.pdf`, `.epub` and `.docx` all go
 * through, and `sanitizeStoryHtmlForExport` carries the same reading into
 * `.html`. The three spellings are what a browser ends a comment at, so
 * everything after one is text a reader is shown and was silently losing.
 *
 * Moved here from `storyContentAnalysis.ts`, which had it for the chapter
 * heading reader (#306) while the tokenizer beside it still read `-->` alone.
 * One reader, for the same reason the tag reading is here: the two disagreeing
 * about where a comment ends is exactly the defect this repairs.
 */
export function findCommentEnd(value: string, tagStart: number): number {
  const bodyStart = tagStart + 4;

  if (value[bodyStart] === '>') {
    return bodyStart + 1;
  }

  if (value.startsWith('->', bodyStart)) {
    return bodyStart + 2;
  }

  let index = bodyStart;

  while (index < value.length) {
    const dashes = value.indexOf('--', index);
    if (dashes === -1) {
      return -1;
    }

    if (value[dashes + 2] === '>') {
      return dashes + 3;
    }

    if (value.startsWith('!>', dashes + 2)) {
      return dashes + 4;
    }

    // One character on rather than past the pair: `--->` closes, and its `>`
    // follows the *second* and third dash rather than the first two.
    index = dashes + 1;
  }

  return -1;
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
export function findTagEnd(value: string, tagStart: number): number {
  const wellFormedEnd = findWellFormedTagEnd(value, tagStart);

  // No well-formed reading: answer exactly as the older scan did.
  return wellFormedEnd === -1 ? value.indexOf('>', tagStart + 1) : wellFormedEnd;
}

/**
 * Where the tag opening at `tagStart` ends *by the attribute grammar alone*, or
 * `-1` where it has no such reading — the half of `findTagEnd` above the
 * fallback.
 *
 * Named separately because `-1` here is information a caller may need rather
 * than a failure. `findTagEnd`'s fallback answers with the first `>`, which is
 * a boundary chosen for compatibility with the older scan rather than one this
 * module can vouch for; a caller deciding where reader-visible text *resumes*
 * has to know the difference, or it emits the markup between that `>` and the
 * tag's real end as prose. Where a caller only needs a boundary and would
 * rather have the old answer than none, `findTagEnd` is still the one to call.
 */
export function findWellFormedTagEnd(value: string, tagStart: number): number {
  const attributesStart = findAttributesStart(value, tagStart);

  return attributesStart === -1 ? -1 : scanAttributesToTagEnd(value, attributesStart);
}

/**
 * Where an attribute list starting at `index` ends, or `-1` if it has no
 * well-formed end.
 *
 * A four-state walk, because whether a quote delimits a value depends entirely
 * on where in the attribute list it appears:
 *
 * - `beforeAttributeName` — an `=` here has no name to assign to. HTML makes it
 *   the attribute's *name*, so `<v =">openedx">` ends at the first `>`.
 * - `attributeName` — an `=` here is an assignment.
 * - `beforeValue` — a quote here opens a quoted value. Anything else begins an
 *   unquoted one.
 * - `unquotedValue` — runs to whitespace or the tag's `>`. Quotes and `=` inside
 *   it are characters, not delimiters, which is what `<p data-x=a="b>` turns on:
 *   without this state the second `=` reads as a fresh assignment and the quote
 *   after it opens a run that swallows the sentence.
 */
type AttributeScanState =
  | 'beforeAttributeName'
  | 'attributeName'
  | 'afterAttributeName'
  | 'beforeValue'
  | 'unquotedValue';

function scanAttributesToTagEnd(value: string, attributesStart: number): number {
  let index = attributesStart;
  let state: AttributeScanState = 'beforeAttributeName';

  while (index < value.length) {
    const character = value[index];

    if (character === '>') {
      return index;
    }

    // The next tag starts here, so this one has no well-formed end.
    if (character === '<') {
      return -1;
    }

    if (state === 'beforeValue' && (character === '"' || character === "'")) {
      const valueEnd = findAttributeValueEnd(value, index);
      if (valueEnd === -1) {
        return -1;
      }

      index = valueEnd + 1;
      state = 'beforeAttributeName';
      continue;
    }

    state = nextAttributeState(state, character);
    index += 1;
  }

  return -1;
}

/**
 * The walk's transitions, for every character that is not `>`, `<`, or a quote
 * opening a value.
 *
 * The order of these tests is the whole of the logic, and it follows HTML's own
 * start-tag states rather than a set of special cases:
 *
 * 1. **Whitespace** ends a name and ends an unquoted value — but it does not
 *    throw a name away (`y = z` is a spelling of `y=z`), and between `=` and its
 *    value it is still the value's position.
 * 2. **An unquoted value** absorbs everything until whitespace or `>`. Quotes
 *    and `=` inside one are characters.
 * 3. **A value's first character** starts an unquoted value whatever it is,
 *    `=` included: `x==y` gives `x` the value `=y`. This test has to come before
 *    the one below, or an `=` here reads as another assignment.
 * 4. **A `/`** is never part of a name. HTML sends it to the self-closing-start
 *    state and, when no `>` follows, resumes before the next attribute — so it
 *    leaves the walk exactly where it was rather than becoming one.
 * 5. **An `=`** is an assignment after a name, and is otherwise the name itself.
 */
function nextAttributeState(state: AttributeScanState, character: string): AttributeScanState {
  if (isWhitespace(character)) {
    if (state === 'beforeValue') {
      return 'beforeValue';
    }

    return state === 'attributeName' || state === 'afterAttributeName'
      ? 'afterAttributeName'
      : 'beforeAttributeName';
  }

  if (state === 'unquotedValue') {
    return 'unquotedValue';
  }

  if (state === 'beforeValue') {
    return 'unquotedValue';
  }

  if (character === '/') {
    return 'beforeAttributeName';
  }

  if (character === '=') {
    return state === 'attributeName' || state === 'afterAttributeName' ? 'beforeValue' : 'attributeName';
  }

  return 'attributeName';
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
 * Answers `-1` where a tag name is absent, so this agrees with `parseHtmlTag`
 * about what is markup at all. That one requirement covers both constructs it
 * has to refuse, since neither can begin with a tag-name character: a `<` in the
 * prose (`< =a="b>…`) and a declaration or processing instruction (`<!x a="b>…`,
 * `<?…`).
 *
 * Neither can be left to the attribute walk. `< =a="b>Visible text">After.`
 * reaches `a` as an attribute name, then `=`, then opens a quoted value that
 * pairs with the quote in the sentence and swallows it — so a `<` the reader
 * typed would delete the words after it.
 */
function findAttributesStart(value: string, tagStart: number): number {
  let index = tagStart + 1;

  // A start-tag name begins *immediately* after the `<`, and a closing one
  // immediately after the `/`. HTML has no whitespace there — `< p>` is literal
  // text a reader typed, not a paragraph — so skipping over it would let the
  // widened scan read an attribute list out of prose and pair its first quote
  // with one in the sentence.
  if (value[index] === '/') {
    index += 1;
  }

  if (!isTagNameStartCharacter(value[index])) {
    return -1;
  }

  // The name has to *begin* with a tag-name character — that is the test above,
  // and it is what separates markup from a `<` in the prose. But it does not end
  // at the first character outside that set: HTML's tag-name state runs to
  // whitespace, `/` or `>`, so `<p=x=">` has the one name `p=x="` and no
  // attributes at all. Ending the name at the `=` instead hands the walk an
  // attribute list that was never there, and its second `=` opens a quoted value
  // that reaches into the sentence.
  while (index < value.length && !endsTagName(value[index])) {
    index += 1;
  }

  return index;
}

/**
 * Where a tag name stops, per HTML: whitespace, `/`, or the tag's own `>`.
 *
 * Named once because two readers depend on giving the same answer.
 * `findAttributesStart` uses it to decide where attributes begin, and
 * `parseHtmlTag` uses it to decide which element this is. When they disagreed,
 * `<script!/>` was an attribute list to one and a `script` to the other, and the
 * export lost the whole document.
 */
function endsTagName(character: string | undefined): boolean {
  return character === undefined || isWhitespace(character) || character === '/' || character === '>';
}

/** What may follow an attribute value's closing quote. Never a word character. */
function mayEndAttributeValue(character: string | undefined): boolean {
  return character === undefined || isWhitespace(character) || character === '/' || character === '>';
}

export function parseHtmlTag(token: string): ParsedHtmlTag | null {
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
  if (!isTagNameStartCharacter(token[index])) {
    return null;
  }

  // The name has to *begin* with a tag-name character, but it ends where HTML
  // ends it — at whitespace, `/` or `>` — not at the first character outside
  // that set. Truncating instead would classify `<script!>` as a `script`, and
  // every list this name is matched against would then treat an ordinary unknown
  // element as a dangerous container: `<script!/>Visible.` would take the whole
  // document into block-skipping. `findAttributesStart` reads the name the same
  // way, and the two have to agree about where it stops.
  while (index < token.length && !endsTagName(token[index])) {
    index += 1;
  }

  return {
    tagName: token.slice(tagNameStart, index).toLowerCase(),
    isClosing,
    isSelfClosing: closesWithASelfClosingSlash(token)
  };
}

/**
 * Whether the token's trailing `/` is actually a self-closing marker.
 *
 * The suffix reading this replaces — "the last non-whitespace character before
 * `>` is a `/`" — is true of two tags that are **not** self-closing, and HTML
 * keeps their contents:
 *
 * - `<svg title="a>b" data-x=y/>` — the `/` is the last character of the
 *   unquoted value `y/`. Nothing ends an unquoted value but whitespace or `>`.
 * - `<svg title="a>b"/ >` — a self-closing marker is the two characters `/>`.
 *   Whitespace between them makes the `/` a stray, not a marker.
 *
 * Both matter because `svg` is dropped *with its contents*: reading either as
 * self-closing means no block-skipping and the element's text exported as story
 * prose. As with the `<script/>` case, the older tokenizer was safe here only
 * because its truncation removed the `/` before this ever saw it.
 *
 * So the slash is located by walking the attributes rather than by looking at
 * the end of the string: it closes the tag only if it sits immediately before
 * the `>` and outside an attribute value. Markup the walk cannot read keeps the
 * older suffix reading, which is what the rest of the module falls back to.
 */
function closesWithASelfClosingSlash(token: string): boolean {
  const attributesStart = findAttributesStart(token, 0);
  if (attributesStart === -1) {
    return false;
  }

  let index = attributesStart;
  let state: AttributeScanState = 'beforeAttributeName';
  let slashClosesTag = false;

  while (index < token.length) {
    const character = token[index];

    if (character === '>') {
      return slashClosesTag;
    }

    if (state === 'beforeValue' && (character === '"' || character === "'")) {
      const valueEnd = findAttributeValueEnd(token, index);
      if (valueEnd === -1) {
        break;
      }

      index = valueEnd + 1;
      state = 'beforeAttributeName';
      slashClosesTag = false;
      continue;
    }

    // A `/` is a marker only where a value is not expected. Inside an unquoted
    // value it is one of its characters, and directly after an `=` it *begins*
    // one — `<svg data-x=/>` gives `data-x` the value `/` and leaves the element
    // open, contents and all.
    slashClosesTag = character === '/' && state !== 'unquotedValue' && state !== 'beforeValue';
    state = nextAttributeState(state, character);
    index += 1;
  }

  return token.slice(0, -1).trimEnd().endsWith('/');
}

/**
 * Whether a character can *begin* a start-tag name.
 *
 * Narrower than `isTagNameCharacter`, which is the set a name may continue
 * with: HTML requires an ASCII letter here, so `<1 x="a>` is prose a reader
 * typed rather than a tag. Accepting a digit let the attribute scan read an
 * attribute list out of that prose and pair its quote with one in the sentence.
 */
function isTagNameStartCharacter(character: string | undefined): boolean {
  if (!character) {
    return false;
  }

  const codePoint = character.codePointAt(0) ?? 0;
  return (codePoint >= 65 && codePoint <= 90) || (codePoint >= 97 && codePoint <= 122);
}

function isWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\n' || character === '\t' || character === '\r' || character === '\f';
}
