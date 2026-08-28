import type {
  StoryQualityDimensionScore,
  StoryQualityHeuristicReport
} from '../contracts';
import { splitStoryIntoTextBlocks } from '../../../../shared/storyTextBlocks';
import { collapseWhitespace } from '../../utils/whitespace';
import { escapeRegExp } from '../../utils/regexEscape';
import { wholeWordAlternationPattern, wholeWordPattern } from '../../utils/wholeWord';

export interface StoryQualityHeuristicInput {
  storyContent: string;
  configuration: {
    creature: string;
    themes: string[];
    spicyLevel: number;
    wordCount: number;
  };
}

type DimensionDraft = Omit<StoryQualityDimensionScore, 'score'> & {
  score: number;
};

/**
 * The endings a keyword may pick up and still be the same word.
 *
 * `EMOTION_FAMILIES` and `extractSensoryTextures` answer this by listing every
 * inflection they accept, which works because each of them is a fixed lexicon
 * written beside its own matcher. The three dimensions below are not: the
 * continuity scan matches the creature and the theme words a *request* carried,
 * so there is no list to extend — the words arrive from the blueprint.
 *
 * `d` and `ed` are both here because English spells the past tense both ways
 * depending on whether the stem already ends in `e` (`loved`, `burned`), and
 * `r`/`rs` because an agent noun is the form this genre actually writes for
 * several of these stems (`lover`, `lovers` for a `forbidden_love` seed).
 * Endings that build a *different* word are deliberately absent: `less` is what
 * makes `priceless` out of `price` and `bloodless` out of `blood`, and `ly`
 * what makes `secretly` out of `secret`.
 */
const WORD_INFLECTION_SUFFIXES = String.raw`(?:s|es|d|ed|ing|r|rs)?`;

export function buildStoryQualityHeuristicReport(input: StoryQualityHeuristicInput): StoryQualityHeuristicReport {
  // Stories reach this scan as the HTML the generator produces: paragraphs are
  // `<p>` elements on a single line, not blocks separated by blank lines. Read
  // against the raw markup, every paragraph-shaped signal collapsed — the whole
  // story counted as one paragraph, so the cliffhanger dimension scanned the
  // entire text as if it were the ending and the audio dimension marked every
  // story as one overlong block; `[Speaker]:` tags never started a line, so no
  // story was ever credited with dialogue; and `<p>Hello</p>` counted as a
  // single word. Recovering the block structure first makes every dimension
  // read the prose the way the reader sees it, and leaves plain-text callers
  // (blank-line separated, one tag per line) scoring exactly as before.
  const paragraphs = splitStoryIntoTextBlocks(input.storyContent);
  const plainStory = paragraphs.join('\n\n');
  const storyText = collapseWhitespace(plainStory);
  const lowerStory = storyText.toLowerCase();
  const sentences = storyText.split(/[.!?]+/).map(sentence => sentence.trim()).filter(Boolean);
  const words = storyText.split(/\s+/).filter(Boolean);
  const dialogueLines = plainStory.split('\n').filter(line => /^\s*\[[^\]]+\]:/.test(line));
  const dimensions: StoryQualityDimensionScore[] = [
    scoreContinuity(lowerStory, input.configuration),
    scoreCliffhangerQuality(lowerStory, paragraphs),
    scoreTropeFreshness(lowerStory),
    scoreEmotionalVariety(lowerStory),
    scoreCharacterConsistency(plainStory, dialogueLines),
    scoreProseQuality(plainStory, words.length, sentences.length, paragraphs.length),
    scoreAudioReadiness(dialogueLines, paragraphs)
  ].map(normalizeDimension);
  const overallScore = clampScore(Math.round(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / Math.max(1, dimensions.length)
  ));

  return {
    source: 'heuristic',
    heuristicOnly: true,
    overallScore,
    dimensions,
    summary: `Deterministic story-quality scan completed with ${dimensions.length} advisory dimensions.`
  };
}

/**
 * The words that say a continuity promise is being repeated.
 *
 * A fixed list, so it is compiled with the module rather than word by word on
 * every scan — see `wordFormAlternationPattern`. The two words the scan above it
 * looks for are not fixed: the creature and the theme words arrive on the
 * request, so those stay per-call, which is what `containsWordForm` is for.
 */
const CONTINUITY_PROMISE_PATTERN = wordFormAlternationPattern([
  'oath', 'vow', 'bargain', 'debt', 'secret'
]);

/**
 * The shortest part of a theme id that can be the theme rather than a joint
 * between its words.
 *
 * A theme arrives as an id — `forbidden_love`, `enemies_to_lovers` — and is
 * split on its separators, so the filter here exists to drop the connective the
 * split exposes: the `to` in `enemies_to_lovers`, which appears in every story
 * ever written and would report a theme echo for all of them. Every connective
 * in either vocabulary the seams accept is two letters, which is the same
 * observation `SHORTEST_MEANINGFUL_MODIFIER` below is written on.
 *
 * The floor was one letter higher than that, and one of the eighteen classic
 * themes is exactly three letters. `sin` was therefore filtered out of its own
 * word list, and `[].some(…)` is `false`, so the theme could never be echoed
 * however plainly a chapter carried it: a story of sin, sinners, and damnation
 * scored `Few configured story anchors were detected` and lost the twelve
 * points a matched theme is worth — on the one dimension that exists to say the
 * story kept the promise its configuration made. It is the same shape as the
 * six themes `extractThemesFromContent` could not report before they were given
 * keywords: a member of the closed set that the scan reading it cannot reach.
 *
 * Not claimed: this is a floor on length, not a stop-word list. A caller-sent
 * theme phrase containing a three-letter function word (`cat and mouse`) can
 * now echo on that word. Neither vocabulary the app itself sends — the eighteen
 * classic themes or the twelve Story Lab seeds — contains one.
 */
