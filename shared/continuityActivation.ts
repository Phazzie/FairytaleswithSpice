// Created: 2026-08-27 UTC

import type { PlotThreadStatus } from './storyStateVocabulary';
import { inflectedWordForms } from './wordInflections';

/**
 * How a continuation brief decides which continuity the next batch is shown.
 *
 * `buildContinuationGuidance` in `api/_lib/story-lab/continuationGuidance.ts`
 * scores every unresolved thread, artifact, relationship, and continuity
 * warning against the brief the reader wrote, orders them by that score, and
 * puts the top few in front of the model. The Story Lab's "Continuity Preview"
 * panel exists to show the reader that decision before they press continue, and
 * it labels each item it lists either `Matched continuation guidance` or the
 * name of the fallback that put it there.
 *
 * The panel was making that claim from its own scorer. `AppComponent` had a
 * `normalizePreviewActivationText` and a `scorePreviewActivationMatch` written
 * beside the ones in the guidance builder, and the two did not agree:
 *
 * - **The token floor was different.** The guidance counts a candidate's words
 *   only past `ACTIVATION_TOKEN_MIN_LENGTH`; the panel counted them past three
 *   characters. So a brief that says `vow`, `oath`, `key`, or any other short
 *   word the story's own promises are named with scored on the panel and not in
 *   the prompt: a thread called `Broken vow` was reported as `Matched
 *   continuation guidance` against a brief mentioning a vow, while the guidance
 *   scored it zero and ordered it by story position like everything else.
 * - **The candidates were combined differently.** The guidance adds up what a
 *   thread's label, description, and foreshadowed devices each contribute; the
 *   panel took the single best of them. A thread matched once strongly and a
 *   thread matched three times weakly rank one way in the prompt and the other
 *   way on the panel, so the two could name a different top thread from the same
 *   brief and the same state.
 * - **Punctuation was kept on one side.** The panel's normalizer retained the
 *   apostrophe, the guidance's did not, so `Mira's oath` was one candidate
 *   phrase in the preview and `mira s oath` in the prompt.
 *
 * None of that surfaces as an error. The panel simply describes a selection the
 * run does not make, on a screen whose only purpose is to describe it — the
 * same failure `shared/storyPromptTables.ts` and `shared/authorStyleBanks.ts`
 * were written to end for the prompt's other tables, and for the same reason:
 * a preview that disagrees with the run is worse than no preview, because the
 * reader has no way to tell.
 *
 * Kept in `shared/` because it is the one judgement both trees have to make
 * identically, and this module sits below both and can import neither.
 */

/**
 * How much a candidate scores when the brief contains the whole of it.
 *
 * A phrase the reader typed in full is a far stronger signal than a word it
 * happens to share, so it is worth more than any plausible number of loose word
 * hits from the same candidate.
 */
export const ACTIVATION_WHOLE_CANDIDATE_SCORE = 6;

/**
 * The shortest word of a candidate that counts on its own.
 *
 * Below this, a token is `the`, `and`, `a`, `of` — words every brief and every
 * thread label contains, which would score every candidate against every brief
 * and flatten the ordering this module exists to produce.
 */
export const ACTIVATION_TOKEN_MIN_LENGTH = 4;

/**
 * How long a token is *as a word*, which is not the same as how long it is.
 *
 * The floor above is a claim about how much word a token has to be before it
 * carries signal, and it was measured with `.length` — which was the same thing
 * only while the normalizer kept letters and numbers alone. Once marks are
 * retained, `.length` counts them too, and a mark is not a letter: the Arabic
 * preposition `مِنْ` is two letters wearing two marks, so it measures four and
 * clears a floor built to exclude exactly this — `the`, `and`, `of`, the words
 * every brief and every label contains. Letting stopwords through is how the
 * ordering flattens, which is the failure the floor exists to prevent, so a
 * repair that retains marks has to say what it is retaining them *for*: they
 * hold a word together for the comparison, and they are not more of the word
 * for the measurement.
 *
 * Nothing changes for text that was already ASCII, which has no marks to count.
 */
function wordCharacterCount(token: string): number {
  return Array.from(token).filter(character => ACTIVATION_PART_HAS_WORD_CHARACTER.test(character)).length;
}

/**
 * What a plot thread's `status` may be, as both trees' `PlotThread` declares it.
 *
 * Re-exported from `storyStateVocabulary` rather than declared here: this was a
 * fifth hand-written copy of the four statuses, and the one furthest from the
 * table — `formatThreadDebtLabel` below named three of them and fell through for
 * the fourth, which was only correct while the union had exactly four members.
 * It is keyed by this union now, so the table decides how many branches it has.
 */
export type { PlotThreadStatus };

