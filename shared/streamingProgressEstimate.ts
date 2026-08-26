// Created: 2026-08-26 UTC

/**
 * Read a streaming generation's progress as the numbers the reader is shown.
 *
 * The genesis stream reports one thing about its own progress: a `percentage`.
 * Everything beside it on screen — how many words exist so far, how fast they
 * are arriving, how long the rest will take — has to be derived, and the
 * streaming panel derived the last two from the first with no clock in the
 * arithmetic at all:
 *
 * ```
 * generationSpeed = Math.max(Math.floor(wordsGenerated / 20), 1)
 * ```
 *
 * That is not a speed. It is the word count divided by a constant, rendered as
 * `words/sec` and used as the divisor of `estimatedWordsRemaining` for the
 * `~Ns remaining` beside it — so the two readings cancel and the estimate
 * collapses onto a number that depends only on how far through the story the
 * stream is. Halfway through any story it says twenty seconds; halfway through
 * the same story on a connection three times slower it still says twenty
 * seconds. A generation that had stalled completely reported `1 word/sec` and
 * counted down as if it were working, because the floor of `1` cannot express
 * "nothing is arriving".
 *
 * A speed needs elapsed time, which the caller has and this module asks for. The
 * two numbers then mean what the labels beside them say: words actually seen per
 * second actually spent, and the remaining words at that rate.
 *
 * Kept in `shared/` beside `eventStreamRetry` — the other reading of a streaming
 * detail that the Angular tree needed and could not be asserted on inside it —
 * so the arithmetic can be tested directly rather than through a component that
 * needs a browser and an `EventSource`.
 */

export interface StreamingProgressEstimateInput {
  /** The `percentage` the stream reported, 0-100. */
  percentage: number;
  /** The word budget the generation was asked for. */
  targetWords: number;
  /** Milliseconds since the stream was opened. */
  elapsedMs: number;
}

export interface StreamingProgressEstimate {
  wordsGenerated: number;
  estimatedWordsRemaining: number;
  /**
   * Words per second, or `0` when nothing has been measured yet — no elapsed
   * time, or no words. `0` is renderable as "no speed known"; the old floor of
   * `1` was not, and claimed a stalled stream was moving.
   */
  generationSpeed: number;
  /**
   * Seconds until the target is reached at the measured speed, or `null` when
   * there is no speed to divide by. `null` rather than `0`, because a caller
   * that renders `0` renders "arriving now" for a stream that has told it
   * nothing.
   */
  estimatedSecondsRemaining: number | null;
}

/**
 * Percentages arrive from the server and word budgets from a form, so both are
 * read defensively: anything that is not a finite number, and any percentage
 * outside 0-100, would otherwise put `NaN` or a negative count on screen.
 */
function readPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function readTargetWords(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function readStreamingProgressEstimate(
  input: StreamingProgressEstimateInput
): StreamingProgressEstimate {
  const targetWords = readTargetWords(input.targetWords);
  const wordsGenerated = Math.round((readPercentage(input.percentage) / 100) * targetWords);
  const estimatedWordsRemaining = Math.max(targetWords - wordsGenerated, 0);

  const elapsedSeconds = Number.isFinite(input.elapsedMs) ? Math.max(input.elapsedMs, 0) / 1000 : 0;
  const generationSpeed = elapsedSeconds > 0 && wordsGenerated > 0
    ? wordsGenerated / elapsedSeconds
    : 0;

  return {
    wordsGenerated,
    estimatedWordsRemaining,
    generationSpeed,
    estimatedSecondsRemaining: generationSpeed > 0
      ? Math.ceil(estimatedWordsRemaining / generationSpeed)
      : null
  };
}