const SHORTEST_MEANINGFUL_THEME_WORD = 3;

function scoreContinuity(storyText: string, configuration: StoryQualityHeuristicInput['configuration']): DimensionDraft {
  const signals: string[] = [];
  if (configuration.creature && containsWordForm(storyText, configuration.creature.toLowerCase())) {
    signals.push(`Creature appears: ${configuration.creature}`);
  }
  for (const theme of configuration.themes) {
    const themeWords = theme.split(/[_\s-]+/).filter(word => word.length >= SHORTEST_MEANINGFUL_THEME_WORD);
    if (themeWords.some(word => containsWordForm(storyText, word.toLowerCase()))) {
      signals.push(`Theme echo appears: ${theme}`);
    }
  }
  if (CONTINUITY_PROMISE_PATTERN.test(storyText)) {
    signals.push('Continuity object or promise is repeated.');
  }

  return {
    id: 'continuity',
    label: 'Continuity',
    score: 55 + signals.length * 12,
    rationale: signals.length ? 'Story text repeats configured or established state.' : 'Few configured story anchors were detected.',
    signals
  };
}

/** The two fixed lists the ending is read against, compiled with the module. */
const UNRESOLVED_HOOK_WORD_PATTERN = wordFormAlternationPattern([
  'choose', 'secret', 'reveal', 'blood', 'price', 'door', 'name', 'truth'
]);
/**
 * The words that say an ending is *announcing* itself as a cliffhanger, as
 * opposed to being one.
 *
 * Both of the entries this replaces named ordinary narrative vocabulary, and
 * between them they inverted the signal:
 *
 * - **`cliff` could not match `cliffhanger`.** `wordFormAlternationPattern`
 *   accepts an inflection, not a compound, and `hanger` is not one of
 *   `WORD_INFLECTION_SUFFIXES` — so the boundary at the end of the alternation
 *   rejected `cliffhanger` outright. The only thing the entry ever matched was
 *   the rock face, in a genre that writes coastlines: a chapter closing on
 *   `they stood on the cliff` was reported as using explicit cliffhanger
 *   language, and a chapter that used the actual word was not.
 * - **`continued` is one of the commonest verbs in narrative prose.** `he
 *   continued down the hall` scored the signal in full, and the entry was
 *   redundant besides: the phrase `to be continued` beside it already contains
 *   it, so the bare verb bought nothing the idiom did not already cover.
 *
 * The dimension is advisory but not free — the signal is worth sixteen points
 * of `cliffhanger_quality`, which is one seventh of the `overallScore` the
 * Proving Grounds compares two prompt variants by. This is the same class of
 * defect as `anger` inside `danger` in `EMOTION_FAMILIES` above, arriving
 * through a lexicon entry rather than through a substring match: a word that
 * means something else, credited as the signal.
 */
const EXPLICIT_CLIFFHANGER_PATTERN = wordFormAlternationPattern([
  'cliffhanger', 'to be continued'
]);

/**
 * Known limit: a label the markup tore in half is not recognised.
 *
 * `splitStoryIntoTextBlocks` treats `<br>` as a block boundary — it has to, or
 * the words on either side weld into a single token — so `<p>To be<br>continued
 * </p>` arrives as the two blocks `To be` and `continued`, and the final-block
 * test above sees only the second. That ending scores nothing.
 *
 * This PR carried a reconstruction that joined the trailing blocks to put such a
 * label back together, and it was withdrawn after four review findings against
 * it — three of them false positives. The last is the one that settles it:
 * `<p>She wanted to be</p><p>continued through the next trial.</p>` is two
 * ordinary paragraphs of prose, and joining them *synthesises* the label out of
 * words that were never a label. That is the same defect the `continued` entry
 * was removed for, arriving by a different route, and it is worse than the gap
 * it was added to close.
 *
 * It cannot be fixed at this level. The join is only ever safe across a `<br>`,
 * and by the time the blocks reach here the splitter has erased which boundary
 * was which — a `<p>` break and a `<br>` break are the same `\n\n`. Recovering
 * that means giving `splitStoryIntoTextBlocks` a notion of boundary provenance,
 * which every scanner in the repository reads and which is a change of its own.
 *
 * So the gap stands, deliberately: a `<br>`-split label is a **missed** signal,
 * which is the direction an advisory scan should err in. A synthesised one is a
 * score too high on prose that announces nothing, which is what this dimension
 * was being repaired for in the first place.
 */