/** What a part has to contain to be a word rather than a stray mark. */
const ACTIVATION_PART_HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Reduce a continuation brief, or one thread label, artifact name, or
 * continuity warning, to the lowercase words `scoreActivationCandidates`
 * compares.
 *
 * Both sides of that comparison come through here, so what this deletes is
 * invisible to it. `[^a-z0-9 ]+` deleted every letter outside ASCII, which made
 * the whole activation scan unreachable for a story not written in Latin
 * script: a thread labelled `Клятва Миры` normalized to the empty string, was
 * dropped as empty, and its activation score was zero however plainly the
 * reader's brief named it. The courtroom then chose which threads, artifacts,
 * and warnings to put in front of the model by story order alone — the reader
 * asks the next batch to pay off one promise and is given the first few
 * instead — and the guidance reported "Included by unresolved-story priority"
 * for every one of them, which was at least honest about what had happened.
 *
 * A partly-Latin name failed in a way that is harder to see: `José's pact`
 * became `jos s pact`, so the whole-candidate match against the brief could
 * never fire, and the word tokens the score falls back to were `pact` and a
 * `jos` that matches nothing a reader would type.
 *
 * Matching on the Unicode properties keeps those words whole. Every retained
 * character is still part of a word, so the scoring is unchanged for text that
 * was already ASCII: the separator run each unsupported character used to
 * become is exactly the separator run it becomes now.
 *
 * **`\p{L}\p{N}` alone did not finish that job, and the half it left out is the
 * half the scripts that need it most depend on.** A combining mark is not a
 * letter, so `[^\p{L}\p{N} ]` read every one of them as a separator and cut the
 * word it belongs to apart at each: `मेरी कहानी` normalized to `म र कह न` and
 * `เรื่องของฉัน` to `เร องของฉ น`. Both sides of the comparison shatter the
 * same way, so the whole-candidate match survives — but the per-word score
 * beneath it does not, because every fragment is now shorter than
 * `ACTIVATION_TOKEN_MIN_LENGTH`. A brief that names one word of a thread's
 * label, which is the ordinary case that score exists for, scores exactly zero
 * for those scripts, and the courtroom falls back to story order for the same
 * reason it used to before non-Latin text was retained at all. It is the class
 * `shared/storyDownloadFilename.ts` states at length and keeps `\p{M}` for; this
 * module is the reader that was left out of it.
 *
 * Normalizing is the other half of that same repair, and for the reason the
 * filename stem gives: the marks are kept either way, but `é` and `e` + U+0301
 * are different strings. The docblock's own `José` example fails across them —
 * a brief typed one way and a thread label stored the other never match, on a
 * name both plainly carry. `NFC` makes the two spellings one string; marks that
 * do not compose away, which is most of Devanagari, Thai, and Arabic, are what
 * `\p{M}` is for. Neither alone is enough.
 *
 * **A mark is only a word's mark when a base character precedes it, and asking
 * that per *part* rather than per mark was not enough.** A mark belongs to the
 * character before it, so the replacement above — which turns every removed
 * character into a space — leaves an orphan wherever the base it was attached
 * to has just been removed. `❤️pact` is the case: the heart is a symbol and
 * becomes a space, its variation selector is `\p{M}` and stays, and the part
 * that results is `️pact`, which *does* contain a letter and so survived a
 * whole-part test. That candidate then scored **0** against a brief plainly
 * saying `pact`, where before this module retained marks at all it scored 7 —
 * a regression introduced by the repair itself, and an invisible one in the
 * most literal sense.
 *
 * So each part drops the marks at its front, which is exactly where an orphan
 * can be: the replacement has already put a space wherever a base character was
 * removed, so a mark that survives with nothing before it inside its own part
 * had its base taken away. What is left of a part that was nothing but marks is
 * the empty string, which is not a word and is dropped with the rest.
 *
 * Dropping the empty parts is therefore the whole of the filter, and that is a
 * consequence worth stating rather than a shortcut: the replacement leaves only
 * letters, numbers, marks and spaces; the split consumes the spaces; the strip
 * removes every leading mark. So a part that survives non-empty must begin with
 * a letter or a number — "this part is a word" is an invariant the two steps
 * above establish, not a condition to re-test here. A first draft tested it
 * anyway, and the test could not fail; `tests/continuity-activation.test.ts`
 * asserts the invariant across the adversarial inputs instead, where weakening
 * either step is what breaks it.
 */
