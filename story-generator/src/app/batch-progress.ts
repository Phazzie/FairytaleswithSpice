// Created: 2026-09-09

/**
 * How to present a finished generation/continuation batch, decided in one
 * place rather than inline in `AppComponent`.
 *
 * A batch that stopped short of its requested chapter count still kept the
 * chapters it did generate — `storyLabEngine.ts`'s
 * `getZeroChapterGenerationError` only hard-fails when nothing generated at
 * all, so a mid-batch shortfall (the serverless time budget running out, the
 * expected path under real load) reaches here as a normal completed batch
 * with `partialFailures` attached, not as a failed job. Presenting that with
 * the same unqualified "success" copy as a full batch would hide from the
 * reader that anything was skipped; this is what tells `applyIteration`/
 * `handleJobSnapshot` to say otherwise.
 */

export interface ChapterFailureSummary {
  chapterNumber: number;
  message: string;
}

/**
 * Whether `value` is a shape `describePartialBatchFailures` can safely `.map()`
 * over — `undefined` (no shortfall) or an array of well-formed entries.
 *
 * A completed job's result reaches the caller from the same untrusted places
 * `hasRenderableIterationPayload` already guards against — an older stored
 * row, a durable store answering a partial record — so `batch.partialFailures`
 * needs the same fail-closed check as `batch.chapters`/`summary.storyId`
 * rather than being trusted because the type declares it. A non-array value
 * with a truthy `.length` (a string, for instance) would otherwise reach
 * `.map()` inside the job event stream's callback and throw there, the exact
 * failure mode that guard exists to prevent.
 */
export function isValidPartialFailures(value: unknown): value is ChapterFailureSummary[] | undefined {
  return value === undefined || (
    Array.isArray(value)
    && value.every(entry => typeof entry?.chapterNumber === 'number' && typeof entry?.message === 'string')
  );
}

export function describePartialBatchFailures(failures: ChapterFailureSummary[]): string {
  const chapterNumbers = failures.map(failure => failure.chapterNumber).join(', ');
  const noun = failures.length === 1 ? 'chapter' : 'chapters';
  return `Stopped short of the full batch — ${noun} ${chapterNumbers} did not generate. What did generate is saved below.`;
}

interface BatchCompletionCopy {
  completedStatusMessage: string;
  completedNotificationTitle: string;
  completedNotificationMessage: (chapterCount: number) => string;
}

export interface BatchCompletionNotice {
  level: 'success' | 'warning';
  statusMessage: string;
  notificationTitle: string;
  notificationMessage: string;
}

export function describeBatchCompletionNotice(
  copy: BatchCompletionCopy,
  chapterCount: number,
  partialFailures: ChapterFailureSummary[] | undefined
): BatchCompletionNotice {
  const notificationMessage = copy.completedNotificationMessage(chapterCount);
  if (!partialFailures?.length) {
    return {
      level: 'success',
      statusMessage: copy.completedStatusMessage,
      notificationTitle: copy.completedNotificationTitle,
      notificationMessage
    };
  }

  const failureSummary = describePartialBatchFailures(partialFailures);
  return {
    level: 'warning',
    statusMessage: failureSummary,
    notificationTitle: `${copy.completedNotificationTitle} (partial)`,
    notificationMessage: `${notificationMessage} ${failureSummary}`
  };
}
