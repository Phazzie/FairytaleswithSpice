// Created: 2026-08-27 UTC

/**
 * Escape the characters that mean something to a regular expression, so a
 * keyword can be interpolated into one as a literal.
 *
 * Three keyword scans needed this exact function and each wrote its own copy:
 * `storyContentAnalysis`'s `containsWholeWord`, `storyQualityHeuristics`'s
 * `containsWholeWord` and `containsWordForm`, and — as the third — the
 * cliffhanger hook matcher. A third copy is what the duplication gate exists to
 * catch, and it is the same argument `collapseWhitespace` next door was
 * extracted under: this is one operation with one right answer, and a
 * repository that spells it three times can fix it in two.
 *
 * `$&` is the whole match, so the replacement puts a backslash in front of
 * whichever metacharacter was found. `-` is deliberately absent: it is a
 * metacharacter only inside a character class, and none of these callers builds
 * one.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
