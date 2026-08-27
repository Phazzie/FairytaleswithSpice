// Created: 2026-08-27 02:55 UTC

/**
 * Collapse any run of whitespace to a single space and trim the ends.
 *
 * Three modules needed this exact operation and each wrote its own version:
 * a one-line regex in `storyQualityHeuristics.ts`, a second one-line regex
 * (via `stripStoryHtmlToText`) in `storyContentAnalysis.ts`, and a hand-rolled
 * character-by-character loop in `storyLabEngine.ts` that checked only
 * ASCII space/`\n`/`\r`/`\t`/`\f`/`\v` for "is whitespace" — narrower than
 * `\s`, which also collapses other Unicode space separators (e.g. a
 * non-breaking space) that the loop passed through untouched. This is the
 * one implementation all three should share.
 */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
