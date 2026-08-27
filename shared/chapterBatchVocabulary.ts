// Created: 2026-08-27 UTC

/**
 * How many chapters one request generates, and therefore the only value any
 * `chapterBatchSize` or `requestedChapterCount` in this repository carries.
 *
 * These are one field with two names. `toClassicGenerationInput` and its
 * continuation sibling in `storyLabEngine` pass `input.chapterBatchSize`
 * straight into the classic seam's `requestedChapterCount`, so a Story Lab
 * batch size *is* the number `StoryService` is asked to write — which is why
 * the two spellings have to be the same closed set and not two sets that
 * happen to agree today.
 *
 * The Story Lab half of that set was made one table when the two continuation
 * routes were found writing `[1, 2, 3].includes(size)` by hand; the classic
 * half kept every copy it had. There were six of them, all inside the seam the
 * Story Lab hands its blueprint to:
 *
 * - the inline `1 | 2 | 3` on `StoryGenerationSeam['input']` and again on
 *   `ChapterContinuationSeam['input']` in the API's own contract, which is the
 *   only statement of the bound the wire has;
 * - `StoryService.isValidRequestedChapterCount`, a bare `[1, 2, 3].includes`;
 * - the refusal it produces, `requestedChapterCount must be 1, 2, or 3`, sent
 *   from `continueChapter` and again from `validateStoryInput` — the sentence
 *   whose whole job is to state the bound, stating it from memory;
 * - `expectedType: '1 | 2 | 3'` beside each of those two refusals, a fifth and
 *   sixth spelling naming the union that was itself a copy;
 * - `StoryService.normalizeChapterCount`, whose `<= 1 → 1`, `>= 3 → 3`,
 *   otherwise `2` hardcodes both endpoints *and* the fact that there are
 *   exactly three of them.
 *
 * A fourth batch size is what that costs, and it fails twice over. The picker
 * offers it, the blueprint parser accepts it, and both continuation routes now
 * accept it — all four reading the table — and then the request reaches
 * `StoryService`, which refuses it as `INVALID_INPUT` naming a range nobody
 * told it had moved. Remove that refusal and `normalizeChapterCount` answers
 * `3` for it instead: a validated request for four chapters, silently
 * generating three, with `chaptersRequested` in the response metadata
 * reporting the number the reader asked for. The seventh copy was the Angular
 * form's own refusal, `Choose 1, 2, or 3 chapters per batch.`, written out
 * beside a `VALID_BATCH_SIZES` set built from the table.
 *
 * Kept in `shared/` beside `creatureVocabulary` and `themeVocabulary`, for the
 * reason those give: this module sits below both trees and can import neither,
 * which is what lets the API's contract and the Angular picker read one list.
 */
export const CHAPTER_BATCH_SIZES = [1, 2, 3] as const;

/**
 * The union, read from the table rather than restated beside it.
 *
 * Derived rather than declared-and-`satisfies`-checked for the reason
 * `WORD_COUNTS` and `IMAGE_STYLES` give: a `satisfies` clause catches a *wrong*
 * entry, and every copy of this list could only ever go wrong by being short
 * one.
 */
export type ChapterBatchSize = typeof CHAPTER_BATCH_SIZES[number];

const CHAPTER_BATCH_SIZE_SET: ReadonlySet<unknown> = new Set<unknown>(CHAPTER_BATCH_SIZES);

/** Whether `value` is a batch size this app runs, checked against the table. */
export function isChapterBatchSize(value: unknown): value is ChapterBatchSize {
  return CHAPTER_BATCH_SIZE_SET.has(value);
}

/**
 * The batch sizes as a refusal names them, read from the table it checks.
 *
 * Rendered as a list rather than the `1-3` range the messages used, because a
 * range is only honest while the table is contiguous and a list is honest
 * either way. Today it reads `1, 2, or 3`.
 */
export function formatChapterBatchSizeList(): string {
  const sizes: readonly number[] = CHAPTER_BATCH_SIZES;

  return sizes.length > 1
    ? `${sizes.slice(0, -1).join(', ')}, or ${sizes[sizes.length - 1]}`
    : sizes.join('');
}

/** The smallest batch the app will run, which is what an absent count means. */
const SMALLEST_CHAPTER_BATCH_SIZE: ChapterBatchSize = CHAPTER_BATCH_SIZES.reduce(
  (smallest, size) => (size < smallest ? size : smallest)
);

/**
 * Bring a caller's count onto the table: the largest size that is not larger
 * than it, or the smallest size when there is none.
 *
 * This is `StoryService.normalizeChapterCount`, which is reached only after
 * `isChapterBatchSize` has already accepted the value or found it absent — so
 * on every path the app can take, it returns exactly what it was given. What
 * it is for is the path where that guard is skipped or moved, and there the
 * old form's hardcoded endpoints were the failure: `>= 3` answered `3` for a
 * fourth size the rest of the app had been taught to offer.
 *
 * The one behaviour that changes is the one the old form got wrong for the
 * same reason it hardcoded the rest. `NaN` satisfied neither `<= 1` nor
 * `>= 3`, so an unreadable count fell through to the literal `2` — a
 * two-chapter batch conjured from a value that was not a number at all. It
 * now answers the smallest size, which is what an absent count already meant.
 */
export function clampToChapterBatchSize(value: unknown): ChapterBatchSize {
  const numeric = Number(value ?? SMALLEST_CHAPTER_BATCH_SIZE);
  if (!Number.isFinite(numeric)) {
    return SMALLEST_CHAPTER_BATCH_SIZE;
  }

  return CHAPTER_BATCH_SIZES.reduce<ChapterBatchSize>(
    (chosen, size) => (size <= numeric && size > chosen ? size : chosen),
    SMALLEST_CHAPTER_BATCH_SIZE
  );
}