/**
 * Score the ending, reading the final paragraph the way every other dimension
 * here reads its text.
 *
 * The paragraph arrives straight from `splitStoryIntoTextBlocks`, whose blocks
 * keep whatever whitespace the generator wrote inside them — so this was the one
 * dimension of the seven scanning text that had never been through
 * `collapseWhitespace`, and the inconsistency was inside the function: the
 * fallback for a story with no blocks at all *is* the collapsed text, and the
 * branch that runs on every real story was not.
 *
 * What that costs is the multi-word entry. `to be continued` is escaped
 * literally, single spaces and all, so an ending the generator wrapped between
 * the words — `To be\ncontinued` — was invisible to the pattern named for it.
 * It is the same failure `CLIFFHANGER_HOOK_PATTERNS` collapses its scanned
 * paragraphs for, and the same one `extractPlotThreads`'s
 * `UNRESOLVED_QUESTION_PATTERN` names. It was masked until now by the `continued`
 * entry removed above, which matched either way for the wrong reason.
 *
 * All three tests read the final block. A label a `<br>` broke across blocks is
 * not recognised — see the note on `EXPLICIT_CLIFFHANGER_PATTERN` for why that
 * gap is left open rather than closed by joining blocks.
 */
function scoreCliffhangerQuality(storyText: string, paragraphs: string[]): DimensionDraft {
  const finalParagraph = collapseWhitespace(
    paragraphs.length ? paragraphs[paragraphs.length - 1] : storyText
  ).toLowerCase();
  const signals: string[] = [];
  if (/[?!]\s*$/.test(finalParagraph)) {
    signals.push('Ending closes on a question or exclamation.');
  }
  if (UNRESOLVED_HOOK_WORD_PATTERN.test(finalParagraph)) {
    signals.push('Ending contains an unresolved hook word.');
  }
  if (EXPLICIT_CLIFFHANGER_PATTERN.test(finalParagraph)) {
    signals.push('Ending uses explicit cliffhanger language.');
  }

  return {
    id: 'cliffhanger_quality',
    label: 'Cliffhanger quality',
    score: 50 + signals.length * 16,
    rationale: signals.length ? 'The ending carries unresolved pressure.' : 'The ending may need a sharper unresolved turn.',
    signals
  };
}

/**
 * The phrases and words this dimension names in its signals, each with its own
 * compiled pattern.
 *
 * One pattern per entry rather than one per list, because this scan reports
 * *which* entries it found — the alternation the two dimensions above use
 * answers "any of these", which is all they need. Compiled with the module
 * either way.
 *
 * The stale entries are phrases, and the boundary is still only asked about
 * their ends: `chosen ones` is the same phrase as `chosen one`, and nothing in
 * English attaches to the front of `damsel in distress`.
 */
const STALE_TROPE_SIGNALS = withWordFormPatterns([
  'damsel in distress', 'it was all a dream', 'love at first sight', 'chosen one'
]);
const FRESHNESS_SIGNALS = withWordFormPatterns([
  'cost', 'bargain', 'choice', 'consequence', 'leverage'
]);

function scoreTropeFreshness(storyText: string): DimensionDraft {
  const staleHits = STALE_TROPE_SIGNALS
    .filter(signal => signal.pattern.test(storyText))
    .map(signal => signal.phrase);
  const freshSignals = FRESHNESS_SIGNALS
    .filter(signal => signal.pattern.test(storyText))
    .map(signal => signal.phrase);
  return {
    id: 'trope_freshness',
    label: 'Trope freshness',
    score: 72 + freshSignals.length * 6 - staleHits.length * 18,
    rationale: staleHits.length ? 'Potential stale trope language was detected.' : 'No obvious stale trope phrase was detected.',
    signals: staleHits.length ? staleHits.map(hit => `Stale phrase: ${hit}`) : freshSignals.map(hit => `Freshness signal: ${hit}`)
  };
}

/**
 * The five emotional registers this dimension looks for, and the words that
 * count as each one.
 *
 * The groups were bare word lists matched with `String.prototype.includes`, and
 * the failure is the one `StoryService.extractSpicyLevelFromContent` was fixed
 * for a commit ago: a short emotion word sits inside longer words that mean
 * something else, or the opposite thing, and this app writes those words
 * constantly.
 *
 * - `anger` is inside `danger` and `stranger`. A dark-romance chapter about a
 *   dangerous stranger scored the rage register without a single angry beat in
 *   it, and `rage` is inside `courage`, so the same register was scored twice
 *   over by a word for the opposite disposition.
 * - `ache` is inside `reached` — an ordinary verb of motion, in almost every
 *   chapter this app produces — so the grief register was effectively always
 *   on, and `loss` is inside `blossom` and `gloss`.
 * - `hope` is inside `hopeless`, `fear` inside `fearless`, and `trust` inside
 *   `distrust` and `mistrust`. Three registers credited by the negations that
 *   deny them.
 *
 * Five groups at twelve points each on a base of 48 tops out at 108, clamped to
 * 100, so a scan this leaky did not merely inflate the number — it took
 * `emotional_variety` to its maximum for nearly any prose, which makes the
 * dimension unable to distinguish anything and pulls the `overallScore` it is
 * one seventh of along with it.
 *
 * Whole words, then, with the inflections the substring form picked up for free
 * listed rather than lost: `wanted` for `want`, `desires` for `desire`,
 * `losses` for `loss`. What is deliberately not carried over is the rest of
 * what the substrings caught — `danger` is not `anger`, `reached` is not
 * `ache`, `hopeless` is not `hope`. Those are the defect, not coverage. The
 * shape is `extractSensoryTextures`'s below, which has matched whole words
 * since it was written; the label each group reports is unchanged.
 */
