// Created: 2026-05-26 00:00 UTC
// Recreated from PR #31's cliffhanger analysis ideas for the Vercel api/_lib tree.

import { CliffhangerAnalysis, CliffhangerType } from '../types/contracts';
import { splitStoryIntoTextBlocks } from '../../../shared/storyTextBlocks';
import { collapseWhitespace } from '../utils/whitespace';
import { escapeRegExp } from '../utils/regexEscape';

/**
 * The hook words and phrases each kind of cliffhanger is recognised by, and the
 * forms of each one that count as it.
 *
 * These were bare lists matched with `String.prototype.includes`, and that is
 * the last substring scan in the repository — the same one
 * `extractThemesFromContent`, `extractSpicyLevelFromContent`,
 * `extractPlotThreads`, and `continuationGuidance`'s pressure scans were all
 * moved off, arriving here through the one door nobody had checked. The
 * collisions are the same kind, and the sharpest of them are the negations —
 * four of the six types could be credited by a word that denies the beat it
 * was counted for:
 *
 * - **`understood` is inside `misunderstood`.** Two people misunderstanding
 *   each other for a whole chapter is the premise of most of this genre, and
 *   it scored `character_revelation` — the type whose three suggestions tell
 *   the next batch to show how the truth changed a relationship.
 * - **`decision` is inside `indecision`**, so a chapter about a character who
 *   cannot choose scored `emotional_conflict`, whose first suggestion is
 *   "Force the character to choose".
 * - **`truth` is inside `untruth`**, and **`price` inside `priceless`** — the
 *   exact collision `PRESSURE_KEYWORD_FORMS` was fixed for a commit ago, on
 *   the same word.
 * - **`revealed` is inside `unrevealed`**, and **`realized` inside
 *   `unrealized`**.
 *
 * The rest are the ordinary kind: **`trapped` is inside `strapped`**, so a
 * character strapped into a chair scored `danger` (`trap` inside `strapped` is
 * again a collision the pressure scans already name); **`shadow` is inside
 * `overshadowed`**; **`secret` is inside `secretary`**, which
 * `extractPlotThreads` names too; **`question` is inside `questionable`**.
 *
 * What that decided is not internal. The winning type becomes
 * `cliffhangerType`, which selects the three `suggestedContinuations` the next
 * batch is prompted with, and `varietyScore`, which penalises a chapter for
 * repeating the type before it; the whole analysis travels back to the caller
 * as `cliffhangerAnalysis` on the continuation response, and
 * `cliffhangerDetected` becomes each chapter's `cliffhangerEnding`. A final
 * paragraph counts three times over — once in the whole-story scan and twice
 * more on its own — so one collision in the closing lines is worth three
 * points, more than any real hook in the rest of the chapter.
 *
 * So the hooks are spelled out as whole words, the same repair and the same
 * reading `containsWholeWord` in `storyContentAnalysis` and
 * `PRESSURE_KEYWORD_FORMS` in `continuationGuidance` already apply. Each entry
 * below is one hook and every spelling that counts as it, which is what keeps
 * the score comparable: a type's strength is how many of its *hooks* appear,
 * exactly as the substring scan counted one hit per needle, so a chapter
 * saying both `danger` and `dangerous` scores that hook once — the way it did
 * when `danger` was a substring of both — and listing inflections does not
 * quietly re-weight a hook against the ones with fewer spellings.
 *
 * The inflections the substring form picked up for free — `dangerous` for
 * `danger`, `threatening` for `threat`, `secretly` for `secret`, `questions`
 * for `question` — are listed rather than lost, and the other half of an
 * inflection the substring form could not see either way (`consequence` beside
 * `consequences`, `mysteries` beside `mystery`) is listed with them, the way
 * `PRESSURE_KEYWORD_FORMS` lists `chose` and `chosen` beside `choose`. What is
 * deliberately not carried over is the rest of what the substrings caught: the
 * collisions above are the defect, not coverage.
 */
