// Created: 2026-08-27 00:32 UTC
//
// Pure, state-free content-analysis and formatting helpers extracted out of
// `StoryService`. Each function here is a plain transformation of a string
// (and, where noted, a couple of primitives) with no dependency on an AI
// client, the cliffhanger service, or any other collaborator `StoryService`
// wires into its constructor — which is exactly what let the bugs fixed in
// #258/#259/#261 hide for as long as they did, and what forced the tests for
// them to reach into `StoryService`'s private methods via `as any` casts
// instead of calling the logic directly.

import { SpicyLevel, ThemeType } from '../types/contracts';
import { readCreatureDisplayName } from '../../../shared/creatureVocabulary';
import { readSpiceLevelPromptLabel } from '../../../shared/spiceLevelPromptLadder';
import { splitStoryIntoTextBlocks, stripStoryHtmlToText } from '../../../shared/storyTextBlocks';
import { capAtWordBoundary, tailAtWordBoundary } from '../utils/textExcerpt';
import { wholeWordAlternationPattern, wholeWordPattern } from '../utils/wholeWord';

/** The longest `nextChapterHint`, in code points. */
export const NEXT_CHAPTER_HINT_MAX_LENGTH = 200;

/** How much of the closing passage a continuation prompt is shown as "what just happened", in words. */
export const SUMMARY_WORD_LIMIT = 150;

/**
 * Reduce story markup to the text a reader sees.
 *
 * Deleting the tags and nothing else closed the gap they held open, so the
 * last word of one paragraph and the first word of the next were read as one
 * token: `<p>She opened the door.</p><p>Blood pooled…</p>` became
 * `door.Blood`. Every caller here is looking for something the reader can
 * point at — a chapter title, a summary of what just happened, the sentence a
 * continuation has to follow on from — and each of them was handed welded
 * text instead. Sentence splitting suffered worst: with no space after the
 * full stop there was nothing for `/(?<=[.!?])\s+/` to split on, so the whole
 * chapter came back as its own final sentence.
 */
export function stripHtml(content: string): string {
  return stripStoryHtmlToText(content);
}

/**
 * Count the words a reader would count.
 *
 * The count is reported to the client as `actualWordCount` and drives the
 * streaming progress percentage, so it has to match the rendered story rather
 * than the markup. Stripping tags in place merged the words on either side of
 * every paragraph break into one, which cost one word per boundary — a
 * chapter of forty `<p>` elements with no whitespace between them reported
 * thirty-nine fewer words than it has, and `<p>one</p><p>two</p>` reported a
 * single word.
 */
export function countWords(content: string): number {
  return stripStoryHtmlToText(content).split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract character names from story content
 */
export function extractCharacterNames(content: string): string[] {
  const speakerMatches = content.match(/\[([^\],]+)(?:,\s*[^\]]+)?\]:/g) || [];
  const names = speakerMatches
    .map(match => match.replace(/\[([^\],]+).*/, '$1').trim())
    .filter(name => name !== 'Narrator');

  // Deduplicate and return
  return [...new Set(names)];
}

/**
 * Extract summary of last chapter/section
 */
export function extractLastChapterSummary(content: string): string {
  // Stories arrive as generator HTML, where a paragraph is a `<p>` element
  // rather than a run of text between blank lines. Splitting the stripped
  // text on blank lines therefore found exactly one paragraph — the whole
  // story — and "the last three paragraphs, truncated to 150 words" became
  // "the story's opening 150 words". That summary is what the continuation
  // prompt is told just happened, so a chapter continued from the beginning.
  const paragraphs = splitStoryIntoTextBlocks(content);

  if (paragraphs.length === 0) return 'Story beginning';

  // Get last 2-3 paragraphs as summary
  const lastParagraphs = paragraphs.slice(-3).join(' ');

  // Truncate to ~150 words
  const words = lastParagraphs.split(/\s+/);
  const summary = words.slice(0, SUMMARY_WORD_LIMIT).join(' ');

  // Whether the cut happened is a question about the words, not about the
  // lengths of two strings. Joining on single spaces is itself shortening —
  // any line break or double space inside the paragraphs comes back as one
  // character — so comparing lengths reported a truncation for a summary that
  // holds the whole passage. The marker is what tells the continuation prompt
  // that the chapter it is being handed stops mid-thought, and the model is
  // then prompted to resume from a sentence that had in fact already ended.
  return words.length > SUMMARY_WORD_LIMIT ? summary + '...' : summary;
}

