// Created: 2026-08-27 UTC

import { READING_SPEED } from '../constants';

/**
 * How long a story of `wordCount` words takes to read, in whole minutes.
 *
 * Three places estimated this and each spelled the arithmetic itself.
 * `ExportService.generateMetadata` read `READING_SPEED.WORDS_PER_MINUTE`, and
 * its own docblock explains why it should: the constant "has been in
 * `constants.ts` since that file was written [...] with no reader anywhere in
 * the repository — the one place that estimates a reading time spelled `200`
 * inline instead. A named constant nothing reads is not a constant; it is a
 * note."
 *
 * That change gave the constant one reader and stopped there.
 * `StoryService.generateStory` and `StoryService.continueChapter` both still
 * spelled `Math.max(1, Math.ceil(totalWordCount / 200))`, so the note became a
 * constant with one reader and two copies — the same defect one round further
 * along, and the argument against it is the one already made above: retuning
 * `WORDS_PER_MINUTE` would move the read time in the exported document and
 * leave the `estimatedReadTime` in the API response, for the same story, at the
 * old rate.
 *
 * The three expressions agree today, and this is a de-duplication rather than a
 * repair of a number a reader is currently shown. What it removes is the way
 * they could stop agreeing: one statement of the estimate, three call sites,
 * nothing to keep in step by hand.
 *
 * The floor is the one place they were written differently — the two
 * `StoryService` sites floored at a minute and the export did not — though not
 * in a way any request could reach, since `/api/export/save` refuses a body
 * whose `content` is not a non-empty string and `countWords` answers at least
 * one for anything that clears it. The floor is kept, because it is right for
 * the case it describes: any story with prose in it takes a reader some part of
 * a minute, and a whole-minute estimate has one minute as its smallest honest
 * value. Zero is reserved for a word count of zero, where there is nothing to
 * read and `0` says so rather than asserting a duration for an empty document.
 */
export function estimateReadTimeMinutes(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(wordCount / READING_SPEED.WORDS_PER_MINUTE));
}