const EMOTION_FAMILIES: ReadonlyArray<{ label: string; terms: readonly string[] }> = [
  { label: 'want', terms: ['want', 'wanted', 'wanting', 'wants', 'desire', 'desired', 'desires', 'desiring', 'hunger', 'hungered', 'hungering', 'hungers'] },
  { label: 'fear', terms: ['fear', 'feared', 'fearing', 'fears', 'dread', 'dreaded', 'dreading', 'dreads', 'afraid'] },
  { label: 'anger', terms: ['anger', 'angered', 'angering', 'angers', 'rage', 'raged', 'rages', 'fury'] },
  { label: 'grief', terms: ['grief', 'ache', 'ached', 'aches', 'loss', 'losses'] },
  { label: 'hope', terms: ['hope', 'hoped', 'hopes', 'trust', 'trusted', 'trusting', 'trusts', 'mercy'] }
];

/**
 * One pattern per family, compiled with the table rather than per term on every
 * scan.
 *
 * `wholeWordAlternationPattern` is the helper for exactly this — "compiled once
 * per table by the callers that scan repeatedly, never per call" — and asking
 * `containsWholeWord` term by term is the per-call form: it builds a `RegExp`
 * for each of the forty-five terms below, and again for the twenty-four in
 * `extractSensoryTextures`, every time a story is scored. The boundary the
 * alternation puts at its ends is the boundary each term carried on its own, so
 * what a story matches is unchanged.
 */
const EMOTION_FAMILY_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> =
  EMOTION_FAMILIES.map(family => ({
    label: family.label,
    pattern: wholeWordAlternationPattern(family.terms)
  }));

function scoreEmotionalVariety(storyText: string): DimensionDraft {
  const matchedFamilies = EMOTION_FAMILY_PATTERNS.filter(family => family.pattern.test(storyText));
  return {
    id: 'emotional_variety',
    label: 'Emotional variety',
    score: 48 + matchedFamilies.length * 12,
    rationale: matchedFamilies.length > 1 ? 'Multiple emotional registers are present.' : 'Emotional range looks narrow in the deterministic scan.',
    signals: matchedFamilies.map(family => `Emotion family: ${family.label}`)
  };
}

function scoreCharacterConsistency(storyContent: string, dialogueLines: string[]): DimensionDraft {
  const speakers = extractDialogueSpeakers(dialogueLines);
  const namedCharacters = extractNamedCharacters(storyContent, speakers);
  const agencyActions = extractAgencyActions(storyContent, namedCharacters);
  let rationale = 'Few character identity signals were detected.';
  if (agencyActions.length) {
    rationale = 'Dialogue speakers, named characters, and concrete character actions are identifiable.';
  } else if (speakers.length) {
    rationale = 'Dialogue speakers and named characters are identifiable.';
  }
  const signals = [
    ...speakers.map(speaker => `Speaker: ${speaker}`),
    ...(namedCharacters.length ? [`Named character count: ${namedCharacters.length}`] : []),
    ...(agencyActions.length ? [`Agency actions: ${agencyActions.slice(0, 4).join(', ')}`] : [])
  ];

  return {
    id: 'character_consistency',
    label: 'Character consistency',
    score: 52 + Math.min(3, speakers.length) * 12 + Math.min(2, namedCharacters.length) * 6 + Math.min(2, agencyActions.length) * 5,
    rationale,
    signals
  };
}

function scoreProseQuality(storyContent: string, wordCount: number, sentenceCount: number, paragraphCount: number): DimensionDraft {
  const averageSentenceLength = sentenceCount ? wordCount / sentenceCount : wordCount;
  const signals: string[] = [
    `Words: ${wordCount}`,
    `Paragraphs: ${paragraphCount}`,
    `Average sentence length: ${averageSentenceLength.toFixed(1)}`
  ];
  const specificAnchors = extractConcreteAnchors(storyContent);
  if (specificAnchors.length) {
    signals.push(`Specific anchors: ${specificAnchors.slice(0, 3).join(', ')}`);
  }
  const sensoryTextures = extractSensoryTextures(storyContent);
  if (sensoryTextures.length) {
    signals.push(`Sensory texture: ${sensoryTextures.slice(0, 4).join(', ')}`);
  }
  const sentenceScore = averageSentenceLength >= 8 && averageSentenceLength <= 28 ? 24 : 10;
  const paragraphScore = paragraphCount >= 2 ? 18 : 8;
  const specificityScore = Math.min(2, specificAnchors.length) * 4;
  const sensoryScore = Math.min(3, sensoryTextures.length) * 3;

  return {
    id: 'prose_quality',
    label: 'Prose quality',
    score: 48 + sentenceScore + paragraphScore + specificityScore + sensoryScore,
    rationale: 'Deterministic readability scan uses sentence shape, concrete anchors, and sensory texture signals.',
    signals
  };
}

/**
 * The paragraph length a narrator has to read in one unbroken breath before
 * this dimension counts it against the story.
 */
const AUDIO_READINESS_MAX_PARAGRAPH_WORDS = 90;