/**
 * The open question this scan reads as a thread the chapter left standing.
 *
 * Built through `wholeWordPattern` like the plain keywords beside it rather
 * than carrying its own `\b`, so the phrase asks the same boundary question
 * they do — see `WORD_CHARACTERS` for what `\b` was answering wrong. `\s+`
 * because the two words are separated by whatever whitespace the generator
 * wrote, and the group is non-capturing because nothing reads the match.
 */
const UNRESOLVED_QUESTION_PATTERN = wholeWordPattern(String.raw`what\s+(?:if|would|could)`);

/**
 * The threads this scan can report, and the words that put one on the list.
 *
 * The keywords were five `if`s over a `mentions(...)` helper that asked
 * `containsWholeWord` one word at a time, and `containsWholeWord` compiles a
 * `RegExp` per call — so the whole table was rebuilt as twenty-three patterns
 * on every chapter this scan reads. `wholeWordAlternationPattern` exists to be
 * "compiled once per table by the callers that scan repeatedly, never per
 * call", which is what `CLIFFHANGER_HOOK_PATTERNS` and
 * `PRESSURE_KEYWORD_PATTERNS` already do with it; this file was one of the two
 * that still asked per keyword. The boundary the alternation puts at its ends
 * is the boundary each keyword carried on its own, so what a chapter matches is
 * unchanged.
 *
 * `UNRESOLVED_QUESTION_PATTERN` joins the table rather than staying a fifth
 * `if` below it: it was already a compiled pattern, and it is one more signal
 * with one more thread behind it.
 */
const PLOT_THREAD_SIGNALS: ReadonlyArray<{ thread: string; pattern: RegExp }> = [
  {
    thread: 'Unresolved mystery or secret',
    pattern: wholeWordAlternationPattern(['secret', 'secrets', 'secretly', 'mystery'])
  },
  {
    thread: 'Active threat or danger',
    pattern: wholeWordAlternationPattern([
      'danger', 'dangers', 'dangerous', 'dangerously',
      'threat', 'threats', 'threaten', 'threatens', 'threatened', 'threatening'
    ])
  },
  {
    thread: 'Forbidden relationship tension',
    pattern: wholeWordAlternationPattern(['forbidden', 'impossible'])
  },
  {
    thread: 'Power dynamics in play',
    pattern: wholeWordAlternationPattern([
      'power', 'powers', 'powerful', 'control', 'controls', 'controlled', 'controlling'
    ])
  },
  { thread: 'Unresolved questions', pattern: UNRESOLVED_QUESTION_PATTERN }
];

/**
 * Report the threads a continuation has to carry forward.
 *
 * The result is interpolated into the continuation prompt as
 * `Active Plot Threads`, so what this finds is what the next chapter is told is
 * still open. It was the last scan in this module reading the markup and
 * matching substrings, and both of its siblings above and below have already
 * been moved off both:
 *
 * - **It scanned the markup.** `extractThemesFromContent` and
 *   `extractSpicyLevelFromContent` read `stripHtml(content)` first, so that what
 *   is measured is what the reader sees. Here the cost falls on the one
 *   multi-word pattern: `\bwhat\s+(if|would|could)\b` needs whitespace between
 *   the two words, and a chapter that breaks its paragraph between them —
 *   `what</p><p>if she was lying` — has markup there instead, so the question
 *   the scan exists to notice was invisible whenever the model put it across a
 *   paragraph break.
 * - **It matched substrings.** `secret` is inside `secretary`, `power` inside
 *   `powerless`, and `control` inside `uncontrollable` — and the last of the
 *   five checks, on the same lines, already used `\b`. Whole-word matching is
 *   what makes the other four agree with it, and with the two scans beside them
 *   that were repaired for the same reason.
 *
 * The inflections the substring form picked up for free — `secrets` for
 * `secret`, `dangerous` for `danger`, `threatening` for `threat`, `powerful`
 * for `power`, `controlled` for `control` — are listed rather than lost.
 */