const CLIFFHANGER_PATTERNS: Record<CliffhangerType, ReadonlyArray<readonly string[]>> = {
  romantic_tension: [
    ['pulled away', 'pulls away', 'pulling away'],
    ['hesitate', 'hesitated', 'hesitates', 'hesitating'],
    ['almost kissed'],
    ['unspoken desire', 'unspoken desires'],
    ['locked eyes'],
    ['breath caught'],
    ['heart raced', 'heart racing'],
    ['wanted him'],
    ['wanted her']
  ],
  plot_twist: [
    ['suddenly'],
    ['but then'],
    ['however'],
    ['unexpectedly'],
    ['reveal', 'reveals', 'revealed', 'revealing'],
    ['discover', 'discovers', 'discovered', 'discovering'],
    ['truth was'],
    ['it was not']
  ],
  danger: [
    ['footstep', 'footsteps'],
    ['shadow', 'shadows', 'shadowed', 'shadowy'],
    ['threat', 'threats', 'threaten', 'threatens', 'threatened', 'threatening'],
    ['danger', 'dangers', 'dangerous', 'dangerously'],
    ['hunt', 'hunts', 'hunted', 'hunting'],
    ['pursue', 'pursues', 'pursued', 'pursuing'],
    ['stalk', 'stalks', 'stalked', 'stalking'],
    ['trap', 'traps', 'trapped', 'trapping'],
    ['blood froze']
  ],
  mystery: [
    ['wonder', 'wonders', 'wondered', 'wondering'],
    ['question', 'questions', 'questioned', 'questioning'],
    ['secret', 'secrets', 'secretly'],
    ['mystery', 'mysteries'],
    ['hidden'],
    ['conceal', 'conceals', 'concealed', 'concealing'],
    ['truth', 'truths'],
    ['why had']
  ],
  character_revelation: [
    ['realize', 'realizes', 'realized', 'realizing'],
    ['understood'],
    ['dawned on'],
    ['recognition'],
    ['identity', 'identities'],
    ['true nature'],
    ['confession', 'confessions'],
    ['admission', 'admissions']
  ],
  emotional_conflict: [
    ['torn between'],
    ['conflicted'],
    ['struggle', 'struggles', 'struggled', 'struggling'],
    ['dilemma', 'dilemmas'],
    ['choice', 'choices'],
    ['decision', 'decisions'],
    ['consequence', 'consequences'],
    ['price', 'prices']
  ]
};

/**
 * One compiled alternation per hook, built once at module load.
 *
 * `analyze` runs twelve of these scans per chapter — six types against the
 * whole story and six against its final paragraph — and compiling a `RegExp`
 * per spelling per call would rebuild the same fixed set on every one of them.
 * The arrangement is `PRESSURE_KEYWORD_PATTERNS`'s in `continuationGuidance`,
 * for the same reason and against text the caller has already lowercased.
 *
 * `\b` at each end is what separates a hook from the longer word it sits
 * inside. The multi-word entries take it at the ends of the phrase rather than
 * around each word, which is what makes `blood froze` one hook and not two
 * independent hits — and the single space inside those phrases is why the
 * scanned text has its whitespace collapsed first: a phrase the generator
 * wrapped across a line inside one paragraph was invisible to a matcher looking
 * for one space, the same failure `extractPlotThreads`'s
 * `\bwhat\s+(if|would|could)\b` names.
 */
const CLIFFHANGER_HOOK_PATTERNS = new Map<CliffhangerType, RegExp[]>(
  (Object.entries(CLIFFHANGER_PATTERNS) as Array<[CliffhangerType, ReadonlyArray<readonly string[]>]>)
    .map(([type, hooks]) => [
      type,
      hooks.map(spellings => new RegExp(String.raw`\b(?:${spellings.map(escapeRegExp).join('|')})\b`))
    ])
);

/** How many of a type's hooks appear in `text`, counting each hook at most once. */
function countHookMatches(type: CliffhangerType, text: string): number {
  return (CLIFFHANGER_HOOK_PATTERNS.get(type) ?? []).filter(pattern => pattern.test(text)).length;
}