function scoreAudioReadiness(dialogueLines: string[], paragraphs: string[]): DimensionDraft {
  const dialogueLineCount = dialogueLines.length;
  const speakers = extractDialogueSpeakers(dialogueLines);
  const paragraphWordCounts = paragraphs.map(paragraph => paragraph.split(/\s+/).filter(Boolean).length);
  const longParagraphs = paragraphWordCounts.filter(count => count > AUDIO_READINESS_MAX_PARAGRAPH_WORDS);
  const signals: string[] = [];
  if (dialogueLineCount > 0) {
    signals.push(`Tagged dialogue lines: ${dialogueLineCount}`);
  }
  if (speakers.length > 1) {
    signals.push(`Speaker variety: ${speakers.slice(0, 4).join(', ')}`);
  } else if (speakers.length === 1) {
    signals.push(`Single speaker: ${speakers[0]}`);
  }
  // Both sides of the paragraph-length check are reported, because this is the
  // only thing in the dimension that can *cost* points and it used to say
  // nothing when it did. An overlong paragraph swings the score by thirty — the
  // difference between the `+12` below and the `-18` — so a story carrying one
  // was scored down to a number the reader had no way to explain: the rationale
  // claimed to check paragraph length, and every signal beside it was about
  // dialogue. `scoreTropeFreshness` already prints the stale phrases that cost
  // it points; this prints how many paragraphs are too long and how long the
  // worst one runs, which is what a writer needs to act on it.
  if (longParagraphs.length) {
    signals.push(
      `Overlong paragraphs (over ${AUDIO_READINESS_MAX_PARAGRAPH_WORDS} words): ${longParagraphs.length}, ` +
        `longest ${Math.max(...longParagraphs)} words`
    );
  } else {
    signals.push('No overlong paragraphs detected.');
  }

  return {
    id: 'audio_readiness',
    label: 'Audio-readiness',
    score: 58 + Math.min(3, dialogueLineCount) * 8 + (longParagraphs.length ? -18 : 12),
    rationale: 'Audio-readiness checks dialogue tags, speaker variety, and paragraph length.',
    signals
  };
}