export function extractPlotThreads(content: string): string[] {
  const lowerContent = stripHtml(content).toLowerCase();
  const threads = PLOT_THREAD_SIGNALS
    .filter(signal => signal.pattern.test(lowerContent))
    .map(signal => signal.thread);

  return threads.length > 0 ? threads : ['Character development', 'Relationship progression'];
}

/**
 * The registers this scan can name, and the words that put a chapter in each.
 *
 * A fixed lexicon written beside its own matcher, so — as the story-quality
 * heuristics' `EMOTION_FAMILIES` puts it — every inflection it accepts has to
 * be listed. That is the half of the whole-word repair this scan never got.
 * `dominan` was fixed by spelling out `dominant`, `dominance`, and
 * `dominated`; the other four families kept their bare stems, and a bare stem
 * under `\b…\b` matches only the present-tense dictionary form of the word.
 *
 * Narrative prose is written in the past tense. `smile` does not match
 * "he smiled", `laugh` does not match "she laughed", `desire` does not match
 * "he desired her", `want` does not match "she wanted him", `wound` does not
 * match "the wound had scarred", `danger` does not match "dangerous", and
 * `power` does not match "powerful" — so the tones this function exists to
 * report were unreachable for the way the generator actually writes, and the
 * scan fell through to `romantic with building tension` for chapter after
 * chapter. That string is not cosmetic: `buildContinuationPrompt` writes it
 * into the model's context as `Emotional Tone`, so a chapter of wounds and
 * threats was described to the model as mild romance and continued from there.
 *
 * The stems are unchanged and nothing is added to them; what is written out
 * is the inflections the stems were already meant to stand for, the same way
 * `extractPlotThreads` above lists `dangers`/`dangerous`/`dangerously` and
 * `extractSpicyLevelFromContent` below lists `kissed` for `kiss`.
 */
const EMOTIONAL_TONE_FAMILIES: ReadonlyArray<{ tone: string; terms: readonly string[] }> = [
  {
    tone: 'passionate',
    terms: [
      'desire', 'desired', 'desires', 'desiring',
      'passion', 'passionate', 'passionately', 'passions',
      'want', 'wanted', 'wanting', 'wants',
      'need', 'needed', 'needing', 'needs',
      'crave', 'craved', 'craves', 'craving'
    ]
  },
  {
    tone: 'dark/suspenseful',
    terms: [
      'dark', 'darker', 'darkness',
      'shadow', 'shadowed', 'shadows', 'shadowy',
      'danger', 'dangerous', 'dangerously', 'dangers',
      'fear', 'feared', 'fearful', 'fearing', 'fears',
      'threat', 'threaten', 'threatened', 'threatening', 'threatens', 'threats'
    ]
  },
  {
    tone: 'playful',
    terms: [
      'tease', 'teased', 'teases', 'teasing',
      'playful', 'playfully',
      'smile', 'smiled', 'smiles', 'smiling',
      'grin', 'grinned', 'grinning', 'grins',
      'laugh', 'laughed', 'laughing', 'laughs', 'laughter'
    ]
  },
  {
    tone: 'angsty',
    terms: [
      'pain', 'pained', 'painful', 'pains',
      'ache', 'ached', 'aches', 'aching',
      'hurt', 'hurting', 'hurts',
      'wound', 'wounded', 'wounding', 'wounds',
      'scar', 'scarred', 'scarring', 'scars'
    ]
  },
  {
    tone: 'intense',
    terms: [
      'power', 'powerful', 'powers',
      'control', 'controlled', 'controlling', 'controls',
      'dominance', 'dominant', 'dominated', 'dominating',
      'command', 'commanded', 'commanding', 'commands'
    ]
  }
];

/**
 * Analyze emotional tone of existing content.
 *
 * The scan reads the rendered text rather than the markup, like every other
 * scanner in this file. This one was the last that did not: it lowercased the
 * generator's HTML and matched against that, so a word the model split across
 * an inline tag — `dan<em>ger</em>ous` — was two fragments rather than the
 * word, and the entities the generator writes (`&amp;`, `&nbsp;`) sat in the
 * text undecoded where `stripStoryHtmlToText` would have turned them back into
 * the characters the reader sees. `extractSpicyLevelFromContent` below names
 * the same defect and the same repair; this is the sibling it was still true
 * of.
 *
 * See `EMOTIONAL_TONE_FAMILIES` for the other half — the inflections a
 * whole-word match needs spelled out, without which none of these tones could
 * be reported for prose written in the past tense.
 */
