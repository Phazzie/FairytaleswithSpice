// Created: 2026-08-28 UTC

/**
 * The endings a keyword may pick up and still be the same word.
 *
 * This was `WORD_INFLECTION_SUFFIXES` in `storyQualityHeuristics.ts`, written
 * there as a regex fragment for the scans that build patterns. It is here
 * because a second reader needs it and cannot see that one:
 * `scoreActivationCandidates` in `continuityActivation.ts` sits in `shared/`,
 * below both trees, and matches by string comparison rather than by pattern —
 * so it needs the endings as a list, and the heuristics need them as an
 * alternation. One declaration, two shapes, rather than the same seven endings
 * spelled twice and drifting.
 *
 * `d` and `ed` are both here because English spells the past tense both ways
 * depending on whether the stem already ends in `e` (`loved`, `burned`), and
 * `r`/`rs` because an agent noun is the form this genre actually writes for
 * several of these stems (`lover`, `lovers` for a `forbidden_love` seed).
 *
 * Endings that build a *different* word are deliberately absent, and that
 * absence is what makes the set safe for a prefix test as well as for a
 * pattern: `less` is what makes `priceless` out of `price` and `nameless` out
 * of `name`, `ly` what makes `secretly` out of `secret`. Both would turn a
 * whole-word match back into the collision it was fixed for.
 */
export const WORD_INFLECTION_SUFFIXES = ['s', 'es', 'd', 'ed', 'ing', 'r', 'rs'] as const;

/**
 * The same set as the optional regex alternation the pattern-building scans
 * interpolate after an escaped keyword.
 *
 * Every ending is plain lowercase letters, so none of them needs escaping and
 * the join is safe as it stands. That is a property of the list rather than of
 * this line, so `tests/continuity-activation.test.ts` asserts it: an ending
 * added later that carried a metacharacter would silently turn every scan that
 * interpolates this into a different pattern.
 */
export const WORD_INFLECTION_SUFFIX_PATTERN = `(?:${WORD_INFLECTION_SUFFIXES.join('|')})?`;