function normalizeDimension(dimension: DimensionDraft): StoryQualityDimensionScore {
  return {
    ...dimension,
    score: clampScore(Math.round(dimension.score))
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * One pattern matching any word form of any of `words`, compiled once.
 *
 * This is `containsAny` — "whether any of these appears as a word rather than as
 * a run of letters inside another one" — asked of a table instead of asked word
 * by word. The old form ran `containsWordForm` per needle per call, and
 * `containsWordForm` builds a `RegExp` per spelling, so the three fixed lists
 * above it were recompiled on every story scored: sixteen words, thirty-two
 * patterns, for prose the scan reads once.
 *
 * `wholeWordAlternationPattern` is the same idea for a table of plain keywords;
 * this is its counterpart for the tolerant reading, so the two dimensions that
 * need inflections get the boundary at the ends of the alternation exactly as
 * the emotion families do.
 */
function wordFormAlternationPattern(words: readonly string[]): RegExp {
  return wholeWordPattern(
    words
      .flatMap(wordSpellings)
      .map(spelling => `${escapeRegExp(spelling)}${WORD_INFLECTION_SUFFIXES}`)
      .join('|')
  );
}

/**
 * The same, one pattern per entry, for the scan that reports *which* of its
 * phrases it found rather than whether any of them appeared.
 */
function withWordFormPatterns(phrases: readonly string[]): ReadonlyArray<{ phrase: string; pattern: RegExp }> {
  return phrases.map(phrase => ({ phrase, pattern: wordFormAlternationPattern([phrase]) }));
}

function extractDialogueSpeakers(dialogueLines: string[]): string[] {
  return Array.from(new Set(dialogueLines
    .map(line => /^\s*\[([^\]]+)\]:/.exec(line)?.[1]?.trim())
    .map(speaker => speaker?.split(',')[0]?.trim())
    .filter((speaker): speaker is string => Boolean(speaker))));
}

/**
 * A whole run of consecutive capitalized words, not a name-shaped pair.
 *
 * The boundary has to be decided before the words are combined. Matching at
 * most two of them and testing the pair swallowed the name in "Then Mira
 * pressed the blood oath": the pair `Then Mira` is rejected for starting the
 * sentence, and because a global matcher resumes after the whole match, `Mira`
 * is never offered on its own. Reading the run lets the sentence opener be
 * dropped and the rest of the run kept.
 *
 * Written on the Unicode properties rather than on `[A-Z][a-z]+`, for the
 * reason `slugId` in the continuity extractor and the story-download filename
 * stem are both written that way: a cast is not always spelled in ASCII.
 * `\b[A-Z][a-z]+\b` saw no name at all in `Мира pressed the blood oath`, and
 * cut `José` down to `Jos` — the accented letter is not `[a-z]`, so the run
 * ended at it and the scan reported a character the story never names. Both
 * results then travel: `extractAgencyActions` below is handed this list, so no
 * action either character took anywhere in the chapter could be credited to
 * them either, and the dimension's `Named character count` counted a cast it
 * could not see.
 *
 * `\b` cannot be the boundary once the pattern reaches past ASCII. It is
 * defined against `[A-Za-z0-9_]`, so there is no word boundary between a space
 * and `М` — an anchored `\bМира\b` matches nothing anywhere. The lookarounds
 * state the property `\b` was standing in for: the run begins and ends where
 * the surrounding text is not part of a word, in any script.
 *
 * A combining mark is retained beside the lowercase letters, so a name typed in
 * decomposed form (`José` as `Jose` plus a combining acute) is read as the one
 * name it is rather than being cut at the mark. A script with no case at all —
 * `美咲`, `مريم` — has no capital for this to key on and is not reachable this
 * way; those names arrive through the `[Speaker]:` tags that seed the set
 * below, which say who is talking by construction.
 */
const NAMED_CHARACTER_RUN_PATTERN =
  /(?<![\p{L}\p{N}\p{M}])\p{Lu}[\p{Ll}\p{M}]+(?:\s+\p{Lu}[\p{Ll}\p{M}]+)*(?![\p{L}\p{N}\p{M}])/gu;
/** A name is at most a given name and a surname, as it always was. */
const MAX_NAME_WORDS = 2;
/**
 * The longest first token of a concrete anchor that cannot be carrying meaning.
 * No English word of one or two letters is a modifier that makes a noun
 * specific — they are articles, prepositions, pronouns, and conjunctions — so
 * `a door`, `my key`, `in court`, and `by car` are all rejected by length
 * rather than by having to be named one at a time.
 */
const SHORTEST_MEANINGFUL_MODIFIER = 2;
/**
 * Punctuation that ends the sentence before a capitalized word, so the capital
 * is explained by the position rather than by the word being a name. The colon
 * is here for the `[Speaker]:` tags the generator writes, which put a capital
 * after every one of them.
 *
 * The semicolon and the dashes are deliberately absent. English does not
 * capitalize after them, so a capital that follows one is explained by nothing
 * but the word — it is a name, and treating the mark as a boundary threw it
 * away: "The lock broke; Mira pressed the blood oath" scored no character
 * signals at all, while the same sentence with a comma scored two. The
 * ellipsis stays, because it genuinely can end a sentence, and a missed name
 * is the cheaper error here than a common noun counted as a character.
 */
const SENTENCE_END_PUNCTUATION = new Set(['.', '!', '?', ':', '…']);
/**
 * Characters that can sit between the punctuation and the capital without
 * moving the word off the sentence boundary — the opening quote of a line of
 * dialogue, the bracket of a speaker tag, a list dash.
 */
const PRE_NAME_PUNCTUATION = new Set(['"', "'", '“', '”', '‘', '’', '(', '[', '*', '-']);

/**
 * Read the proper names a story uses, rather than every capitalized word.
 *
 * A capitalized-word pattern matches the first word of every sentence, so a
 * story with no named characters in it at all — "She opened a door. Rain fell
 * hard. Blood pooled where the light could not reach." — was credited with four
 * of them.
 * The named-character bonus caps at two, so every story longer than two
 * sentences collected it in full and the dimension could not tell a story with
 * a cast from one without: the signal it printed, `Named character count`, was
 * really a sentence count.
 *
 * A capitalized word counts as a name only where nothing but the word itself
 * explains the capital — at least one appearance away from a sentence
 * boundary, a line start, or a `[Speaker]:` tag. A sentence opener only
 * disqualifies itself, not the words after it: "Then Mira pressed the blood
 * oath" drops `Then` and keeps `Mira`. A name a story only ever writes
 * sentence-initially is still missed, which is the safe direction for an
 * advisory signal: reporting a cast that is not there is what made the score
 * meaningless.
 *
 * The one place a name needs no such inference is a `[Speaker]:` tag, which
 * the generator writes to say who is talking — a character name by
 * construction, whatever position it sits in. The scan proved the point and
 * then threw it away: a line beginning `[Elena]:` starts the block, so the
 * boundary rule dropped `Elena`, and the dimension reported `Named character
 * count: 1` for a scene whose own signals already listed `Speaker: Elena`
 * beside two other names. The agency scan reads this list too, so no action
 * Elena took anywhere in the chapter could be credited to her either. Seeding
 * the set with the speakers the same scan already extracted fixes both, and
 * `Narrator` is excluded here for the reason it is excluded below: it names
 * the telling, not a member of the cast.
 */
function extractNamedCharacters(storyContent: string, dialogueSpeakers: readonly string[] = []): string[] {
  const names = new Set<string>(
    dialogueSpeakers
      .map(speaker => speaker.trim().split(/\s+/).slice(0, MAX_NAME_WORDS).join(' '))
      .filter(speaker => speaker && speaker !== 'Narrator')
  );

  for (const match of storyContent.matchAll(NAMED_CHARACTER_RUN_PATTERN)) {
    const words = match[0].split(/\s+/);
    // Only the run's first word can be sitting on the boundary; the rest are
    // capitalized mid-sentence whatever precedes the run.
    if (startsSentence(storyContent, match.index ?? 0)) {
      words.shift();
    }

    const name = words.slice(0, MAX_NAME_WORDS).join(' ');
    if (name && name !== 'Narrator') {
      names.add(name);
    }
  }

  return Array.from(names);
}

function startsSentence(storyContent: string, index: number): boolean {
  let cursor = index - 1;

  while (cursor >= 0) {
    const character = storyContent[cursor];
    // A line break is a boundary in its own right: paragraphs and dialogue
    // lines do not always end in punctuation, and the word after one is still
    // capitalized for its position.
    if (character === '\n') {
      return true;
    }
    if (!/\s/.test(character) && !PRE_NAME_PUNCTUATION.has(character)) {
      break;
    }
    cursor -= 1;
  }

  return cursor < 0 || SENTENCE_END_PUNCTUATION.has(storyContent[cursor]);
}

function extractAgencyActions(storyContent: string, namedCharacters: readonly string[]): string[] {
  const agencyLexicon: Array<{ label: string; terms: readonly string[] }> = [
    { label: 'pressed', terms: ['press', 'pressed', 'presses'] },
    { label: 'touched', terms: ['touch', 'touched', 'touches'] },
    { label: 'chose', terms: ['chose', 'chooses'] },
    { label: 'refused', terms: ['refuse', 'refused', 'refuses'] },
    { label: 'revealed', terms: ['reveal', 'revealed', 'reveals'] },
    { label: 'risked', terms: ['risk', 'risked', 'risks'] },
    { label: 'protected', terms: ['protect', 'protected', 'protects'] },
    { label: 'challenged', terms: ['challenge', 'challenged', 'challenges'] },
    { label: 'paid', terms: ['pay', 'paid', 'pays'] },
    { label: 'escaped', terms: ['escape', 'escaped', 'escapes'] }
  ];
  const normalized = normalizeProseForScanning(storyContent);
  const lowerNames = namedCharacters
    .map(name => normalizeProseForScanning(name).trim())
    .filter(name => name.length > 2);
  const actions: string[] = [];

  for (const entry of agencyLexicon) {
    const termPattern = entry.terms.map(escapeRegExp).join('|');
    const hasNamedAction = lowerNames.some(name => {
      // The name's own boundaries are stated as lookarounds rather than as
      // `\b`, for the reason `NAMED_CHARACTER_RUN_PATTERN` is: `\b` is defined
      // against `[A-Za-z0-9_]`, so `\bмира\b` has no boundary to sit on and
      // matches nothing. The verbs are the lexicon's own ASCII words and keep
      // the `\b` they were always written with.
      const pattern = new RegExp(
        String.raw`(?<![\p{L}\p{M}])${escapeRegExp(name)}(?![\p{L}\p{M}])(?:\s+[\p{L}\p{M}']+){0,4}\s+(${termPattern})\b`,
        'u'
      );
      return pattern.test(normalized);
    });
    if (hasNamedAction) {
      actions.push(entry.label);
    }
  }

  return actions;
}

/**
 * Reduce prose to lowercase words separated by single spaces, for the two scans
 * below that read it as a sequence of tokens.
 *
 * Every character that is not part of a word becomes a space rather than being
 * deleted, because both callers depend on adjacency: the agency scan counts how
 * many words sit between a name and a verb, and `extractConcreteAnchors` pairs
 * each token with the one after it. Deleting a character would move two words
 * that are not adjacent next to each other, which is the failure the anchor
 * scan was already fixed for once.
 *
 * `[^a-z'\s-]` did exactly that deletion for every letter outside ASCII, and
 * so reintroduced it: `she opened Мирина door` normalized to `she opened door`,
 * whose token pairs include `opened door` — an anchor that is not in the prose,
 * scored as a concrete reference for the same reason `a door` used to be. The
 * agency scan lost the same words, so its "at most four words between the name
 * and the verb" allowance silently counted a different span than the story
 * holds, and a name written in any such script was erased from the text before
 * it could be matched at all.
 *
 * The retained set is letters, marks, the apostrophe, and the hyphen — the
 * marks beside the letters so a decomposed `José` stays one token rather than
 * splitting at its accent. Digits are excluded as they always were: neither
 * scan has anything to say about a number.
 */
function normalizeProseForScanning(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Whether `text` contains `keyword` as a whole word. Both sides are already
 * lowercased by the caller.
 *
 * The boundaries are stated as lookarounds rather than as `\b`, for the reason
 * `NAMED_CHARACTER_RUN_PATTERN` and the agency scan above both give: `\b` is
 * defined against `[A-Za-z0-9_]`, so it finds a boundary between an ASCII
 * keyword and the non-ASCII letter beside it and reports a word that is really
 * part of a longer one in another script. The keywords themselves are the
 * lexicons' own ASCII words; it is the prose around them that is not
 * guaranteed to be.
 *
 * That reading is now `api/_lib/utils/wholeWord.ts`'s, which is what the three
 * scans that still spelled the boundary `\b` — the content analysis, the
 * pressure keywords, and the cliffhanger hooks — were moved onto. This one was
 * already right; what changes is that it is no longer the only one.
 */


/**
 * The spellings of `word` this scan will accept before suffixes are considered.
 *
 * Two English plurals are not suffixes at all — they replace the last letter —
 * and both of them land on the creature archetypes the blueprint contract
 * names: `fairy` becomes `fairies` and `werewolf` becomes `werewolves`. Every
 * other archetype in that list of ten pluralizes by suffix, so those two are
 * the whole of the irregularity worth spelling out here.
 */
function wordSpellings(word: string): string[] {
  const spellings = [word];

  if (/[^aeiou]y$/.test(word)) {
    spellings.push(`${word.slice(0, -1)}ie`);
  }
  if (/f$/.test(word)) {
    spellings.push(`${word.slice(0, -1)}ve`);
  }

  return spellings;
}

/**
 * Whether `text` contains `word` — or an inflection of it — as a whole word.
 *
 * This is `containsWholeWord` with the tolerance the three dimensions above
 * need and the emotion families do not: their terms are listed with their
 * inflections already, these arrive from a request.
 *
 * The boundary is the point. Every one of these scans read `String.prototype
 * .includes` before this, and the words they look for are short ones this genre
 * writes longer words around:
 *
 * - `oath` is inside `loathe` and `loathing`, so a chapter about loathing
 *   someone was credited with repeating a continuity promise.
 * - A `forbidden_love` seed looks for `love`, which is inside `gloves` and
 *   `clover`; a `slow_burn` seed looks for `burn`, inside `burnished`.
 * - `fairy` is inside `fairytale` — the word this app is named for — and
 *   `witch` inside `switch`, `dragon` inside `dragonfly`, and `demon` inside
 *   `demonstrate`, so "she switched off the lamp" reported `Creature appears:
 *   witch` for a story with no witch in it.
 * - `cost` is inside `costume`, in a genre that writes masquerades.
 * - `door` is inside `doorway`, `price` inside `priceless`, `blood` inside
 *   `bloodless`, and `name` inside `nameless` — three of the eight hook words
 *   the cliffhanger dimension credits an ending for, matched by the words that
 *   negate them.
 *
 * The tolerance is what keeps the fix from costing what the substrings were
 * really buying: `loved`, `lovers`, `burning`, `oaths`, `secrets`, `bargained`
 * all still count, because they are the same word.
 */
function containsWordForm(text: string, word: string): boolean {
  return wordSpellings(word).some(spelling =>
    wholeWordPattern(`${escapeRegExp(spelling)}${WORD_INFLECTION_SUFFIXES}`).test(text)
  );
}

function extractConcreteAnchors(storyContent: string): string[] {
  const objectNouns = new Set([
    'arch',
    'bargain',
    'blade',
    'book',
    'bridge',
    'car',
    'contract',
    'court',
    'crown',
    'door',
    'envelope',
    'house',
    'key',
    'ledger',
    'letter',
    'map',
    'mirror',
    'oath',
    'phone',
    'reef',
    'ring',
    'shell',
    'sleeve',
    'ticket',
    'vow'
  ]);
  // The one- and two-character words are not listed here: every English word
  // that short is a function word — article, preposition, pronoun, or
  // conjunction — and none of them makes the noun after it specific. They are
  // rejected wholesale by the length check below, which is what `a`, `an`, and
  // `my` used to be doing here and what also covers `in court` and `by car`.
  const weakFirstTokens = new Set([
    'and',
    'every',
    'her',
    'his',
    'now',
    'our',
    'that',
    'the',
    'then',
    'their',
    'this',
    'under',
    'which',
    'your'
  ]);
  const weakVerbPrefixes = new Set([
    'choose',
    'glowed',
    'listened',
    'owns',
    'pressed',
    'recorded',
    'repeats',
    'survives',
    'touched',
    'wanted'
  ]);
  const anchors: string[] = [];
  const normalized = normalizeProseForScanning(storyContent);
  // Every token, so that two words are paired only when they really are
  // adjacent. Dropping the short ones before pairing welded two non-adjacent
  // neighbours into a phrase that was never in the prose — "She opened a door"
  // became the anchor `opened door`, scoring a generic reference as a concrete
  // one — and it also made the `a`/`an`/`my` entries of `weakFirstTokens`
  // unreachable, since the words they name were already gone. The short words
  // are still rejected, but as the first half of a pair rather than as tokens,
  // which is the distinction the old filter got wrong.
  const tokens = normalized.split(' ').filter(Boolean);

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const phrase = `${tokens[index]} ${tokens[index + 1]}`;
    const noun = tokens[index + 1].replace(/s$/, '');
    const firstToken = tokens[index];
    if (
      firstToken.length <= SHORTEST_MEANINGFUL_MODIFIER ||
      weakFirstTokens.has(firstToken) ||
      weakVerbPrefixes.has(firstToken) ||
      !objectNouns.has(noun) ||
      anchors.includes(phrase)
    ) {
      continue;
    }
    anchors.push(phrase);
    if (anchors.length >= 5) {
      break;
    }
  }

  return anchors;
}

// The same whole-word reading the emotion families use, and — since this table
// was a function-local literal rebuilt on every scan — compiled the same way.
// See `EMOTION_FAMILY_PATTERNS`.
const SENSORY_TEXTURE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'glow', terms: ['glow', 'glowed', 'glowing', 'bright', 'shimmer', 'shimmered'] },
  { label: 'salt', terms: ['salt', 'salty'] },
  { label: 'sting', terms: ['sting', 'stung', 'stinging'] },
  { label: 'cold', terms: ['cold', 'chill', 'chilled'] },
  { label: 'heat', terms: ['heat', 'hot', 'warm'] },
  { label: 'scent', terms: ['scent', 'smell', 'perfume', 'smoke'] },
  { label: 'sound', terms: ['sound', 'sang', 'whisper', 'rang'] }
].map(entry => ({ label: entry.label, pattern: wholeWordAlternationPattern(entry.terms) }));

function extractSensoryTextures(storyContent: string): string[] {
  const normalized = storyContent.toLowerCase();

  return SENSORY_TEXTURE_PATTERNS
    .filter(entry => entry.pattern.test(normalized))
    .map(entry => entry.label);
}