/**
 * One pattern per register, compiled with the table rather than per term on
 * every scan. See `PLOT_THREAD_SIGNALS` for what the per-term form was costing:
 * these five families hold ninety-four terms between them, and each was a
 * `RegExp` built and thrown away for every chapter read.
 */
const EMOTIONAL_TONE_PATTERNS: ReadonlyArray<{ tone: string; pattern: RegExp }> =
  EMOTIONAL_TONE_FAMILIES.map(family => ({
    tone: family.tone,
    pattern: wholeWordAlternationPattern(family.terms)
  }));

export function analyzeEmotionalTone(content: string): string {
  const lowerContent = stripHtml(content).toLowerCase();
  const tones = EMOTIONAL_TONE_PATTERNS
    .filter(family => family.pattern.test(lowerContent))
    .map(family => family.tone);

  return tones.length > 0 ? tones.join(', ') : 'romantic with building tension';
}

export function extractChapterTitleAndBody(content: string, chapterNumber: number): { title: string; body: string } {
  const headingMatch = content.match(/<h3[^>]*>(.*?)<\/h3>/i);
  let title = headingMatch ? stripHtml(headingMatch[1]).trim() : '';

  if (title.toLowerCase().startsWith(`chapter ${chapterNumber}`)) {
    title = title.slice(`chapter ${chapterNumber}`.length).replace(/^\s*:?/, '').trim();
  }

  if (!title) {
    title = `Untitled Chapter ${chapterNumber}`;
  }

  const body = headingMatch ? content.replace(headingMatch[0], '').trim() : content.trim();

  return { title, body };
}

/**
 * The last sentence of a chapter, as the hint for what comes next.
 *
 * Measured and cut in code points. `candidate.slice(0, 197)` counted UTF-16
 * code units, so a hint whose 197th unit fell between the halves of a
 * surrogate pair ended on a lone surrogate — and the story this app writes is
 * one whose prose carries the occasional astral character. The cut also landed
 * mid-word wherever it landed, which is what `capAtWordBoundary` is for.
 */
export function generateNextChapterHint(content: string): string {
  const text = stripHtml(content).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const candidate = (sentences[sentences.length - 1] || text).trim();

  return Array.from(candidate).length > NEXT_CHAPTER_HINT_MAX_LENGTH
    ? `${capAtWordBoundary(candidate, NEXT_CHAPTER_HINT_MAX_LENGTH - 3)}...`
    : candidate;
}

/**
 * The tail of everything written so far, shown to the model as
 * `PREVIOUS CHAPTER EXCERPT` when it continues the story.
 *
 * `text.slice(-maxLength)` cut at the front, in code units, so the excerpt
 * could begin on the second half of a surrogate pair — and began mid-word
 * whatever it began on, which is the first thing the model reads.
 */
export function createContextExcerpt(html: string, maxLength: number = 1200): string {
  const text = stripHtml(html || '').replace(/\s+/g, ' ').trim();

  return tailAtWordBoundary(text, maxLength);
}

/**
 * Name the creature to the model, as `PROTAGONIST: …`.
 *
 * The ten-entry map this used to hold is now `shared/creatureVocabulary`, which
 * the request validator and the Proving Grounds preview of this same prompt
 * slot also read. Behaviour is unchanged, `'Creature'` fallback included.
 */
export function getCreatureDisplayName(creature: string): string {
  return readCreatureDisplayName(creature);
}

/**
 * Name the spice level to the model, as `SPICE LEVEL: … (Level n/5)`.
 *
 * The five labels are now `shared/spiceLevelPromptLadder`, beside the
 * system-prompt block that defines what each of them permits — and read by the
 * Proving Grounds, whose own copy named all five levels something else. See
 * that module.
 */
export function getSpicyLabel(level: number): string {
  return readSpiceLevelPromptLabel(level);
}


