// Created: 2026-08-26 UTC

/**
 * Cut prose down to an excerpt, at a boundary a reader would recognise.
 *
 * Three places still cut with `String.prototype.slice` and a number, and all
 * three feed a model rather than a screen:
 *
 * - `ImageService.buildSceneDescriptionFromStory` — already fixed, and the
 *   reading below is its `capAtWordBoundary` moved here rather than a new one.
 * - `StoryService.generateNextChapterHint` — `candidate.slice(0, 197)`, the last
 *   sentence of a chapter, handed back to the client as `nextChapterHint` and
 *   put in front of the reader as what happens next.
 * - `StoryService.createContextExcerpt` — `text.slice(-1200)`, the tail of
 *   everything written so far, interpolated into the continuation prompt as
 *   `PREVIOUS CHAPTER EXCERPT`.
 * - `buildContinuityPrompt` — `.slice(0, 2200)` per chapter, the prose the
 *   continuity extractor derives the next continuation's character, thread, and
 *   artifact state from.
 *
 * `slice` counts UTF-16 code units, so a cut can land between the halves of a
 * surrogate pair and leave a lone surrogate — the failure `chunkByCodePoint` in
 * the export service and `capUtf8Bytes` in the download filename both iterate
 * code points to avoid. `JSON.stringify` escapes such a surrogate rather than
 * refusing it, so nothing throws: the prompt is simply built with a character
 * the story never contained, and the story's own emoji or astral-script
 * character is gone.
 *
 * The other half is the word. A cut at an arbitrary offset ends — or, for the
 * tail, starts — mid-word, so the model is shown a fragment and asked to
 * continue from it. Backing up to whitespace costs at most one word and is the
 * difference between an excerpt and a truncation.
 */

/**
 * Cut to at most `maxCodePoints` whole characters, then back up to the last
 * whitespace so the excerpt does not end mid-word. A first word longer than the
 * whole cap has no whitespace to back up to and is kept as it is, which is still
 * a whole-character cut.
 */
export function capAtWordBoundary(value: string, maxCodePoints: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxCodePoints) {
    return value;
  }

  return endAtWordBoundary(characters.slice(0, maxCodePoints).join(''), characters[maxCodePoints]);
}

/**
 * The same cut, measured in UTF-16 code units instead of code points.
 *
 * `continuationGuidance` packs the hidden guidance into a byte-ish budget it
 * spends line by line — `usedLength += 1 + nextLine.length` — so a cut stated
 * in code points would let one astral character spend two of the budget's
 * units, and the section it belongs to would overrun the cap it was measured
 * against. Restating that module's budget in code points is a different change
 * with a wider blast radius than the cut itself, so the cut is stated in the
 * unit the budget is already kept in.
 *
 * That is the only difference. A code point is never split — an astral
 * character costs two units and is taken whole or not at all, so the cut cannot
 * leave the lone surrogate `slice` leaves — and the result still backs up to
 * the last whitespace rather than ending mid-word.
 */
export function capAtWordBoundaryWithinCodeUnits(value: string, maxCodeUnits: number): string {
  if (value.length <= maxCodeUnits) {
    return value;
  }

  let capped = '';
  for (const character of value) {
    if (capped.length + character.length > maxCodeUnits) {
      break;
    }

    capped += character;
  }

  // The cut is measured in code units here, so the character it stopped before
  // starts at that many units into the value. Whitespace is one unit wide in
  // UTF-16, so reading a single one is enough to recognise it.
  return endAtWordBoundary(capped, value[capped.length]);
}

/**
 * Finish a cut at a word boundary, giving back only what the cut actually broke.
 *
 * `nextCharacter` is the one the cut stopped before — the first character of
 * the remainder, or `undefined` when there is none. **Backing up without
 * consulting it was a defect**: a cut that lands exactly where a word ends has
 * broken nothing, and backing up anyway discards a whole intact word for no
 * reason. `capAtWordBoundary('alpha beta gamma', 10)` answered `'alpha'`, not
 * `'alpha beta'` — a hint that stops a word earlier than it needed to, and a
 * continuity excerpt that spends a word of its budget on nothing. The module's
 * own claim is that backing up "costs at most one word"; it was costing one
 * that had not been cut.
 *
 * So the boundary is recognised rather than assumed. Whitespace after the cut
 * means the last word inside it is whole, and the only thing to give back is
 * trailing whitespace the cut may have included.
 */
function endAtWordBoundary(capped: string, nextCharacter: string | undefined): string {
  return isWhitespace(nextCharacter) ? capped.trimEnd() : backUpToWordBoundary(capped);
}

/**
 * Give back whatever a cut took out of the middle of a word. A cut with no
 * whitespace in it at all — one unbroken run longer than the cap — is kept as
 * it is, which is still a whole-character cut.
 */
function backUpToWordBoundary(capped: string): string {
  for (let index = capped.length - 1; index >= 0; index -= 1) {
    if (isWhitespace(capped[index])) {
      return capped.slice(0, index).trimEnd();
    }
  }

  return capped;
}

/** Whether a character exists and is whitespace; `undefined` is the end of the string. */
function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/.test(character);
}

/**
 * Keep the last `maxCodePoints` whole characters, then move forward to the next
 * whitespace so the excerpt does not begin mid-word.
 *
 * The mirror of `capAtWordBoundary`, for the excerpt that has to end where the
 * story ends: a continuation prompt shows the model the most recent prose, so
 * the cut is at the front. A tail with no whitespace in it at all — one
 * unbroken run longer than the cap — is kept as it is, for the same reason the
 * cap keeps an over-long first word.
 */
export function tailAtWordBoundary(value: string, maxCodePoints: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxCodePoints) {
    return value;
  }

  const start = characters.length - maxCodePoints;
  const tail = characters.slice(start).join('');

  // The mirror of the cap's boundary check: a tail that starts just after
  // whitespace starts on a whole word, so moving forward would drop one the cut
  // never broke. `tailAtWordBoundary('alpha beta gamma', 10)` answered
  // `'gamma'` where `'beta gamma'` was intact.
  if (isWhitespace(characters[start - 1])) {
    return tail.trimStart();
  }

  for (let index = 0; index < tail.length; index += 1) {
    if (isWhitespace(tail[index])) {
      return tail.slice(index).trimStart();
    }
  }

  return tail;
}
