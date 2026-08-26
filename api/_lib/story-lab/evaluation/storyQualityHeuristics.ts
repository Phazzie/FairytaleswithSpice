import type {
  StoryQualityDimensionScore,
  StoryQualityHeuristicReport
} from '../contracts';
import { splitStoryIntoTextBlocks } from '../../utils/storyTextBlocks';

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

function scoreContinuity(storyText: string, configuration: StoryQualityHeuristicInput['configuration']): DimensionDraft {
  const signals: string[] = [];
  if (configuration.creature && storyText.includes(configuration.creature.toLowerCase())) {
    signals.push(`Creature appears: ${configuration.creature}`);
  }
  for (const theme of configuration.themes) {
    const themeWords = theme.split(/[_\s-]+/).filter(word => word.length > 3);
    if (themeWords.some(word => storyText.includes(word.toLowerCase()))) {
      signals.push(`Theme echo appears: ${theme}`);
    }
  }
  if (containsAny(storyText, ['oath', 'vow', 'bargain', 'debt', 'secret'])) {
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

function scoreCliffhangerQuality(storyText: string, paragraphs: string[]): DimensionDraft {
  let finalParagraph = storyText;
  for (const paragraph of paragraphs) {
    finalParagraph = paragraph;
  }
  finalParagraph = finalParagraph.toLowerCase();
  const signals: string[] = [];
  if (/[?!]\s*$/.test(finalParagraph)) {
    signals.push('Ending closes on a question or exclamation.');
  }
  if (containsAny(finalParagraph, ['choose', 'secret', 'reveal', 'blood', 'price', 'door', 'name', 'truth'])) {
    signals.push('Ending contains an unresolved hook word.');
  }
  if (containsAny(finalParagraph, ['cliff', 'continued', 'to be continued'])) {
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

function scoreTropeFreshness(storyText: string): DimensionDraft {
  const staleSignals = ['damsel in distress', 'it was all a dream', 'love at first sight', 'chosen one'];
  const staleHits = staleSignals.filter(signal => storyText.includes(signal));
  const freshSignals = ['cost', 'bargain', 'choice', 'consequence', 'leverage'].filter(signal => storyText.includes(signal));
  return {
    id: 'trope_freshness',
    label: 'Trope freshness',
    score: 72 + freshSignals.length * 6 - staleHits.length * 18,
    rationale: staleHits.length ? 'Potential stale trope language was detected.' : 'No obvious stale trope phrase was detected.',
    signals: staleHits.length ? staleHits.map(hit => `Stale phrase: ${hit}`) : freshSignals.map(hit => `Freshness signal: ${hit}`)
  };
}

function scoreEmotionalVariety(storyText: string): DimensionDraft {
  const emotionGroups = [
    ['want', 'desire', 'hunger'],
    ['fear', 'dread', 'afraid'],
    ['anger', 'rage', 'fury'],
    ['grief', 'ache', 'loss'],
    ['hope', 'trust', 'mercy']
  ];
  const matchedGroups = emotionGroups.filter(group => group.some(word => storyText.includes(word)));
  return {
    id: 'emotional_variety',
    label: 'Emotional variety',
    score: 48 + matchedGroups.length * 12,
    rationale: matchedGroups.length > 1 ? 'Multiple emotional registers are present.' : 'Emotional range looks narrow in the deterministic scan.',
    signals: matchedGroups.map(group => `Emotion family: ${group[0]}`)
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

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some(needle => value.includes(needle));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
 */
const NAMED_CHARACTER_RUN_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
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
 * `\b[A-Z][a-z]+\b` matches the first word of every sentence, so a story with
 * no named characters in it at all — "She opened a door. Rain fell hard. Blood
 * pooled where the light could not reach." — was credited with four of them.
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
  const normalized = storyContent
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .replace(/\s+/g, ' ');
  const lowerNames = namedCharacters
    .map(name => name.toLowerCase().replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(name => name.length > 2);
  const actions: string[] = [];

  for (const entry of agencyLexicon) {
    const termPattern = entry.terms.map(escapeRegExp).join('|');
    const hasNamedAction = lowerNames.some(name => {
      const pattern = new RegExp(String.raw`\b${escapeRegExp(name)}\b(?:\s+[a-z']+){0,4}\s+(${termPattern})\b`);
      return pattern.test(normalized);
    });
    if (hasNamedAction) {
      actions.push(entry.label);
    }
  }

  return actions;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
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
  const normalized = storyContent
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .replace(/\s+/g, ' ');
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

function extractSensoryTextures(storyContent: string): string[] {
  const normalized = storyContent.toLowerCase();
  const sensoryLexicon: Array<{ label: string; terms: readonly string[] }> = [
    { label: 'glow', terms: ['glow', 'glowed', 'glowing', 'bright', 'shimmer', 'shimmered'] },
    { label: 'salt', terms: ['salt', 'salty'] },
    { label: 'sting', terms: ['sting', 'stung', 'stinging'] },
    { label: 'cold', terms: ['cold', 'chill', 'chilled'] },
    { label: 'heat', terms: ['heat', 'hot', 'warm'] },
    { label: 'scent', terms: ['scent', 'smell', 'perfume', 'smoke'] },
    { label: 'sound', terms: ['sound', 'sang', 'whisper', 'rang'] }
  ];

  return sensoryLexicon
    .filter(entry => entry.terms.some(term => new RegExp(String.raw`\b${escapeRegExp(term)}\b`).test(normalized)))
    .map(entry => entry.label);
}