/**
 * Report which of the reader's themes the new chapters carried on.
 *
 * The result is returned to the caller as `themesContinued`, which the
 * contract types as `ThemeType[]` — the same closed set of eighteen ids the
 * form offers and `VALIDATION_RULES.themes.allowedValues` lists. Two things
 * kept it from being one:
 *
 * - When nothing matched, the answer was `['romance', 'fantasy']`. Neither is
 *   a theme: no chapter can be generated with either, no theme picker can
 *   render either, and a caller mapping the ids back to labels gets nothing
 *   for both. It is also not the honest answer — "no configured theme was
 *   detected" is — and because a scan this coarse usually matches something,
 *   the case it fired in was the one where the scan had found nothing to say.
 * - Six of the eighteen themes had no keywords at all, so `dominance`,
 *   `submission`, `temptation`, `sin`, `lust`, and `deceit` could never be
 *   reported however plainly a chapter carried them: a scene naming all six
 *   came back as `power_dynamics, desire`. `lust` was worse than absent — it
 *   sat in `desire`'s keyword list, so the word was credited to a theme the
 *   reader may not have chosen while its own theme stayed unreachable.
 *
 * Keying the table by `ThemeType` is what stops the second from returning: a
 * theme added to the contract without keywords here is now a compile error
 * rather than a silent blind spot. The declared return type does the same for
 * the first.
 *
 * The scan reads the rendered text rather than the markup, like every other
 * scanner here — the multi-word keywords (`secret love`, `star-crossed`,
 * `false promise`) are the ones a welded `door.</p><p>Blood` boundary hides.
 *
 * Keywords are matched as whole words rather than as substrings, which is
 * what makes the six new entries safe to state plainly: `sin` as a substring
 * is in `rising`, `using`, and `singing`, and `lust` is in `lustre`, so under
 * the old matching the only way to add those themes would have been to spell
 * them as something other than their own names. The inflections the substring
 * form used to pick up for free — `secrets` for `secret`, `powerful` for
 * `power` — are listed instead. `used` is gone from `manipulation`: an
 * ordinary "she used the key" is not a story about being used, and it was the
 * loosest keyword in the table.
 */
// Ordered as `VALIDATION_RULES.themes.allowedValues` orders them, so the same
// chapter always reports the same list in the same order.
//
// At module scope, and compiled to one pattern per theme, rather than rebuilt
// inside the scan: this record of eighteen themes and ninety-eight keywords was
// a function-local literal, so both the table and a `RegExp` for every keyword
// in it were constructed again for every chapter this function reads — on a
// path that reads every chapter of every continuation. See `PLOT_THREAD_SIGNALS`
// for the reading, which is unchanged.
const THEME_KEYWORDS: Record<ThemeType, readonly string[]> = {
  betrayal: ['betrayed', 'betrayal', 'deceived', 'backstabbed', 'treachery', 'double-crossed'],
  obsession: ['obsessed', 'obsession', 'possessed', 'consumed', 'fixated', 'addicted'],
  power_dynamics: ['power', 'powers', 'powerful', 'control', 'authority', 'command', 'leverage'],
  forbidden_love: ['forbidden', 'secret love', 'star-crossed', 'illicit', 'taboo'],
  revenge: ['revenge', 'vengeance', 'retribution', 'payback', 'avenge', 'avenged'],
  manipulation: ['manipulated', 'manipulation', 'controlled', 'exploited', 'influenced'],
  seduction: ['seduced', 'seduction', 'allured', 'enticed', 'charmed', 'coaxed'],
  dark_secrets: ['secret', 'secrets', 'hidden', 'mysterious', 'concealed', 'buried'],
  corruption: ['corrupted', 'corruption', 'tainted', 'fallen', 'darkness', 'evil'],
  dominance: ['dominance', 'dominant', 'dominated', 'dominion', 'mastery'],
  submission: ['submission', 'submitted', 'submissive', 'yielded', 'knelt', 'obeyed'],
  jealousy: ['jealous', 'jealousy', 'envious', 'possessive', 'resentful', 'covetous'],
  temptation: ['tempted', 'temptation', 'tempting', 'lured', 'beckoned'],
  sin: ['sin', 'sins', 'sinful', 'sinner', 'damnation', 'damned', 'penance'],
  desire: ['desire', 'desires', 'yearning', 'craving', 'longing', 'wanting'],
  passion: ['passionate', 'passion', 'intense', 'burning', 'fiery', 'ardent'],
  lust: ['lust', 'lustful', 'lusted', 'carnal', 'ravenous'],
  deceit: ['deceit', 'deceitful', 'lied', 'lying', 'false promise']
};

