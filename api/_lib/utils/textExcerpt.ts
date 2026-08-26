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

  const capped = characters.slice(0, maxCodePoints).join('');
  for (let index = capped.length - 1; index >= 0; index -= 1) {
    if (/\s/.test(capped[index])) {
      return capped.slice(0, index).trimEnd();
    }
  }

  return capped;
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

  const tail = characters.slice(characters.length - maxCodePoints).join('');
  for (let index = 0; index < tail.length; index += 1) {
    if (/\s/.test(tail[index])) {
      return tail.slice(index).trimStart();
    }
  }

  return tail;
}
