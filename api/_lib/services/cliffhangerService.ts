// Created: 2026-05-26 00:00 UTC
// Recreated from PR #31's cliffhanger analysis ideas for the Vercel api/_lib tree.

import { CliffhangerAnalysis, CliffhangerType } from '../types/contracts';
import { splitStoryIntoTextBlocks } from '../utils/storyTextBlocks';

const CLIFFHANGER_PATTERNS: Record<CliffhangerType, string[]> = {
  romantic_tension: [
    'pulled away',
    'hesitated',
    'almost kissed',
    'unspoken desire',
    'locked eyes',
    'breath caught',
    'heart raced',
    'wanted him',
    'wanted her'
  ],
  plot_twist: [
    'suddenly',
    'but then',
    'however',
    'unexpectedly',
    'revealed',
    'discovered',
    'truth was',
    'it was not'
  ],
  danger: [
    'footsteps',
    'shadow',
    'threat',
    'danger',
    'hunted',
    'pursued',
    'stalked',
    'trapped',
    'blood froze'
  ],
  mystery: [
    'wondered',
    'question',
    'secret',
    'mystery',
    'hidden',
    'concealed',
    'truth',
    'why had'
  ],
  character_revelation: [
    'realized',
    'understood',
    'dawned on',
    'recognition',
    'identity',
    'true nature',
    'confession',
    'admission'
  ],
  emotional_conflict: [
    'torn between',
    'conflicted',
    'struggled',
    'dilemma',
    'choice',
    'decision',
    'consequences',
    'price'
  ]
};

/**
 * The punctuation a chapter stops on when it stops on a hook. Anchored, because
 * a `?` or `!` in the middle of the closing paragraph is ordinary prose.
 */
const CLIFFHANGER_PUNCTUATION_PATTERN = /[?!]$/;

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
    const lowerContent = paragraphs.join('\n\n').toLowerCase();
    const lastParagraph = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : '';
    const trimmedLastParagraph = lastParagraph.trim();
    const lowerLastParagraph = lastParagraph.toLowerCase();

    let detectedType: CliffhangerType | null = null;
    let strength = 0;

    for (const [type, patterns] of Object.entries(CLIFFHANGER_PATTERNS) as Array<[CliffhangerType, string[]]>) {
      const wholeContentMatches = patterns.filter(pattern => lowerContent.includes(pattern)).length;
      const finalParagraphMatches = patterns.filter(pattern => lowerLastParagraph.includes(pattern)).length;
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

    // `cliffhangerType` is a placeholder when nothing was found — the contract
    // types it as a `CliffhangerType` rather than as an optional one, so
    // "no hook" still has to be spelled as some member of the set, and
    // `plot_twist` is the one it falls to. Every other field already knows that
    // and reports nothing: strength is floored at 0 and `cliffhangerText` is
    // empty. These two did not, and they are the two the caller acts on.
    //
    // `suggestedContinuations` handed back three instructions written for a
    // twist — "Reveal the first consequence of the twist", "Show characters
    // adapting to the new reality" — for a chapter the scan had just said ends
    // on no hook at all. `varietyScore` was worse than merely wrong: it asked
    // whether the placeholder appeared in `previousCliffhangers`, so a chapter
    // with no cliffhanger scored 3 out of 8 for repetition whenever the chapter
    // before it genuinely was a `plot_twist` — a sameness penalty for a hook
    // that does not exist, which is the opposite of what a variety score is
    // for. The whole analysis travels back to the caller as
    // `cliffhangerAnalysis` on the continuation response, so both were public
    // answers about a hook the service had not found.
    return {
      cliffhangerDetected,
      cliffhangerType,
      cliffhangerStrength: Math.min(10, Math.max(cliffhangerDetected ? 1 : 0, strength)),
      cliffhangerText: cliffhangerDetected ? lastParagraph : '',
      suggestedContinuations: cliffhangerDetected
        ? this.generateContinuationSuggestions(cliffhangerType)
        : [],
      varietyScore: cliffhangerDetected && previousCliffhangers.includes(cliffhangerType) ? 3 : 8
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