const THEME_PATTERNS: ReadonlyArray<[ThemeType, RegExp]> =
  (Object.entries(THEME_KEYWORDS) as Array<[ThemeType, readonly string[]]>)
    .map(([theme, keywords]) => [theme, wholeWordAlternationPattern(keywords)]);

export function extractThemesFromContent(content: string): ThemeType[] {
  const lowerContent = stripHtml(content).toLowerCase();

  return THEME_PATTERNS
    .filter(([, pattern]) => pattern.test(lowerContent))
    .map(([theme]) => theme);
}

/**
 * The spice level a batch of chapters actually reads at.
 *
 * The answer travels: it is `spicyLevelMaintained` on the continuation
 * response, and `buildContinuationPayload` writes it into a new story's
 * `StorySummary.spicyLevel` — the level the project is then stored and
 * reopened under. So a misread here is not a cosmetic number beside the
 * prose; it is what the library says the story is.
 *
 * Its sibling `extractThemesFromContent` directly above scans the rendered
 * text with whole-word matching. This one did neither, and the two failures
 * compound:
 *
 * - **It scanned the markup.** Every other scanner here — the cliffhanger
 *   service, the image service, the continuity extractor, the story-quality
 *   heuristics, and `extractThemesFromContent` beside it — reads
 *   `stripStoryHtmlToText` first, so that what is measured is what the
 *   reader sees: block tags become paragraph breaks and the entities the
 *   generator writes are decoded. Undecoded, `intense&nbsp;passion` is not
 *   the phrase `intense passion` at all, and the one multi-word keyword the
 *   scan has matched nothing whenever the model spaced it that way.
 * - **It matched substrings.** `heart` is inside `hearth`, `love` inside
 *   `glove` and `clover`, `touch` inside `untouched`, `heat` inside
 *   `sheath` and `wheat`, and `climax` inside `anticlimax` — so a chaste
 *   scene at a hearth in wool gloves was filed as level 2, a chapter that
 *   ends `he left her untouched` as level 3, and one that calls a duel an
 *   anticlimax as level 5, the maximum, on the strength of a word that says
 *   the opposite. The story then reopens at that level, and the reader who
 *   set the dial themselves is the one contradicted.
 *
 * Keywords are matched as whole words for the same reason
 * `extractThemesFromContent` was changed to: it is the only way to state
 * `heat` or `love` as itself. The inflections the substring form picked up
 * for free — `kissed` for `kiss`, `caressing` for `caress`, `desired` for
 * `desire` — are listed instead, so the repair does not quietly cost the
 * scan the matches it did get right. What it does not carry over is the rest
 * of what the substrings caught: `lovely` is not `love`, `gentleman` is not
 * `gentle`, and `hearth` is not `heart`. Those are the defect, not coverage.
 */
/**
 * The ladder this scan reads, hottest rung first, compiled once.
 *
 * Four `const` arrays inside the function and a `RegExp` per keyword per call,
 * for the reason `PLOT_THREAD_SIGNALS` and `THEME_KEYWORDS` give — this is the
 * fourth and last scan in the file that was rebuilding its table on every
 * chapter, and the largest, at fifty-three keywords. The rungs are read in
 * order and the first that matches wins, which is what the fall-through chain
 * of `if`s did.
 *
 * The `level` is typed from `SpicyLevel` rather than cast to it at each
 * `return`, which is what the four `as SpicyLevel` assertions this replaces
 * were for: a bare numeric literal has no relationship to the scale, so the
 * only way to hand one back under that type was to assert it. Named in a table
 * whose entries the compiler checks, `6` is a type error here rather than an
 * assertion nobody would question.
 */
