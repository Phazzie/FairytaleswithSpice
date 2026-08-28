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

/**
 * The endings English doubles a final consonant before.
 *
 * `plan` becomes `planning`, not `planing`, and the rule is about the ending:
 * a stem ending consonant-vowel-consonant doubles that last consonant before an
 * ending that *begins with a vowel*. `s`, `d`, `r` and `rs` never trigger it, so
 * naming the vowel-initial ones is what keeps the generated set to forms English
 * actually writes rather than one doubled spelling per ending.
 */
const VOWEL_INITIAL_INFLECTION_SUFFIXES = WORD_INFLECTION_SUFFIXES.filter(suffix => /^[aeiou]/.test(suffix));

/** A single consonant, as the doubling rule means it — `y` and `w` do not double. */
const DOUBLING_CONSONANT = /[bcdfgklmnprstvz]$/;

/**
 * Every spelling of `word` that is still the same word.
 *
 * A matcher that compares strings needs the forms themselves, where a matcher
 * that builds patterns can interpolate `WORD_INFLECTION_SUFFIX_PATTERN` and let
 * the engine do it. `scoreActivationCandidates` is the first of the former.
 *
 * **The doubled consonant is the half a suffix list alone does not cover, and
 * leaving it out was a defect.** Appending the endings to the stem gives
 * `planed`, `ploted` and `commited` — none of which anyone writes. The forms a
 * brief really contains are `planning`, `plotting` and `committed`, and a scan
 * that cannot see them scores an explicitly named thread zero and falls back to
 * story order, which is the exact failure the whole-word repair exists to stop,
 * arriving from the other direction. The substring reading it replaced caught
 * all three for free, so this is a match it got *right* and the repair has to
 * keep.
 *
 * Doubling is applied to the last character rather than to a stress-tested
 * consonant-vowel-consonant stem, because the generated forms are only ever
 * *looked up* — a spelling English would not write simply never occurs in a
 * brief, and costs one failed string comparison. What that buys is not having a
 * syllable model in a module that compares words.
 *
 * The word itself is first, so the common case is the first comparison.
 */
export function inflectedWordForms(word: string): readonly string[] {
  const forms = [word, ...WORD_INFLECTION_SUFFIXES.map(suffix => `${word}${suffix}`)];
  const finalCharacter = word.slice(-1);

  if (DOUBLING_CONSONANT.test(word)) {
    forms.push(...VOWEL_INITIAL_INFLECTION_SUFFIXES.map(suffix => `${word}${finalCharacter}${suffix}`));
  }

  return forms;
}
