// Created: 2026-08-27 UTC

import { escapeRegExp } from './regexEscape';

/**
 * The characters that make a keyword part of a longer word.
 *
 * Every keyword scan in this repository asks the same question — is this hook,
 * theme word, pressure word, or emotion word *the* word, or is it sitting
 * inside a longer one — and the question had four answers. Three of them were
 * `\b`:
 *
 * - `containsWholeWord` in `storyContentAnalysis`, which decides
 *   `themesContinued`, the reported spicy level of a continuation, the plot
 *   threads a continuation prompt is told are open, and the emotional tone it
 *   is told the last chapter had;
 * - `PRESSURE_KEYWORD_PATTERNS` in `continuationGuidance`, which decides which
 *   pressures the continuity courtroom reports;
 * - `CLIFFHANGER_HOOK_PATTERNS` in `cliffhangerService`, which decides a
 *   chapter's `cliffhangerType` and therefore the three continuations the next
 *   batch is prompted with.
 *
 * The fourth, `storyQualityHeuristics`, spelled it out as the lookarounds
 * below, and it is the one that is right. **`\b` is ASCII-only**: JavaScript
 * defines it against `[A-Za-z0-9_]`, so it finds a word boundary between an
 * ASCII letter and an accented one, and every one of those scans credited a
 * keyword sitting inside a word that ends in an accent. `"Touché," he said`
 * matched `touch` and filed the chapter at spicy level 3 — Romantic with Heat,
 * on a word of fencing banter — and `caressé`, `sińful`, and `desiré` land the
 * same way. It is the same collision class the substring scans were fixed for,
 * arriving through the boundary that was supposed to have ended it, and the
 * same non-ASCII blindness `shared/continuityActivation.ts` was written to end
 * for the activation scan.
 *
 * `\p{M}` is in the class for the decomposed spellings of those same words:
 * with the accent as a combining mark, `desiré` is `desire` followed by a
 * character that is not a letter, so a lookahead that named only `\p{L}\p{N}`
 * would credit `desire` again.
 *
 * `_` is deliberately *not* here, where `\b` counted it: an underscore joins
 * two words rather than continuing one, and the ids this app writes with it —
 * `power_dynamics`, `dark_secrets`, `forbidden_love` — name the very words
 * these scans are looking for.
 */
const WORD_CHARACTERS = String.raw`\p{L}\p{N}\p{M}`;

/**
 * Wrap a pattern source in the word boundaries above.
 *
 * Takes regex source rather than a literal so a caller that has already built
 * one — `containsWordForm`'s stem plus its inflection suffixes, the
 * `what if/would/could` phrase — asks the same boundary question as the plain
 * keywords beside it. Callers with literals should use the two helpers below,
 * which escape for them.
 *
 * The `u` flag is what gives `\p{…}` its meaning, and it makes the escaping
 * matter: an identity escape that is not a recognised one is a syntax error
 * under `u`, so a keyword must go through `escapeRegExp`, which escapes only
 * characters that are valid to escape.
 */
export function wholeWordPattern(source: string): RegExp {
  return new RegExp(String.raw`(?<![${WORD_CHARACTERS}])(?:${source})(?![${WORD_CHARACTERS}])`, 'u');
}

/**
 * One pattern matching any of `spellings` as a whole word or whole phrase.
 *
 * The boundary falls at the ends of the alternation rather than around each
 * word inside a phrase, which is what keeps `blood froze` one hook and not two
 * independent hits, and what leaves a hyphenated keyword such as `star-crossed`
 * matching as itself.
 *
 * Compiled once per table by the callers that scan repeatedly, never per call.
 */
export function wholeWordAlternationPattern(spellings: readonly string[]): RegExp {
  return wholeWordPattern(spellings.map(escapeRegExp).join('|'));
}

/**
 * Whether `text` contains `keyword` as a whole word or whole phrase.
 *
 * Case is the caller's to settle: every caller here lowercases both sides
 * before asking, so no case-insensitive flag is set.
 */
export function containsWholeWord(text: string, keyword: string): boolean {
  return wholeWordAlternationPattern([keyword]).test(text);
}