/**
 * The punctuation a chapter stops on when it stops on a hook. Anchored, because
 * a `?` or `!` in the middle of the closing paragraph is ordinary prose.
 */
const CLIFFHANGER_PUNCTUATION_PATTERN = /[?!]$/;

/**
 * Whether an analysis identified *which kind* of hook a chapter ends on.
 *
 * `cliffhangerType` cannot answer this on its own. The contract types it as a
 * member of the set rather than as an optional one, so a hook the scan found
 * but did not classify — a chapter closing on `!` that matches none of the
 * patterns — is spelled `plot_twist`, exactly like a chapter the scan really
 * did read as a twist.
 *
 * `suggestedContinuations` is what separates them, because `analyze` writes it
 * per type and emits it only where a type was identified. Naming that here is
 * what lets a caller feed `previousCliffhangers` without feeding the
 * placeholder back in and manufacturing the repetition penalty this service was
 * fixed for.
 */
export function hasIdentifiedCliffhangerType(analysis: CliffhangerAnalysis): boolean {
  return analysis.suggestedContinuations.length > 0;
}

export class CliffhangerService {
  analyze(content: string, previousCliffhangers: CliffhangerType[] = []): CliffhangerAnalysis {
    // The whole point of this scan is that the ending counts for more than the
    // middle, so the paragraphs have to be the ones a reader sees. Splitting on
    // `</p>` alone recognised no other boundary: a chapter whose paragraphs are
    // separated by `<br>`, `<div>`, or a heading collapsed into one block, and
    // "the final paragraph" became the entire chapter. Every pattern hit
    // anywhere in the story then scored as an ending hit, `cliffhangerText`
    // returned the whole chapter instead of the hook, and the trailing `?`
    // check read the story's very last character. Dropping the tags without
    // putting a boundary in their place also ran the neighbouring words
    // together, so `door.</p><p>Blood` was scanned as `door.Blood`.
    const paragraphs = splitStoryIntoTextBlocks(content);
    const lastParagraph = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';
    const trimmedLastParagraph = lastParagraph.trim();

    // The scanned copy, not the reported one: whitespace is collapsed *within*
    // each paragraph so a hook phrase the generator wrapped across a line is
    // still one space wide, and the paragraphs are still joined by a blank line
    // so a phrase cannot be assembled across the boundary between two of them.
    // `cliffhangerText` below keeps the paragraph as the reader sees it.
    const scannedParagraphs = paragraphs.map(collapseWhitespace);
    const lowerContent = scannedParagraphs.join('\n\n').toLowerCase();
    const lowerLastParagraph = (scannedParagraphs[scannedParagraphs.length - 1] ?? '').toLowerCase();

    let detectedType: CliffhangerType | null = null;
    let strength = 0;

    for (const type of Object.keys(CLIFFHANGER_PATTERNS) as CliffhangerType[]) {
      const wholeContentMatches = countHookMatches(type, lowerContent);
      const finalParagraphMatches = countHookMatches(type, lowerLastParagraph);
      const currentStrength = wholeContentMatches + finalParagraphMatches * 2;

      if (currentStrength > strength) {
        detectedType = type;
        strength = currentStrength;
      }
    }

    // The fallback and the detection line below are one judgement — "the chapter
    // stops on an unanswered beat" — and they have to read the same thing to be
    // that. This half asked whether a `?` appeared anywhere in the final
    // paragraph, so a chapter whose last paragraph merely contains a question
    // and then answers it — `Did she stay? She stayed, and the night was warm.`
    // — was reported as a detected `mystery` hook of strength 2 while nothing
    // about it ends on a question. (An example carrying one of the patterns
    // above would not show this: those are matched before the fallback is
    // reached.) The strength then feeds the variety score and the continuation
    // suggestions, so the next batch was prompted to resolve a cliffhanger the
    // chapter never raised. Anchoring the fallback to the end of the paragraph,
    // which is where a hook lands, makes both halves agree.
    if (detectedType === null && trimmedLastParagraph.endsWith('?')) {
      detectedType = 'mystery';
      strength = 2;
    }

    const cliffhangerType = detectedType ?? 'plot_twist';
    const cliffhangerDetected = detectedType !== null || CLIFFHANGER_PUNCTUATION_PATTERN.test(trimmedLastParagraph);

    // `cliffhangerType` is a placeholder whenever `detectedType` is null — the
    // contract types it as a `CliffhangerType` rather than as an optional one,
    // so "the scan did not classify this" still has to be spelled as some
    // member of the set, and `plot_twist` is the one it falls to. Every other
    // field already knows that and reports nothing: strength is floored at 0
    // and `cliffhangerText` is empty. These two did not, and they are the two
    // the caller acts on.
    //
    // `suggestedContinuations` handed back three instructions written for a
    // twist — "Reveal the first consequence of the twist", "Show characters
    // adapting to the new reality" — for a chapter the scan had never called a
    // twist. `varietyScore` was worse than merely wrong: it asked whether the
    // placeholder appeared in `previousCliffhangers`, so a chapter scored 3 out
    // of 8 for repetition whenever the chapter before it genuinely was a
    // `plot_twist` — a sameness penalty for a hook that does not exist, which
    // is the opposite of what a variety score is for. The whole analysis
    // travels back to the caller as `cliffhangerAnalysis` on the continuation
    // response, so both were public answers about a hook the service had not
    // classified.
    //
    // Both are keyed on `detectedType` rather than on `cliffhangerDetected`,
    // which is the wider of the two conditions and let the placeholder through
    // for every chapter that merely *ends* on a hook. The `?` half of that was
    // already closed, because the fallback below assigns `mystery` and a
    // detected type follows; the `!` half was not, and `!` is the other mark
    // `CLIFFHANGER_PUNCTUATION_PATTERN` accepts. So `She ran!` — a real hook,
    // matching none of the patterns — was still reported as a plot twist with
    // three twist instructions attached, and still lost five points of variety
    // to a preceding chapter that actually was one. Detecting *that* a chapter
    // stops on a hook and detecting *which kind* are two different findings,
    // and only the second one can key a per-type answer.
    return {
      cliffhangerDetected,
      cliffhangerType,
      cliffhangerStrength: Math.min(10, Math.max(cliffhangerDetected ? 1 : 0, strength)),
      cliffhangerText: cliffhangerDetected ? lastParagraph : '',
      suggestedContinuations: detectedType === null
        ? []
        : this.generateContinuationSuggestions(detectedType),
      varietyScore: detectedType !== null && previousCliffhangers.includes(detectedType) ? 3 : 8
    };
  }

  private generateContinuationSuggestions(cliffhangerType: CliffhangerType): string[] {
    const suggestions: Record<CliffhangerType, string[]> = {
      romantic_tension: [
        'Resolve or complicate the interrupted intimate moment',
        'Force the characters to name what they are avoiding',
        'Introduce a cost for giving in to desire'
      ],
      plot_twist: [
        'Reveal the first consequence of the twist',
        'Show characters adapting to the new reality',
        'Use the twist to expose a hidden motive'
      ],
      danger: [
        'Escalate the immediate threat',
        'Reveal who or what is behind the danger',
        'Force a survival choice with emotional cost'
      ],
      mystery: [
        'Answer one clue while opening a sharper question',
        'Let investigation deepen romantic or moral tension',
        'Expose a secret that changes the reader interpretation'
      ],
      character_revelation: [
        'Show how the truth changes a relationship',
        'Make the revealed character act under pressure',
        'Tie the revelation to an old wound or desire'
      ],
      emotional_conflict: [
        'Force the character to choose',
        'Make the choice affect intimacy and plot',
        'Let the avoided consequence arrive'
      ]
    };

    return suggestions[cliffhangerType];
  }
}