const SPICE_LEVEL_KEYWORD_PATTERNS: ReadonlyArray<{ level: SpicyLevel; pattern: RegExp }> = [
  {
    // Level 5 - Very Explicit
    level: 5,
    pattern: wholeWordAlternationPattern([
      'explicit', 'explicitly', 'graphic', 'graphically', 'intense passion',
      'climax', 'climaxed', 'climaxes', 'ecstasy'
    ])
  },
  {
    // Level 4 - Passionate
    level: 4,
    pattern: wholeWordAlternationPattern([
      'passionate', 'passionately', 'breathless', 'breathlessly',
      'desire', 'desires', 'desired', 'yearning', 'heat', 'heated'
    ])
  },
  {
    // Level 3 - Romantic with Heat
    level: 3,
    pattern: wholeWordAlternationPattern([
      'kiss', 'kissed', 'kisses', 'kissing',
      'embrace', 'embraced', 'embraces', 'embracing',
      'caress', 'caressed', 'caresses', 'caressing',
      'touch', 'touched', 'touches', 'touching',
      'intimate', 'intimately'
    ])
  },
  {
    // Level 2 - Sweet Romance
    level: 2,
    pattern: wholeWordAlternationPattern([
      'love', 'loved', 'loves', 'lover', 'lovers', 'loving',
      'affection', 'affections', 'affectionate',
      'tender', 'tenderly', 'tenderness',
      'gentle', 'gently', 'heart', 'hearts'
    ])
  }
];

/** Level 1 - Mild: what a chapter matching no rung above reads at. */
const MILDEST_DETECTED_SPICY_LEVEL: SpicyLevel = 1;

export function extractSpicyLevelFromContent(content: string): SpicyLevel {
  const lowerContent = stripHtml(content).toLowerCase();

  return SPICE_LEVEL_KEYWORD_PATTERNS.find(rung => rung.pattern.test(lowerContent))?.level
    ?? MILDEST_DETECTED_SPICY_LEVEL;
}

export function formatStoryContent(content: string): string {
  // Enhanced formatting for better readability
  let formatted = content;

  // If no HTML formatting exists, apply smart formatting
  if (!content.includes('<h3>') && !content.includes('<p>')) {
    // Extract title if present (first line typically).
    //
    // Only the blank lines *before* the title are dropped. Dropping all of
    // them — `split('\n').filter(line => line.trim())` — took out the very
    // separators the paragraph split below looks for, so rejoining the
    // remainder produced a body with no blank line left anywhere in it and
    // `split('\n\n')` returned the whole story as one block. Every paragraph
    // the model wrote was then welded into a single `<p>`, and only for a
    // story that opens with a title line: the same story without one kept its
    // paragraphs, because that branch never touched the lines. This is the
    // path a plain-text answer from the provider takes on its way to the
    // reader, so what the reader saw was the chapter as one unbroken wall.
    const lines = content.split('\n');
    const titleIndex = lines.findIndex(line => line.trim());
    const firstLine = titleIndex === -1 ? undefined : lines[titleIndex]?.trim();

    // Check if first line looks like a title (short, no punctuation except colon)
    const isTitle = firstLine && firstLine.length < 80 && !firstLine.endsWith('.') && !firstLine.startsWith('[');

    if (isTitle) {
      formatted = `<h3>${firstLine}</h3>\n\n` + lines.slice(titleIndex + 1).join('\n');
    }

    // Split into paragraphs based on multiple newlines or speaker changes
    formatted = formatted
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .split('\n\n')
      .filter(para => para.trim())
      .map(para => para.trim())
      .map(para => {
        // Skip if already has HTML tags
        if (para.includes('<')) return para;

        // Wrap in paragraph tags
        return `<p>${para}</p>`;
      })
      .join('\n\n');
  }

  return formatted;
}

export function formatChapterContent(content: string): string {
  // Enhanced chapter formatting to match story formatting
  let formatted = content;

  // If no HTML formatting exists, apply smart formatting
  if (!content.includes('<h3>') && !content.includes('<p>')) {
    // Split into paragraphs based on multiple newlines
    formatted = formatted
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .split('\n\n')
      .filter(para => para.trim())
      .map(para => para.trim())
      .map(para => {
        // Skip if already has HTML tags
        if (para.includes('<')) return para;

        // Wrap in paragraph tags
        return `<p>${para}</p>`;
      })
      .join('\n\n');
  }

  return formatted;
}