export function normalizeActivationText(value: unknown): string {
  return (typeof value === 'string' ? value : '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} ]+/gu, ' ')
    .split(/\s+/)
    .map(part => part.replace(ORPHANED_LEADING_MARKS, ''))
    .filter(part => part.length > 0)
    .join(' ');
}

/**
 * The marks at the front of a part, which are the ones whose base character the
 * replacement above removed. A mark anywhere else in the part follows a
 * character that survived, and belongs to it.
 */
const ORPHANED_LEADING_MARKS = /^\p{M}+/u;

/**
 * Whether `source` names `phrase` as whole words rather than as a substring.
 *
 * `includes` was the reading here, and these needles are short: `oath` is
 * inside `loathing`, `pact` inside `impact`, `court` inside `courtesy`, `vow`
 * inside `vowel`, `name` inside `nameless`. That is the substring scan
 * `extractThemesFromContent`, `extractSpicyLevelFromContent`, and
 * `containsAny` in `continuationGuidance` were each moved off — this module was
 * the one door left, and it is the one that orders the whole continuity
 * selection, so a collision here does not merely mis-score an item: it puts a
 * thread the brief never asked for in front of the model and leaves out the one
 * it did, on both the prompt and the panel that claims to preview it.
 *
 * The boundary is `containsWholeWord`'s, arrived at without its lookarounds.
 * Both sides of every comparison come through `normalizeActivationText` above,
 * which leaves a string of nothing but letters and numbers separated by single
 * spaces, with no leading or trailing space — every other character is already a
 * separator by then. So padding both sides with one space makes an `includes`
 * exact: ` oath ` occurs in ` honour the oath she made ` and not in ` she began
 * loathing him `. Stating it that way rather than importing the shared matcher
 * is what keeps this module below both trees, which is the whole reason it is
 * here; the reading is the same one, resting on the normalizer's own guarantee
 * instead of on `\p{L}\p{N}\p{M}` lookarounds that would have nothing left to
 * exclude.
 *
 * It holds for a phrase as much as for a word, because a normalized phrase is
 * its words with single spaces between them, which is exactly how they sit in a
 * normalized source.
 */
function namesWholeWords(source: string, phrase: string): boolean {
  return ` ${source} `.includes(` ${phrase} `);
}

/**
 * Whether `source` names `token` as a whole word, allowing the endings the same
 * word can carry.
 *
 * A whole-word matcher with no inflection table passes the "no false positives"
 * half of this repair and quietly costs the scan its real signal, which is the
 * lesson `continuationGuidance` recorded when it made the same move: the
 * substring reading picked up `oaths` for `oath` and `pacts` for `pact` for
 * free, and those are matches it got *right*. Dropping them would trade one
 * silent mis-ordering for another.
 *
 * Only the endings are allowed, and only at the end — which is exactly the half
 * of the substring reading that was sound. A brief's word has to *begin* with
 * the token and finish it with one of the seven, so `oaths` and `pacts` are
 * kept while every collision this repair is for is still refused: `loathing`
 * does not begin with `oath`, `impact` does not begin with `pact`, and
 * `courtesy` begins with `court` but continues `esy`, which is not an ending a
 * word keeps its meaning across. The endings that would re-open the collisions —
 * `less`, `ly` — are absent from the shared set for that reason.
 *
 * The reverse direction is deliberately not covered: a token of `oaths` is not
 * matched by a brief saying `oath`. The substring reading did not do that
 * either, so this is the behaviour it had, not a narrowing of it.
 */
function namesWord(source: string, wordOrPhrase: string): boolean {
  return inflectedWordForms(wordOrPhrase).some(form => namesWholeWords(source, form));
}

/**
 * How strongly `candidates` — the several strings one thread, artifact,
 * relationship, or warning can be recognised by — are named by `source`, the
 * normalized continuation brief.
 *
 * The candidates are added rather than maxed: a thread whose label, description,
 * and foreshadowed device all echo the brief is more plainly asked for than one
 * whose label alone does, and the ordering this produces is what decides which
 * continuity the next batch is shown.
 */
export function scoreActivationCandidates(candidates: readonly unknown[], source: string): number {
  if (!source) {
    return 0;
  }

  const normalizedCandidates = candidates.map(normalizeActivationText).filter(Boolean);
  let score = 0;

  for (const candidate of normalizedCandidates) {
    if (namesWord(source, candidate)) {
      score += ACTIVATION_WHOLE_CANDIDATE_SCORE;
    }

    for (const token of candidate.split(' ').filter(value => wordCharacterCount(value) >= ACTIVATION_TOKEN_MIN_LENGTH)) {
      if (namesWord(source, token)) {
        score += 1;
      }
    }
  }

  return score;
}

/**
 * What each thread status is called where the reader and the model both see it.
 *
 * A total `Record` rather than the `if`/`if`/fall-through this replaces. The
 * note on `PlotThreadStatus` above named that ladder as the copy furthest from
 * the table — it answered three statuses and let the fourth take whichever
 * branch it fell into — and `story-state-vocabulary` held it together with an
 * assertion that `PLOT_THREAD_STATUSES.length === 4`, which is a test standing
 * in for a guarantee the language can make. Keyed by the union derived from the
 * table, a fifth status is a compile error in this object rather than a label
 * quietly chosen for it.
 *
 * `resolved` gets its own line rather than the fallback's. Both callers filter
 * resolved threads out before they reach here — `selectScoredCourtroomThreads`
 * in `continuationGuidance.ts` through `isUnresolvedThread`, and the Angular
 * continuity panel through `status !== 'resolved'` — so nothing renders it
 * today. That is exactly why it was worth naming: the fallback said *Open
 * promise*, so the one way this label could ever reach a reader or the model was
 * to announce a thread the story has already paid off as one it still owes.
 */
const THREAD_DEBT_LABELS: Record<PlotThreadStatus, string> = {
  active: 'Open promise',
  escalating: 'Pressure rising',
  dormant: 'Quiet promise',
  resolved: 'Paid promise'
};

/** What an unresolved thread is called where the reader and the model both see it. */
export function formatThreadDebtLabel(status: PlotThreadStatus): string {
  return THREAD_DEBT_LABELS[status];
}