/**
 * The words that open a new beat, and so a new paragraph.
 *
 * The list is unchanged. What changes is where and how it is read, because the
 * test it was written into got both wrong:
 *
 * ```
 * trimmedLine.includes('Later') || ... || /^(The|As|But|However|Still)/i.test(trimmedLine)
 * ```
 *
 * **The anchored half had no word boundary**, so it fired on the words that
 * merely *begin* with one of these — and the ones it catches are the commonest
 * openers in narrative prose. `The` is inside `They`, `Them`, `Their`,
 * `Theatre`; `As` is inside `Asked`, `Aside`, `Ashes`, `Astonished`; `But` is
 * inside `Butler`, `Button`; `Still` is inside `Stillness`. A run of ordinary
 * sentences — "She set the cup down. / They had not spoken since. / Butler
 * waited by the stair." — was therefore broken into a paragraph per line, which
 * is the opposite of the welding this method's blank-line branch exists to
 * prevent and just as wrong: the reader is shown a chapter chopped into
 * one-sentence stubs wherever the prose happens to use a pronoun.
 *
 * **The `includes` half was not anchored at all**, so a line was declared a
 * shift for a word anywhere inside it. The break this test decides goes *before
 * the whole line*, so a mid-line `Then` or `Later` — "She waited. Then he
 * spoke." — put the break in a place the word never justified.
 *
 * So the rule is one pattern: the line *opens* with one of these words, as a
 * whole word. That is the same reading `wholeWordAlternationPattern` above
 * already applies to the theme and emotion scans, anchored at the start because
 * "opens a new beat" is what this test means.
 *
 * The pattern stays case-insensitive, as the anchored half always was: the
 * lines reaching here are model prose, where a beat can open mid-sentence after
 * a speaker tag has been stripped.
 */
const NARRATIVE_SHIFT_OPENERS = [
  'later',
  'meanwhile',
  'suddenly',
  'then',
  'the',
  'as',
  'but',
  'however',
  'still'
];
const NARRATIVE_SHIFT_OPENING_PATTERN = new RegExp(
  String.raw`^(?:${NARRATIVE_SHIFT_OPENERS.join('|')})\b`,
  'i'
);

/**
 * How short a line has to be to read as a beat marker rather than as prose.
 * Unchanged from the `< 50` it replaces; named so the two halves of the test
 * are both legible.
 */
const NARRATIVE_SHIFT_MAX_LINE_LENGTH = 50;

export function stripSpeakerTagsForDisplay(content: string): string {
  // Enhanced speaker tag removal with better text formatting
  let displayContent = content;

  // Remove speaker tags but preserve structure
  displayContent = displayContent
    .replace(/\[([^\]]+?)\]:\s*/g, '') // Remove speaker tags like [Narrator]: [Character, emotion]:
    .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();

  // Smart paragraph creation based on content structure.
  //
  // The blank lines have to survive the split. Filtering them out here left
  // the branch below — the one that reads a blank line as the paragraph break
  // it is — unreachable, so the only breaks this method could ever make were
  // the ones the dialogue and narrative-shift heuristics guessed at. A model
  // that separated its paragraphs the ordinary way, with a blank line and no
  // opening quote or `Suddenly` to give itself away, had every one of them
  // welded into a single `<p>`: the reader was shown the chapter as one
  // unbroken block, and the paragraph structure the generator had actually
  // written was thrown away before anything downstream could read it.
  const lines = displayContent.split('\n');
  const paragraphs = [];
  let currentParagraph = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line indicates paragraph break
    if (!trimmedLine) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      continue;
    }

    // Start new paragraph for dialogue or narrative shifts
    const isDialogue = trimmedLine.startsWith('"') || trimmedLine.includes('"');
    const isNarrativeShift = trimmedLine.length < NARRATIVE_SHIFT_MAX_LINE_LENGTH
      && NARRATIVE_SHIFT_OPENING_PATTERN.test(trimmedLine);

    if (currentParagraph && (isNarrativeShift || (isDialogue && !currentParagraph.includes('"')))) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = trimmedLine;
    } else {
      currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
    }
  }

  // Add final paragraph
  if (currentParagraph) {
    paragraphs.push(currentParagraph.trim());
  }

  // Format paragraphs with proper HTML
  const formattedParagraphs = paragraphs
    .filter(para => para.length > 0)
    .map(para => {
      // Clean up any extra spacing
      para = para.replace(/\s+/g, ' ').trim();

      // Wrap in paragraph tags if not already formatted
      if (!para.startsWith('<') && !para.includes('<p>')) {
        return `<p>${para}</p>`;
      }
      return para;
    });

  return formattedParagraphs.join('\n\n');
}
